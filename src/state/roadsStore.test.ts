import { describe, expect, it } from 'vitest'
import type { Pin, Road } from '../persistence/types'
import { createPinsStore } from './pinsStore'
import { createRoadsStore, roadsWithPins } from './roadsStore'

const pin = (id: string): Pin => ({ id, type: 'cidade', name: id, pos: { u: 0.5, v: 0.5 }, icon: { kind: 'builtin', key: 'cidade' }, description: '', tags: [], fields: {} })
const road = (id: string, from?: string, to?: string): Road => ({
  id,
  name: id,
  kind: 'road',
  points: [
    { u: 0.1, v: 0.1 },
    { u: 0.2, v: 0.2 },
  ],
  ...(from ? { from } : {}),
  ...(to ? { to } : {}),
})

describe('roadsStore (AC-F5-01, AC-F5-02)', () => {
  it('ao abrir, um vínculo com um pin que não existe sai, e a estrada fica', () => {
    const pins = createPinsStore([pin('a')])
    const roads = createRoadsStore([road('r1', 'a', 'sumiu'), road('r2')], pins)
    expect(roads.getState().roads).toEqual([{ ...road('r1'), from: 'a' }, road('r2')])
  })

  it('excluir um pin exclui as estradas ligadas a ele, e só elas', () => {
    const pins = createPinsStore([pin('a'), pin('b'), pin('c')])
    const roads = createRoadsStore([road('ab', 'a', 'b'), road('bc', 'b', 'c'), road('livre')], pins)
    pins.getState().removePin('a')
    expect(roads.getState().roads.map((r) => r.id)).toEqual(['bc', 'livre'])
    // Mudar um pin sem excluir nenhum não troca a lista.
    const before = roads.getState().roads
    pins.getState().rename('b', 'Bree')
    expect(roads.getState().roads).toBe(before)
  })

  it('depois do dispose, não ouve mais os pins', () => {
    const pins = createPinsStore([pin('a')])
    const roads = createRoadsStore([road('r', 'a')], pins)
    roads.getState().dispose()
    pins.getState().removePin('a')
    expect(roads.getState().roads).toHaveLength(1)
  })

  it('roadsWithPins devolve a mesma lista quando nada sai', () => {
    const list = [road('r', 'a')]
    expect(roadsWithPins(list, [pin('a')])).toBe(list)
    expect(roadsWithPins(list, [])).toEqual([])
  })
})
