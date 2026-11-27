import type { CityNetwork } from '../../core'
import type { Pin, Road } from '../../persistence/types'
import { linkedPins, type RoadsState } from '../../state/roadsStore'
import { routeName } from './autoRoute'

/**
 * "Conectar cidades" (estradas.md, AC-F5-14), em TS puro: quais pins são cidades, quais já estão
 * ligadas por estrada, as estradas novas da malha e o texto do toast.
 */

/** O tipo de pin das cidades. */
export const CITY_TYPE = 'cidade'

/** Com quantas cidades o botão "Conectar cidades" habilita. */
export const MIN_CITIES = 2

export const cityPins = (pins: readonly Pin[]): Pin[] => pins.filter((p) => p.type === CITY_TYPE)

/**
 * O grupo de cada cidade: o mesmo número para as que já estão ligadas por estrada, por qualquer
 * caminho de estradas (cada estrada liga todos os pins dela, as pontas e os do meio, de qualquer
 * tipo e tipo de via). A malha não liga duas cidades do mesmo grupo.
 */
export function cityGroups(cities: readonly Pin[], roads: readonly Road[]): number[] {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while ((parent.get(root) ?? root) !== root) root = parent.get(root)!
    parent.set(id, root)
    return root
  }
  for (const road of roads) {
    const ids = linkedPins(road)
    for (let k = 1; k < ids.length; k++) {
      const a = find(ids[0])
      const b = find(ids[k])
      if (a !== b) parent.set(b, a)
    }
  }
  const number = new Map<string, number>()
  return cities.map((c) => {
    const root = find(c.id)
    if (!number.has(root)) number.set(root, number.size)
    return number.get(root)!
  })
}

/**
 * As estradas novas da malha ("Rota de A a B", tipo Estrada, ligadas às duas cidades), para o
 * `addRoads`. `cities` é a lista mandada ao worker; `pins` e `roads`, os de agora: uma cidade que
 * já não existe (excluída no meio do cálculo) tira as estradas dela, e um par que uma estrada já
 * liga agora (desfeita ou refeita no meio do cálculo) não ganha outra.
 */
export function networkRoads(
  network: CityNetwork,
  cities: readonly Pin[],
  pins: readonly Pin[],
  roads: readonly Road[],
): Parameters<RoadsState['addRoads']>[0][number][] {
  const alive = new Map(pins.map((p) => [p.id, p]))
  const group = cityGroups(cities, roads)
  const parent = group.map((_, k) => k)
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k])))
  const first = new Map<number, number>()
  group.forEach((g, k) => {
    if (first.has(g)) parent[find(k)] = find(first.get(g)!)
    else first.set(g, k)
  })
  return network.links.flatMap((link) => {
    const a = alive.get(cities[link.from].id)
    const b = alive.get(cities[link.to].id)
    if (!a || !b || find(link.from) === find(link.to)) return []
    parent[find(link.to)] = find(link.from)
    return [{ points: link.points, from: a.id, to: b.id, name: routeName(a.name, b.name) }]
  })
}

/** Quantas cidades ficaram sem caminho por terra, sem contar as que saíram no meio do cálculo. */
export function isolatedCount(network: CityNetwork, cities: readonly Pin[], pins: readonly Pin[]): number {
  const alive = new Set(pins.map((p) => p.id))
  return network.isolated.filter((k) => alive.has(cities[k].id)).length
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** O texto do toast de "Conectar cidades": as estradas criadas e as cidades sem caminho por terra. */
export function connectMessage(created: number, isolated: number): string {
  const roads = created === 0 ? 'Nenhuma estrada nova' : plural(created, 'estrada criada', 'estradas criadas')
  if (isolated > 0) return `${roads} · ${plural(isolated, 'cidade sem caminho por terra', 'cidades sem caminho por terra')}`
  return created === 0 ? 'Nenhuma estrada nova: as cidades já estão ligadas' : roads
}
