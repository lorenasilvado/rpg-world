import { describe, expect, it } from 'vitest'
import { PIN_TYPES, type PinType } from '../../state/pinTypes'
import {
  GROUP_DISTANCE_PX,
  GROUP_LIFT_PX,
  GROUP_ZOOM,
  createPinGrouper,
  groupAt,
  groupPins,
  groupToScreen,
  shownPins,
  type PinTypeLayers,
} from './pinGroups'

/** Um pin no ponto (x, y) do mundo (0–1024). */
const pin = (id: string, x: number, y: number, type: string = 'cidade') => ({ id, type, pos: { u: x / 1024, v: y / 1024 } })

const all: PinTypeLayers = Object.fromEntries(PIN_TYPES.map((t) => [t.id, true])) as Record<PinType, boolean>
const without = (...types: PinType[]): PinTypeLayers => ({ ...all, ...Object.fromEntries(types.map((t) => [t, false])) })

describe('ocultar por tipo (AC-F3-15)', () => {
  it('com todos os tipos ligados, todos os pins ficam à vista', () => {
    const pins = [pin('a', 10, 10), pin('b', 20, 20, 'npc')]
    expect(shownPins(pins, all).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('esconde os pins dos tipos desligados; um tipo desconhecido conta como Personalizado', () => {
    const pins = [pin('a', 10, 10), pin('b', 20, 20, 'npc'), pin('c', 30, 30, 'xyz'), pin('d', 40, 40, 'custom')]
    expect(shownPins(pins, without('cidade')).map((p) => p.id)).toEqual(['b', 'c', 'd'])
    expect(shownPins(pins, without('custom')).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('o pin selecionado fica à vista mesmo com o tipo escondido', () => {
    const pins = [pin('a', 10, 10), pin('b', 20, 20)]
    expect(shownPins(pins, without('cidade'), 'b').map((p) => p.id)).toEqual(['b'])
  })
})

describe('agrupamento (AC-F3-14)', () => {
  // Escala 0,5 px por unidade: 34 px na tela são 68 unidades do mundo.
  const scale = 0.5
  const zoom = 0.6

  it('a partir do zoom 0,8×, nada se agrupa', () => {
    const pins = [pin('a', 100, 100), pin('b', 101, 100)]
    expect(groupPins(pins, scale, GROUP_ZOOM).groups).toEqual([])
    expect(groupPins(pins, scale, 1.2).groups).toEqual([])
  })

  it('abaixo de 0,8×, pins a menos de 34 px na tela viram um grupo no ponto médio deles', () => {
    const pins = [pin('a', 100, 100), pin('b', 160, 100), pin('c', 400, 400)]
    const { groups, grouped } = groupPins(pins, scale, zoom)
    expect(groups).toEqual([{ ids: ['a', 'b'], x: 130, y: 100 }])
    expect([...grouped]).toEqual(['a', 'b'])
  })

  it('a 34 px ou mais, os pins ficam soltos', () => {
    const d = GROUP_DISTANCE_PX / scale
    expect(groupPins([pin('a', 100, 100), pin('b', 100 + d, 100)], scale, zoom).groups).toEqual([])
    expect(groupPins([pin('a', 100, 100), pin('b', 100 + d - 0.01, 100)], scale, zoom).groups).toHaveLength(1)
  })

  it('a distância é a da tela: afastar junta pins que no zoom maior ficavam soltos', () => {
    const pins = [pin('a', 100, 100), pin('b', 150, 100)]
    // 50 unidades: 25 px na escala 0,5 (agrupa), 50 px na escala 1 (solto).
    expect(groupPins(pins, 0.5, zoom).groups).toHaveLength(1)
    expect(groupPins(pins, 1, zoom).groups).toHaveLength(0)
  })

  it('cada pin livre junta os livres seguintes perto dele, na ordem da lista (sem corrente)', () => {
    // a–b a 60 unidades, b–c a 60 unidades, a–c a 120: a junta b; c fica solto.
    const pins = [pin('a', 100, 100), pin('b', 160, 100), pin('c', 220, 100)]
    expect(groupPins(pins, scale, zoom).groups.map((g) => g.ids)).toEqual([['a', 'b']])
  })

  it('o selecionado e o arrastado (keep) nunca entram num grupo', () => {
    const pins = [pin('a', 100, 100), pin('b', 101, 100), pin('c', 102, 100)]
    const { groups, grouped } = groupPins(pins, scale, zoom, new Set(['a']))
    expect(groups.map((g) => g.ids)).toEqual([['b', 'c']])
    expect(grouped.has('a')).toBe(false)
    expect(groupPins(pins, scale, zoom, new Set(['a', 'b'])).groups).toEqual([])
  })

  it('200 pins numa área pequena dão poucos grupos, e cada pin está em no máximo um', () => {
    const pins = Array.from({ length: 200 }, (_, i) => pin(`p${i}`, 500 + (i % 20) * 3, 500 + Math.floor(i / 20) * 3))
    const { groups, grouped } = groupPins(pins, scale, zoom)
    const ids = groups.flatMap((g) => g.ids)
    expect(new Set(ids).size).toBe(ids.length)
    expect(grouped.size).toBe(200)
    expect(groups.length).toBeLessThanOrEqual(4)
  })

  it('o grupo fica 16 px acima do ponto médio na tela, e o clique acerta o círculo com o halo', () => {
    const cam = { scale: 0.5, view: { x: 0, y: 0 }, origin: { x: 320, y: 0 } }
    const group = { ids: ['a', 'b'], x: 200, y: 400 }
    expect(groupToScreen(group, cam)).toEqual({ x: 420, y: 200 - GROUP_LIFT_PX })
    expect(groupAt(420, 184, [group], cam)).toBe(group)
    expect(groupAt(420 + 21, 184, [group], cam)).toBe(group)
    expect(groupAt(420 + 23, 184, [group], cam)).toBeNull()
  })
})

describe('createPinGrouper', () => {
  it('reaproveita o resultado no pan e refaz quando a escala, as camadas ou a seleção mudam', () => {
    const grouper = createPinGrouper<ReturnType<typeof pin>>()
    const pins = [pin('a', 100, 100), pin('b', 110, 100)]
    const first = grouper(pins, all, 0.5, 0.6, null, null)
    expect(first.groups).toHaveLength(1)
    expect(grouper(pins, all, 0.5, 0.6, null, null)).toBe(first)
    expect(grouper(pins, all, 0.4, 0.5, null, null)).not.toBe(first)
    expect(grouper(pins, without('cidade'), 0.4, 0.5, null, null).groups).toEqual([])
    expect(grouper(pins, all, 0.4, 0.5, 'a', null).groups).toEqual([])
    // Acima do limiar, a escala não importa: sem grupos, o mesmo resultado.
    const high = grouper(pins, all, 2, 1.5, null, null)
    expect(grouper(pins, all, 3, 2.2, null, null)).toBe(high)
  })
})
