import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_SIZE,
  clampTransform,
  easeCamera,
  fitScale,
  fitView,
  isFieldTarget,
  keyAction,
  lerpView,
  mapRect,
  relativeZoom,
  toTransform,
  toView,
  zoomAt,
  type Area,
} from './camera'

// Área livre do desktop 1440×900: entre a sidebar (320) e o drawer (400).
const AREA: Area = { x: 320, y: 0, width: 720, height: 900 }
const key = (k: Partial<KeyboardEvent>) => keyAction({ key: '', code: '', ctrlKey: false, altKey: false, metaKey: false, ...k })

describe('enquadramento', () => {
  it('o zoom 1× é o mapa inteiro centrado na área livre', () => {
    const t = toTransform(fitView(AREA), AREA)
    expect(mapRect(t)).toEqual({ x: 320, y: 90, width: 720, height: 720 })
    expect(relativeZoom(t.scale, AREA)).toBeCloseTo(1)
  })

  it('toView desfaz toTransform', () => {
    const view = { cx: 300, cy: 700, scale: 1.7 }
    const back = toView(toTransform(view, AREA), AREA)
    expect(back.cx).toBeCloseTo(300)
    expect(back.cy).toBeCloseTo(700)
    expect(back.scale).toBe(1.7)
  })
})

describe('limites (AC-F2-05)', () => {
  const fit = fitScale(AREA)

  it('o zoom fica entre 0,4× e 4×', () => {
    const near = clampTransform({ x: 0, y: 0, scale: fit * 10 }, AREA)
    const far = clampTransform({ x: 0, y: 0, scale: fit * 0.1 }, AREA)
    expect(relativeZoom(near.scale, AREA)).toBeCloseTo(MAX_ZOOM)
    expect(relativeZoom(far.scale, AREA)).toBeCloseTo(MIN_ZOOM)
  })

  it('aproximado, pelo menos metade da área livre fica com mapa', () => {
    const scale = fit * 3
    const size = WORLD_SIZE * scale
    // Pan muito para a direita e para baixo: o mapa sairia pela borda de cima e da esquerda.
    const t = clampTransform({ x: 5000, y: 5000, scale }, AREA)
    expect(t.x).toBe(AREA.x + AREA.width / 2)
    expect(t.y).toBe(AREA.y + AREA.height / 2)
    const t2 = clampTransform({ x: -1e6, y: -1e6, scale }, AREA)
    expect(t2.x + size).toBe(AREA.x + AREA.width / 2)
    expect(t2.y + size).toBe(AREA.y + AREA.height / 2)
  })

  it('afastado, o mapa pequeno fica inteiro dentro da área livre', () => {
    const scale = fit * MIN_ZOOM
    const size = WORLD_SIZE * scale
    const t = clampTransform({ x: -1e6, y: 1e6, scale }, AREA)
    expect(t.x).toBe(AREA.x)
    expect(t.y + size).toBe(AREA.y + AREA.height)
  })

  it('dentro dos limites, nada muda', () => {
    const t = toTransform(fitView(AREA), AREA)
    expect(clampTransform(t, AREA)).toEqual(t)
  })
})

describe('zoom no cursor (AC-F2-02)', () => {
  it('o ponto do mundo sob o cursor fica parado', () => {
    const t = toTransform(fitView(AREA), AREA)
    const cursor = { x: 500, y: 300 }
    const world = { x: (cursor.x - t.x) / t.scale, y: (cursor.y - t.y) / t.scale }
    const z = zoomAt(t, 2, cursor, AREA)
    expect(z.scale).toBeCloseTo(t.scale * 2)
    expect(z.x + world.x * z.scale).toBeCloseTo(cursor.x)
    expect(z.y + world.y * z.scale).toBeCloseTo(cursor.y)
  })

  it('não passa do zoom máximo', () => {
    const t = toTransform({ ...fitView(AREA), scale: fitScale(AREA) * 3.9 }, AREA)
    expect(relativeZoom(zoomAt(t, 2, { x: 600, y: 400 }, AREA).scale, AREA)).toBeCloseTo(MAX_ZOOM)
  })
})

describe('deslizamento', () => {
  it('a curva vai de 0 a 1, sempre crescendo', () => {
    expect(easeCamera(0)).toBe(0)
    expect(easeCamera(1)).toBe(1)
    let last = 0
    for (let i = 1; i <= 20; i++) {
      const v = easeCamera(i / 20)
      expect(v).toBeGreaterThanOrEqual(last)
      last = v
    }
    // Começa devagar e chega rápido perto do fim (desacelera no fim).
    expect(easeCamera(0.5)).toBeGreaterThan(0.7)
  })

  it('interpola o centro em linha reta e a escala na escala logarítmica', () => {
    const mid = lerpView({ cx: 0, cy: 0, scale: 1 }, { cx: 100, cy: 50, scale: 4 }, 0.5)
    expect(mid).toEqual({ cx: 50, cy: 25, scale: 2 })
  })
})

describe('atalhos (AC-F2-04)', () => {
  it('setas e WASD fazem pan', () => {
    expect(key({ key: 'ArrowUp' })).toEqual({ type: 'pan', dx: 0, dy: -1 })
    expect(key({ key: 'ArrowRight' })).toEqual({ type: 'pan', dx: 1, dy: 0 })
    expect(key({ key: 'w', code: 'KeyW' })).toEqual({ type: 'pan', dx: 0, dy: -1 })
    expect(key({ key: 'a', code: 'KeyA' })).toEqual({ type: 'pan', dx: -1, dy: 0 })
    expect(key({ key: 'S', code: 'KeyS' })).toEqual({ type: 'pan', dx: 0, dy: 1 })
    expect(key({ key: 'd', code: 'KeyD' })).toEqual({ type: 'pan', dx: 1, dy: 0 })
  })

  it('+ e − fazem zoom, e 0 centraliza', () => {
    expect(key({ key: '+' })).toMatchObject({ type: 'zoom' })
    expect(key({ key: '=' })).toMatchObject({ type: 'zoom' })
    expect(key({ code: 'NumpadAdd' })).toMatchObject({ type: 'zoom' })
    const zin = key({ key: '+' })
    const zout = key({ key: '-' })
    expect(zin?.type === 'zoom' && zin.factor).toBeGreaterThan(1)
    expect(zout?.type === 'zoom' && zout.factor).toBeLessThan(1)
    expect(key({ key: '0' })).toEqual({ type: 'center' })
  })

  it('com Ctrl, Alt ou Meta não é atalho (zoom do navegador)', () => {
    expect(key({ key: '0', ctrlKey: true })).toBeNull()
    expect(key({ key: '-', metaKey: true })).toBeNull()
    expect(key({ key: 'ArrowLeft', altKey: true })).toBeNull()
    expect(key({ key: 'x', code: 'KeyX' })).toBeNull()
  })

  it('campos guardam o teclado para si', () => {
    document.body.innerHTML = `
      <input id="i"><textarea id="t"></textarea><select id="s"></select>
      <div contenteditable="true" id="c"><b id="cb">x</b></div>
      <span role="slider" id="r" tabindex="0"></span>
      <button id="b">ok</button>`
    for (const id of ['i', 't', 's', 'r']) expect(isFieldTarget(document.getElementById(id))).toBe(true)
    expect(isFieldTarget(document.getElementById('c'))).toBe(true)
    expect(isFieldTarget(document.getElementById('cb'))).toBe(true)
    expect(isFieldTarget(document.getElementById('b'))).toBe(false)
    expect(isFieldTarget(document.body)).toBe(false)
    expect(isFieldTarget(null)).toBe(false)
  })
})
