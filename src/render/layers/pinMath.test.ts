import { describe, expect, it } from 'vitest'
import { PIN_DROP_MS, PIN_PULSE_MS, drawOrder, dropFrame, pinAt, pinToScreen, pinToWorld, pulseFrame, screenToPin, showLabel, worldToPin } from './pinMath'

// A câmera da interface: 2 px por unidade do mundo, a área livre começa em (320, 0) da área do mapa,
// e à vista está o mundo a partir de (100, 200).
const cam = { scale: 2, view: { x: 100, y: 200 }, origin: { x: 320, y: 0 } }

const pin = (id: string, u: number, v: number) => ({ id, pos: { u, v } })

describe('conversão tela ↔ (u, v) (AC-F3-01)', () => {
  it('(u, v) de 0 a 1 vira o ponto do mundo de 0 a 1024, e volta', () => {
    expect(pinToWorld({ u: 0.5, v: 0.25 })).toEqual({ x: 512, y: 256 })
    expect(worldToPin({ x: 512, y: 256 })).toEqual({ u: 0.5, v: 0.25 })
  })

  it('o ponto da tela vira (u, v) pela câmera, e o pin volta ao mesmo ponto da tela', () => {
    const pos = screenToPin(320 + 2 * 412, 2 * 312, cam)
    expect(pos).toEqual({ u: 512 / 1024, v: 512 / 1024 })
    expect(pinToScreen(pos!, cam)).toEqual({ x: 320 + 2 * 412, y: 2 * 312 })
  })

  it('fora do mapa (o fundo do canvas) não há posição', () => {
    expect(screenToPin(320 - 2 * 101, 10, cam)).toBeNull()
    expect(screenToPin(320, 2 * (1024 - 200) + 2, cam)).toBeNull()
    expect(screenToPin(320 - 2 * 100, 2 * (1024 - 200), cam)).toEqual({ u: 0, v: 1 })
  })
})

describe('pin sob o ponteiro', () => {
  it('acerta o desenho do pin (32 × 38,4 px acima da âncora na base central), e erra fora dele', () => {
    const p = pin('a', 0.5, 0.5)
    const s = pinToScreen(p.pos, cam)
    expect(pinAt(s.x, s.y - 1, [p], cam)).toBe(p)
    expect(pinAt(s.x - 15, s.y - 38, [p], cam)).toBe(p)
    expect(pinAt(s.x, s.y + 2, [p], cam)).toBeNull()
    expect(pinAt(s.x + 17, s.y - 10, [p], cam)).toBeNull()
    expect(pinAt(s.x, s.y - 40, [p], cam)).toBeNull()
  })

  it('o selecionado e o do hover ficam 1,1× maiores também no clique', () => {
    const p = pin('a', 0.5, 0.5)
    const s = pinToScreen(p.pos, cam)
    expect(pinAt(s.x + 17, s.y - 10, [p], cam)).toBeNull()
    expect(pinAt(s.x + 17, s.y - 10, [p], cam, 'a')).toBe(p)
  })

  it('de dois pins sobrepostos, pega o de cima: o mais ao sul, ou o selecionado', () => {
    const north = pin('n', 0.5, 0.5)
    const south = pin('s', 0.5, 0.5 + 10 / 2048)
    const s = pinToScreen(north.pos, cam)
    expect(pinAt(s.x, s.y - 2, [south, north], cam)).toBe(south)
    expect(pinAt(s.x, s.y - 2, [south, north], cam, 'n')).toBe(north)
  })
})

describe('ordem de desenho', () => {
  it('do norte para o sul, com o hover e o selecionado por último', () => {
    const pins = [pin('c', 0, 0.9), pin('a', 0, 0.1), pin('b', 0, 0.5)]
    expect(drawOrder(pins, null, null).map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(drawOrder(pins, 'a', 'b').map((p) => p.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('rótulo (AC-F3-02)', () => {
  it('aparece a partir do zoom 1,5×, no hover e na seleção', () => {
    expect(showLabel(1.49, false, false)).toBe(false)
    expect(showLabel(1.5, false, false)).toBe(true)
    expect(showLabel(4, false, false)).toBe(true)
    expect(showLabel(0.4, true, false)).toBe(true)
    expect(showLabel(1, false, true)).toBe(true)
  })
})

describe('animações', () => {
  it('o quique começa no alto e invisível, assenta em 460 ms e fica parado', () => {
    expect(dropFrame(0)).toMatchObject({ dy: -36, alpha: 0 })
    const mid = dropFrame(PIN_DROP_MS * 0.55)
    expect(mid.dy).toBeCloseTo(0, 5)
    expect(mid.sx).toBeCloseTo(1.06, 5)
    expect(mid.sy).toBeCloseTo(0.9, 5)
    expect(dropFrame(PIN_DROP_MS * 0.75).dy).toBeCloseTo(-6, 5)
    expect(dropFrame(PIN_DROP_MS)).toEqual({ dy: 0, sx: 1, sy: 1, alpha: 1 })
    expect(dropFrame(5000)).toEqual({ dy: 0, sx: 1, sy: 1, alpha: 1 })
  })

  it('a pulsação cresce de 0,7 a 1,8× e some, em laço de 1,6 s', () => {
    expect(pulseFrame(0)).toEqual({ scale: 0.7, alpha: 0.9 })
    const late = pulseFrame(PIN_PULSE_MS - 1)
    expect(late.scale).toBeCloseTo(1.8, 1)
    expect(late.alpha).toBeLessThan(0.01)
    expect(pulseFrame(PIN_PULSE_MS)).toEqual(pulseFrame(0))
    expect(pulseFrame(PIN_PULSE_MS * 0.5).scale).toBeGreaterThan(1.25)
  })
})
