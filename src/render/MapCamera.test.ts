import type { Application } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Area, Transform } from './camera'

// pixi-viewport falso: guarda a transformação, os eventos e os plugins pausados. O MapCamera só usa
// esta parte da API; a interação de verdade (arrasto, roda, pinça) fica no E2E.
class FakeViewport {
  position = { x: 0, y: 0, set: (x: number, y: number) => Object.assign(this.position, { x, y }) }
  scale = { x: 1, set: (s: number) => void (this.scale.x = s) }
  paused = new Set<string>()
  decelerate = { x: 0 as number | null, y: 0 as number | null, reset: vi.fn() }
  private handlers = new Map<string, Set<(...a: unknown[]) => void>>()
  plugins = {
    pause: (name: string) => this.paused.add(name),
    resume: (name: string) => this.paused.delete(name),
    get: (name: string, ignorePaused = false) =>
      name === 'decelerate' && (ignorePaused || !this.paused.has(name)) ? this.decelerate : null,
  }
  get x() {
    return this.position.x
  }
  get y() {
    return this.position.y
  }
  drag = () => this
  pinch = () => this
  wheel = () => this
  clampZoom = vi.fn(() => this)
  resize = vi.fn()
  removeFromParent = vi.fn()
  destroy = vi.fn()
  on(name: string, fn: (...a: unknown[]) => void) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set())
    this.handlers.get(name)!.add(fn)
    return this
  }
  off(name: string, fn: (...a: unknown[]) => void) {
    this.handlers.get(name)?.delete(fn)
    return this
  }
  emit(name: string) {
    for (const fn of this.handlers.get(name) ?? []) fn(this)
  }
}

vi.mock('pixi-viewport', () => ({
  Viewport: class extends FakeViewport {
    constructor() {
      super()
      // O nome `decelerate` é do plugin; o método de mesmo nome encadeia.
      ;(this as unknown as { decelerate: unknown }).decelerate = Object.assign(() => this, this.decelerate)
    }
  },
}))

const { MapCamera } = await import('./MapCamera')

// prefers-reduced-motion controlável.
let reduced = false
const motionListeners = new Set<() => void>()
function setReduced(value: boolean) {
  reduced = value
  for (const fn of motionListeners) fn()
}

beforeEach(() => {
  reduced = false
  motionListeners.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('reduce') && reduced
    },
    addEventListener: (_: string, fn: () => void) => motionListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => motionListeners.delete(fn),
  }))
})

// Cada teste destrói a câmera dele: senão ela continua ouvindo o teclado do document.
const cameras: { destroy(): void }[] = []

