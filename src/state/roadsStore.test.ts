import { describe, expect, it } from 'vitest'
import type { Pin, Road } from '../persistence/types'
import { createPinsStore } from './pinsStore'
import { NEW_ROAD_NAME, createRoadsStore, roadsWithPins } from './roadsStore'

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

  it('addRoad cria "Nova estrada", tipo Estrada, ligada aos pins, e a deixa selecionada (AC-F5-04, AC-F5-05)', () => {
    const pins = createPinsStore([pin('a'), pin('b')])
    let n = 0
    const roads = createRoadsStore([], pins, { newId: () => 'r' + ++n })
    pins.getState().select('a')
    expect(roads.getState().addRoad({ points: [{ u: 0.1, v: 0.1 }] })).toBeNull()
    expect(roads.getState().roads).toEqual([])
    const created = roads.getState().addRoad({ points: [{ u: 0.5, v: 0.5 }, { u: 0.2, v: 0.4 }], from: 'a', to: 'b' })
    expect(created).toEqual({ id: 'r1', name: NEW_ROAD_NAME, kind: 'road', points: [{ u: 0.5, v: 0.5 }, { u: 0.2, v: 0.4 }], from: 'a', to: 'b' })
    expect(roads.getState().roads).toEqual([created])
    expect(roads.getState().selectedId).toBe('r1')
    // Uma seleção só: o pin deixa de estar selecionado, e selecionar um pin tira a da estrada.
    expect(pins.getState().selectedId).toBeNull()
    pins.getState().select('b')
    expect(roads.getState().selectedId).toBeNull()
    roads.getState().select('r1')
    expect(pins.getState().selectedId).toBeNull()
    // Sem pin nas pontas, a estrada não tem from nem to.
    expect(roads.getState().addRoad({ points: [{ u: 0, v: 0 }, { u: 1, v: 1 }] })).not.toHaveProperty('from')
  })

  it('addRoad não liga a ponta a um pin que saiu no meio do desenho (a ponta fica no ponto dela)', () => {
    const pins = createPinsStore([pin('a'), pin('b')])
    const roads = createRoadsStore([], pins, { newId: () => 'r' })
    pins.getState().removePin('b')
    const created = roads.getState().addRoad({ points: [{ u: 0.5, v: 0.5 }, { u: 0.9, v: 0.9 }], from: 'a', to: 'b' })
    expect(created).toEqual({ id: 'r', name: NEW_ROAD_NAME, kind: 'road', points: [{ u: 0.5, v: 0.5 }, { u: 0.9, v: 0.9 }], from: 'a' })
    expect(roads.getState().roads).toEqual([created])
  })

  it('a estrada que sai da lista deixa de estar selecionada', () => {
    const pins = createPinsStore([pin('a')])
    const roads = createRoadsStore([], pins, { newId: () => 'r' })
    roads.getState().addRoad({ points: [{ u: 0.5, v: 0.5 }, { u: 0.9, v: 0.9 }], from: 'a' })
    roads.getState().replaceRoads([...roads.getState().roads])
    expect(roads.getState().selectedId).toBe('r')
    pins.getState().removePin('a')
    expect(roads.getState().roads).toEqual([])
    expect(roads.getState().selectedId).toBeNull()
    roads.getState().addRoad({ points: [{ u: 0.5, v: 0.5 }, { u: 0.9, v: 0.9 }] })
    roads.getState().replaceRoads([])
    expect(roads.getState().selectedId).toBeNull()
  })


  it('updateRoad muda o nome (sem os espaços das pontas) e o tipo; nome vazio ou igual não muda nada (AC-F5-07)', () => {
    const roads = createRoadsStore([road('r1'), road('r2')])
    const other = roads.getState().roads[1]
    roads.getState().updateRoad('r1', { name: '  Estrada Real ' })
    expect(roads.getState().roads[0]).toMatchObject({ name: 'Estrada Real', kind: 'road' })
    expect(roads.getState().roads[1]).toBe(other)
    roads.getState().updateRoad('r1', { kind: 'sea' })
    expect(roads.getState().roads[0].kind).toBe('sea')
    const before = roads.getState().roads
    roads.getState().updateRoad('r1', { name: '   ' })
    roads.getState().updateRoad('r1', { name: 'Estrada Real', kind: 'sea' })
    roads.getState().updateRoad('sumiu', { name: 'X' })
    expect(roads.getState().roads).toBe(before)
  })

  it('removeRoad tira a estrada e a seleção dela (AC-F5-08)', () => {
    const roads = createRoadsStore([road('r1'), road('r2')])
    roads.getState().select('r1')
    expect(roads.getState().removeRoad('r2')).toBe(true)
    expect(roads.getState().selectedId).toBe('r1')
    expect(roads.getState().removeRoad('r1')).toBe(true)
    expect(roads.getState().roads).toEqual([])
    expect(roads.getState().selectedId).toBeNull()
    expect(roads.getState().removeRoad('r1')).toBe(false)
  })
})
