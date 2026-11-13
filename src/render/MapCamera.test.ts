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

  it('o teclado não vale com o mapa inerte nem com o foco num campo', () => {
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