afterEach(() => {
  for (const c of cameras.splice(0)) c.destroy()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function setup(area: Area = { x: 320, y: 0, width: 720, height: 900 }) {
  const host = document.createElement('main')
  document.body.appendChild(host)
  const state = { area }
  const app = { screen: { width: 1440, height: 900 }, renderer: { events: {} }, ticker: {} } as unknown as Application
  const changes: { t: Transform; zoom: number }[] = []
  const camera = new MapCamera(app, host, () => state.area, (t, zoom) => changes.push({ t, zoom }))
  cameras.push(camera)
  const viewport = camera.viewport as unknown as FakeViewport
  const last = () => changes.at(-1)!
  const key = (k: string, target: EventTarget = document.body) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  return { camera, viewport, host, state, last, key }
}

/** Ponto do mundo no centro da área livre. */
const centerOf = (t: Transform, a: Area) => ({ x: (a.x + a.width / 2 - t.x) / t.scale, y: (a.y + a.height / 2 - t.y) / t.scale })

describe('MapCamera', () => {
  it('abre com o mapa inteiro, e um mapa novo não mexe na câmera', () => {
    setReduced(true)
    const { camera, last, key } = setup()
    camera.showWorld()
    expect(last().t).toEqual({ x: 320, y: 90, scale: 720 / 1024 })
    expect(last().zoom).toBeCloseTo(1)

    key('+')
    key('ArrowRight')
    const moved = last().t
    expect(moved).not.toEqual({ x: 320, y: 90, scale: 720 / 1024 })
    // Cada campo novo (slider ou seed) chama showWorld de novo: a câmera fica onde está.
    camera.showWorld()
    expect(last().t).toEqual(moved)
  })

  it('redimensionar mantém o ponto no centro da área livre e o zoom relativo', () => {
    setReduced(true)
    const { camera, state, last, key, viewport } = setup()
    camera.showWorld()
    key('+')
    key('+')
    key('ArrowDown')
    const before = last()
    const center = centerOf(before.t, state.area)

    state.area = { x: 320, y: 0, width: 880, height: 1000 }
    camera.resize(1600, 1000)
    expect(viewport.resize).toHaveBeenCalledWith(1600, 1000, 1024, 1024)
    const after = last()
    expect(after.zoom).toBeCloseTo(before.zoom)
    const now = centerOf(after.t, state.area)
    expect(now.x).toBeCloseTo(center.x)
    expect(now.y).toBeCloseTo(center.y)
  })

  it('o movimento reduzido tira a inércia e o deslizamento, e vale ao mudar com o editor aberto', () => {
    const { camera, viewport, last, key } = setup()
    camera.showWorld()
    expect(viewport.paused.has('decelerate')).toBe(false)

    setReduced(true)
    expect(viewport.paused.has('decelerate')).toBe(true)
    key('+')
    expect(last().zoom).toBeCloseTo(1.25)

    setReduced(false)
    expect(viewport.paused.has('decelerate')).toBe(false)
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    key('+')
    viewport.emit('frame-end')
    // Deslizando: no começo ainda perto do 1,25×; no fim dos 350 ms, em 1,5625×.
    expect(last().zoom).toBeCloseTo(1.25)
    now.mockReturnValue(1175)
    viewport.emit('frame-end')
    expect(last().zoom).toBeGreaterThan(1.3)
    expect(last().zoom).toBeLessThan(1.5625)
    now.mockReturnValue(1400)
    viewport.emit('frame-end')
    expect(last().zoom).toBeCloseTo(1.5625)
    now.mockRestore()
  })

  it('focusOn (Centralizar do pin) leva o ponto ao centro e aproxima até o zoom pedido; mais perto, o zoom fica', () => {
    setReduced(true)
    const { camera, state, last, key } = setup()
    camera.focusOn(420, 400, 1.6)
    // Antes do primeiro mapa, nada.
    expect(last()).toBeUndefined()
    camera.showWorld()

    camera.focusOn(420, 400, 1.6)
    expect(last().zoom).toBeCloseTo(1.6)
    let c = centerOf(last().t, state.area)
    expect(c.x).toBeCloseTo(420)
    expect(c.y).toBeCloseTo(400)

    // Os limites de pan valem: perto da borda, o mapa não sai da área livre (o centro para em 320).
    camera.focusOn(100, 400, 1.6)
    expect(centerOf(last().t, state.area).x).toBeCloseTo(320)

    // Já mais perto (1,6 × 1,25² = 2,5×): o zoom fica, e só o centro muda.
    key('+')
    key('+')
    expect(last().zoom).toBeCloseTo(2.5)
    camera.focusOn(500, 520, 1.6)
    expect(last().zoom).toBeCloseTo(2.5)
    c = centerOf(last().t, state.area)
    expect(c.x).toBeCloseTo(500)
    expect(c.y).toBeCloseTo(520)
  })

  it('com o drawer aberto (setRightCover), panTo e focusOn põem o ponto no centro do que sobra à esquerda dele (AC-F3-03)', () => {
    setReduced(true)
    // 1440 × 900 com a sidebar: a área livre vai até a borda direita (1120 px); o drawer cobre 400.
    const area = { x: 320, y: 0, width: 1120, height: 900 }
    const { camera, last, key } = setup(area)
    camera.showWorld()
    key('+')
    key('+')
    key('+')
    const zoom = last().zoom
    camera.setRightCover(400)
    // O centro do que sobra: x de 320 a 1040, em 680.
    const visible = { x: 320, y: 0, width: 720, height: 900 }
    camera.panTo(500, 450)
    expect(last().zoom).toBeCloseTo(zoom)
    let c = centerOf(last().t, visible)
    expect(c.x).toBeCloseTo(500)
    expect(c.y).toBeCloseTo(450)

    camera.focusOn(520, 480, 2.5)
    expect(last().zoom).toBeCloseTo(2.5)
    c = centerOf(last().t, visible)
    expect(c.x).toBeCloseTo(520)
    expect(c.y).toBeCloseTo(480)
  })

  it('no zoom 1×, com o drawer aberto, um ponto perto da borda direita vem para fora dele; ao fechar, o mapa volta aos limites sem ele', () => {
    setReduced(true)
    const area = { x: 320, y: 0, width: 1120, height: 900 }
    const { camera, last } = setup(area)
    camera.showWorld()
    // O mapa (900 px) de 430 a 1330; o drawer começa em 1040. O ponto x 820 (u 0,8) está em 1150, embaixo dele.
    expect(last().t.x).toBeCloseTo(430)
    camera.setRightCover(400)
    camera.panTo(820, 460)
    // A borda direita do mapa para na do drawer (1040): o mapa vai a 140, e o ponto fica em 860, à vista.
    expect(last().t.x).toBeCloseTo(140)
    expect(last().zoom).toBeCloseTo(1)
    expect(140 + 820 * last().t.scale).toBeLessThan(1040)

    // Fechar: sem o drawer, o mapa menor que a área fica inteiro dentro dela (a esquerda em 320 ou mais).
    camera.setRightCover(0)
    expect(last().t.x).toBeCloseTo(320)
  })

  it('ao fechar o drawer, a câmera desliza de volta para os limites; dentro deles, fica onde está', () => {
    const area = { x: 320, y: 0, width: 1120, height: 900 }
    const { camera, last, viewport } = setup(area)
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    camera.showWorld()
    camera.setRightCover(400)
    camera.panTo(820, 460)
    now.mockReturnValue(1400)
    viewport.emit('frame-end')
    expect(last().t.x).toBeCloseTo(140)

    camera.setRightCover(0)
    // Ainda no começo: o limite com o drawer segura o mapa onde estava.
    viewport.emit('frame-end')
    expect(last().t.x).toBeCloseTo(140)
    now.mockReturnValue(1575)
    viewport.emit('frame-end')
    expect(last().t.x).toBeGreaterThan(140)
    expect(last().t.x).toBeLessThan(320)
    now.mockReturnValue(1800)
    viewport.emit('frame-end')
    expect(last().t.x).toBeCloseTo(320)

    // Dentro dos limites sem o drawer, abrir e fechar não mexe na câmera.
    const before = last().t
    camera.setRightCover(400)
    camera.setRightCover(0)
    viewport.emit('frame-end')
    expect(last().t).toEqual(before)
    now.mockRestore()
  })

  it('moving: vale desde o fechar do drawer, antes de qualquer quadro, até o fim do deslizamento', () => {
    const area = { x: 320, y: 0, width: 1120, height: 900 }
    const { camera, last, viewport } = setup(area)
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    camera.showWorld()
    expect(camera.moving).toBe(false)
    camera.setRightCover(400)
    camera.panTo(820, 460)
    expect(camera.moving).toBe(true)
    now.mockReturnValue(1400)
    viewport.emit('frame-end')
    expect(camera.moving).toBe(false)

    // Fechar o drawer começa a volta aos limites: sem nenhum quadro ainda, a posição não mudou, mas a
    // câmera vai andar.
    const before = last().t
    camera.setRightCover(0)
    expect(camera.moving).toBe(true)
    expect(last().t).toEqual(before)
    now.mockReturnValue(1575)
    viewport.emit('frame-end')
    expect(camera.moving).toBe(true)
    now.mockReturnValue(1800)
    viewport.emit('frame-end')
    expect(last().t.x).toBeCloseTo(320)
    expect(camera.moving).toBe(false)

    // Dentro dos limites, abrir e fechar não deixa nada pendente.
    camera.setRightCover(400)
    camera.setRightCover(0)
    expect(camera.moving).toBe(false)
    now.mockRestore()
  })

  /** 1440 × 900 com a sidebar, o drawer aberto e o mapa na esquerda dele (x 140), parado. */
  function drawerOpenAtLeft() {
    const area = { x: 320, y: 0, width: 1120, height: 900 }
    const s = setup(area)
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    s.camera.showWorld()
    s.camera.setRightCover(400)
    s.camera.panTo(820, 460)
    now.mockReturnValue(1400)
    s.viewport.emit('frame-end')
    expect(s.last().t.x).toBeCloseTo(140)
    const at = (ms: number) => {
      now.mockReturnValue(ms)
      s.viewport.emit('frame-end')
      return s.last().t.x
    }
    return { ...s, now, at }
  }

  it('fechar o drawer no meio do deslizamento até o pin não salta: ele termina, e depois o mapa volta aos limites', () => {
    const area = { x: 320, y: 0, width: 1120, height: 900 }
    const { camera, last, viewport } = setup(area)
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    camera.showWorld()
    camera.setRightCover(400)
    camera.panTo(820, 460)
    now.mockReturnValue(1100)
    viewport.emit('frame-end')
    const mid = last().t.x
    expect(mid).toBeLessThan(430)
    expect(mid).toBeGreaterThan(140)

    camera.setRightCover(0)
    now.mockReturnValue(1200)
    viewport.emit('frame-end')
    // Continua do ponto em que estava, sem pular para o destino nem para os limites.
    expect(last().t.x).toBeLessThan(mid)
    expect(last().t.x).toBeGreaterThan(140)
    now.mockReturnValue(1400)
    viewport.emit('frame-end')
    expect(last().t.x).toBeCloseTo(140)
    // Depois, a volta: em 350 ms, dentro dos limites sem o drawer.
    now.mockReturnValue(1800)
    viewport.emit('frame-end')
    expect(last().t.x).toBeCloseTo(320)
    now.mockRestore()
  })

  it('redimensionar ou o minimapa no meio da volta não deixam a faixa do drawer presa: a volta recomeça e termina', () => {
    const { camera, at, now } = drawerOpenAtLeft()
    camera.setRightCover(0)
    at(1400)
    const mid = at(1575)
    expect(mid).toBeGreaterThan(140)
    expect(mid).toBeLessThan(320)
    camera.resize(1440, 900)
    expect(at(1600)).toBeLessThan(320)
    expect(at(2000)).toBeCloseTo(320)

    // De novo, agora com o minimapa (centerOn) no meio da volta.
    camera.setRightCover(400)
    camera.panTo(820, 460)
    expect(at(2400)).toBeCloseTo(140)
    camera.setRightCover(0)
    at(2400)
    at(2575)
    camera.centerOn(800, 460)
    expect(at(3000)).toBeCloseTo(320)
    now.mockRestore()
  })

  it('arrastar no meio da volta não encaixa nos limites de uma vez: a volta recomeça ao soltar', () => {
    const { camera, viewport, at, now } = drawerOpenAtLeft()
    camera.setRightCover(0)
    at(1400)
    const mid = at(1575)
    viewport.emit('drag-start')
    // Durante o gesto, os limites com o drawer continuam: o mapa fica onde o dedo o deixou.
    expect(at(1600)).toBeCloseTo(mid)
    expect(at(2000)).toBeCloseTo(mid)
    viewport.emit('drag-end')
    expect(at(2050)).toBeLessThan(320)
    expect(at(2400)).toBeCloseTo(320)
    now.mockRestore()
  })

  it('focusOn não passa do zoom máximo (4×)', () => {
    setReduced(true)
    const { camera, last } = setup()
    camera.showWorld()
    camera.focusOn(512, 512, 10)
    expect(last().zoom).toBeCloseTo(4)
  })

  it('o teclado não vale com o mapa inerte, com o foco num campo ou dentro de um modal', () => {
    setReduced(true)
    const { camera, host, last, key } = setup()
    camera.showWorld()
    const fit = last().t

    host.inert = true
    expect(key('+')).toBe(true)
    expect(last().t).toEqual(fit)

    host.inert = false
    const input = document.createElement('input')
    document.body.appendChild(input)
    expect(key('ArrowRight', input)).toBe(true)
    expect(last().t).toEqual(fit)

    // Foco num botão dentro de um modal (o assistente): o mapa atrás dele não se mexe.
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const button = document.createElement('button')
    dialog.appendChild(button)
    document.body.appendChild(dialog)
    for (const k of ['+', '-', '0', 'ArrowRight']) expect(key(k, button), k).toBe(true)
    expect(last().t).toEqual(fit)

    // Fora disso o atalho vale e não deixa o navegador agir (preventDefault). No 1× o mapa tem a
    // largura da área e a seta → bate no limite; o + mostra que o atalho foi aceito.
    expect(key('+')).toBe(false)
    expect(last().t).not.toEqual(fit)
  })

  it('ao bater no limite, a inércia para só no eixo que bateu', () => {
    const { camera, viewport } = setup()
    camera.showWorld()
    viewport.decelerate.x = 5
    viewport.decelerate.y = 3
    // Empurra o mapa para fora só na horizontal.
    viewport.position.set(5000, viewport.y)
    viewport.emit('moved')
    expect(viewport.x).toBe(320)
    expect(viewport.decelerate.x).toBe(0)
    expect(viewport.decelerate.y).toBe(3)
  })

  it('destroy solta o teclado e o matchMedia', () => {
    setReduced(true)
    const { camera, viewport, last, key } = setup()
    camera.showWorld()
    const fit = last().t
    camera.destroy()
    key('+')
    expect(last().t).toEqual(fit)
    expect(motionListeners.size).toBe(0)
    expect(viewport.destroy).toHaveBeenCalled()
  })
})
