import { describe, expect, it } from 'vitest'
import { DOUBLE_CLICK_MS, addDraftPoint, curvePath, draftToRoad, isDoubleTap, roadHint } from './drawRoad'

describe('Desenhar estrada: o estado (AC-F5-04, AC-F5-05)', () => {
  it('cada clique adiciona um ponto; o mesmo pin ou o mesmo lugar seguido não repete', () => {
    let d = addDraftPoint([], { u: 0.1, v: 0.1 })
    d = addDraftPoint(d, { u: 0.1, v: 0.1 })
    expect(d).toHaveLength(1)
    d = addDraftPoint(d, { u: 0.3, v: 0.3, pin: 'a' })
    d = addDraftPoint(d, { u: 0.3, v: 0.3, pin: 'a' })
    expect(d).toHaveLength(2)
    // Um ponto do mapa no mesmo lugar de um pin não é o pin: entra.
    d = addDraftPoint(d, { u: 0.3, v: 0.3 })
    expect(d).toHaveLength(3)
  })

  it('termina só com 2 pontos ou mais, e as pontas num pin ficam ligadas', () => {
    expect(draftToRoad([])).toBeNull()
    expect(draftToRoad([{ u: 0.1, v: 0.1 }])).toBeNull()
    expect(draftToRoad([{ u: 0.1, v: 0.1 }, { u: 0.2, v: 0.2 }])).toEqual({ points: [{ u: 0.1, v: 0.1 }, { u: 0.2, v: 0.2 }] })
    expect(
      draftToRoad([
        { u: 0.1, v: 0.1, pin: 'a' },
        { u: 0.15, v: 0.2, pin: 'meio' },
        { u: 0.2, v: 0.2, pin: 'b' },
      ]),
    ).toEqual({ points: [{ u: 0.1, v: 0.1 }, { u: 0.15, v: 0.2 }, { u: 0.2, v: 0.2 }], from: 'a', to: 'b' })
    // Só o fim num pin.
    expect(draftToRoad([{ u: 0.1, v: 0.1 }, { u: 0.2, v: 0.2, pin: 'b' }])).toEqual({ points: [{ u: 0.1, v: 0.1 }, { u: 0.2, v: 0.2 }], to: 'b' })
  })

  it('a dica muda depois do primeiro ponto', () => {
    expect(roadHint([])).toBe('Clique no mapa ou num pin para começar a estrada')
    expect(roadHint([{ u: 0, v: 0 }])).toBe('Clique para adicionar pontos · Enter ou duplo clique termina · Esc cancela')
  })

  it('duplo clique: dois cliques perto, em pouco tempo, do mesmo tipo de ponteiro', () => {
    const a = { t: 1000, x: 100, y: 100, touch: false }
    expect(isDoubleTap(null, a)).toBe(false)
    expect(isDoubleTap(a, { ...a, t: 1000 + DOUBLE_CLICK_MS, x: 105 })).toBe(true)
    expect(isDoubleTap(a, { ...a, t: 1001 + DOUBLE_CLICK_MS })).toBe(false)
    expect(isDoubleTap(a, { ...a, t: 1100, x: 120 })).toBe(false)
    // O dedo tem mais folga.
    const t = { ...a, touch: true }
    expect(isDoubleTap(t, { ...t, t: 1100, x: 120 })).toBe(true)
    expect(isDoubleTap(a, { ...t, t: 1100 })).toBe(false)
  })

  it('a prévia é a curva suavizada pelos pontos', () => {
    expect(curvePath([{ x: 0, y: 0 }])).toBe('')
    expect(curvePath([{ x: 0, y: 0 }, { x: 60, y: 0 }])).toBe('M0 0 C10 0 50 0 60 0')
  })
})
