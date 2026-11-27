import { describe, expect, it } from 'vitest'
import type { CityNetwork } from '../../core'
import type { Pin, Road } from '../../persistence/types'
import { cityGroups, cityPins, connectMessage, isolatedCount, networkRoads } from './cityNetwork'

const pin = (id: string, type = 'cidade'): Pin => ({
  id,
  type,
  name: id.toUpperCase(),
  pos: { u: 0.5, v: 0.5 },
  icon: { kind: 'builtin', key: type },
  description: '',
  tags: [],
  fields: {},
})
const road = (from?: string, to?: string, middle: string[] = []): Road => ({
  id: `${from}-${to}`,
  name: 'r',
  kind: 'road',
  points: [{ u: 0, v: 0 }, ...middle.map((pin) => ({ u: 0.5, v: 0.5, pin })), { u: 1, v: 1 }],
  ...(from ? { from } : {}),
  ...(to ? { to } : {}),
})

describe('Conectar cidades: as cidades e os grupos (AC-F5-14)', () => {
  it('só os pins do tipo Cidade', () => {
    expect(cityPins([pin('a'), pin('n', 'npc'), pin('b'), pin('l', 'local')]).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('as cidades ligadas por estrada, por qualquer caminho e pelos pins do meio, ficam no mesmo grupo', () => {
    const cities = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => pin(id))
    const roads = [
      road('a', 'b'),
      // b–(npc)–c: ligadas por um pin de outro tipo no caminho.
      road('b', 'n'),
      road('n', 'c'),
      // d–e–f numa estrada só, com e no meio (#285).
      road('d', 'f', ['e']),
      // Uma estrada solta não liga nada.
      road(),
    ]
    expect(cityGroups(cities, roads)).toEqual([0, 0, 0, 1, 1, 1])
    expect(cityGroups(cities, [])).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('as estradas da malha: "Rota de A a B", sem a cidade excluída nem o par que já ficou ligado', () => {
    const cities = [pin('a'), pin('b'), pin('c'), pin('d')]
    const network: CityNetwork = {
      links: [
        { from: 0, to: 1, points: [{ u: 0, v: 0 }, { u: 1, v: 0 }], cost: 1 },
        { from: 1, to: 2, points: [{ u: 1, v: 0 }, { u: 1, v: 1 }], cost: 1 },
        { from: 2, to: 3, points: [{ u: 1, v: 1 }, { u: 0, v: 1 }], cost: 1 },
      ],
      isolated: [],
    }
    expect(networkRoads(network, cities, cities, []).map((r) => r.name)).toEqual(['Rota de A a B', 'Rota de B a C', 'Rota de C a D'])
    expect(networkRoads(network, cities, cities, [])[0]).toMatchObject({ from: 'a', to: 'b', points: network.links[0].points })
    // "d" saiu no meio do cálculo; b–c ganhou uma estrada (um Refazer, por exemplo).
    const now = cities.filter((c) => c.id !== 'd')
    expect(networkRoads(network, cities, now, [road('b', 'c')]).map((r) => r.name)).toEqual(['Rota de A a B'])
  })

  it('as cidades sem caminho não contam a que saiu no meio do cálculo', () => {
    const cities = [pin('a'), pin('b'), pin('c')]
    const network: CityNetwork = { links: [], isolated: [0, 2] }
    expect(isolatedCount(network, cities, cities)).toBe(2)
    expect(isolatedCount(network, cities, [pin('a'), pin('b')])).toBe(1)
  })

  it('o texto do toast', () => {
    expect(connectMessage(3, 0)).toBe('3 estradas criadas')
    expect(connectMessage(1, 0)).toBe('1 estrada criada')
    expect(connectMessage(2, 1)).toBe('2 estradas criadas · 1 cidade sem caminho por terra')
    expect(connectMessage(0, 2)).toBe('Nenhuma estrada nova · 2 cidades sem caminho por terra')
    expect(connectMessage(0, 0)).toBe('Nenhuma estrada nova: as cidades já estão ligadas')
  })
})
