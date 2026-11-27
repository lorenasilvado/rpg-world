import { cellOf, type CostGrid } from './costGrid'
import { BRIDGE_COST, DIAGONAL, findRoute, MinHeap, simplifyPath, SLOPE_COST, type RoutePoint } from './findRoute'

/**
 * A malha de estradas entre as cidades (F5, AC-F5-14, "Conectar cidades"): a árvore mínima pelo
 * custo do terreno, por terra, entre as cidades alcançáveis.
 *
 * - Uma busca de Dijkstra a partir de cada cidade dá o custo por terra até cada outra (o mesmo passo
 *   do A* da `findRoute`, com 8 vizinhos, a inclinação e a ponte em cada célula de rio). A cidade
 *   numa célula com água (ou num rio) é só ponta: a busca chega nela, mas não passa por ela.
 * - `groups` diz quais cidades já estão ligadas por estrada (o mesmo número: já ligadas, por
 *   qualquer caminho de estradas). A árvore (Kruskal, do par mais barato para o mais caro) nunca liga
 *   duas cidades do mesmo grupo: não repete um par já ligado, nem fecha um ciclo.
 * - Cada ligação nova volta com o caminho simplificado (`simplifyPath`, como a Rota automática),
 *   pelas `candidates` cidades mais baratas de cada uma; uma ligação fora delas usa a `findRoute`.
 * - `isolated` são as cidades que ficaram sozinhas no grupo delas: sem caminho por terra até
 *   nenhuma outra, nem estrada que já as ligue.
 *
 * Determinístico: a mesma grade, as mesmas cidades e os mesmos grupos dão a mesma malha.
 */
export type NetworkLink = {
  /** Índices das duas cidades em `cities`, na ordem da estrada. */
  from: number
  to: number
  points: RoutePoint[]
  cost: number
}

export type CityNetwork = { links: NetworkLink[]; isolated: number[] }

/** Quantas cidades mais baratas de cada uma guardam o caminho pronto (as candidatas da árvore). */
export const NETWORK_CANDIDATES = 8

export function connectCities(
  grid: CostGrid,
  cities: readonly RoutePoint[],
  groups: readonly number[] = cities.map((_, k) => k),
  { candidates = NETWORK_CANDIDATES }: { candidates?: number } = {},
): CityNetwork {
  const n = cities.length
  const { size } = grid
  const cells = cities.map((p) => cellOf(size, p.u, p.v))
  /** As cidades de cada célula (duas cidades podem cair na mesma). */
  const at = new Map<number, number[]>()
  cells.forEach((c, k) => at.set(c, [...(at.get(c) ?? []), k]))
  /** Célula de uma cidade com água ou rio: só ponta. */
  const terminal = new Uint8Array(size * size)
  for (const c of cells) if (grid.cost[c] === Infinity || grid.river[c]) terminal[c] = 1

  const cost = new Float64Array(n * n).fill(Infinity)
  const paths = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const { g, came } = dijkstra(grid, cells[i], terminal, cells, at)
    const near: number[] = []
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      const c = cells[j]
      const gj = c === cells[i] ? 0 : g[c]
      if (gj === Infinity) continue
      cost[i * n + j] = gj
      near.push(j)
    }
    near.sort((a, b) => cost[i * n + a] - cost[i * n + b] || a - b)
    for (const j of near.slice(0, candidates)) {
      const path: number[] = []
      for (let c = cells[j]; c !== -1; c = came[c]) path.push(c)
      path.reverse()
      paths.set(i * n + j, path)
    }
  }

  // Os pares, do mais barato para o mais caro (o custo nos dois sentidos pode diferir um pouco, por
  // causa das pontes nas pontas: vale o menor, e a estrada segue o sentido dele).
  type Pair = { from: number; to: number; cost: number }
  const pairs: Pair[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ij = cost[i * n + j]
      const ji = cost[j * n + i]
      if (ij === Infinity && ji === Infinity) continue
      pairs.push(ji < ij ? { from: j, to: i, cost: ji } : { from: i, to: j, cost: ij })
    }
  }
  pairs.sort((a, b) => a.cost - b.cost || a.from - b.from || a.to - b.to)

  const parent = groups.map((_, k) => k)
  const find = (k: number): number => {
    while (parent[k] !== k) {
      parent[k] = parent[parent[k]]
      k = parent[k]
    }
    return k
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
  }
  const firstOfGroup = new Map<number, number>()
  groups.forEach((group, k) => {
    const first = firstOfGroup.get(group)
    if (first === undefined) firstOfGroup.set(group, k)
    else union(first, k)
  })

  const links: NetworkLink[] = []
  for (const pair of pairs) {
    if (find(pair.from) === find(pair.to)) continue
    const points = routeOf(grid, cities, cells, paths, n, pair)
    if (!points) continue
    union(pair.from, pair.to)
    links.push({ ...pair, points })
  }

  const members = new Map<number, number>()
  for (let k = 0; k < n; k++) members.set(find(k), (members.get(find(k)) ?? 0) + 1)
  const isolated: number[] = []
  for (let k = 0; k < n; k++) if (members.get(find(k)) === 1) isolated.push(k)
  return { links, isolated }
}

/** O caminho simplificado do par: o guardado pelo Dijkstra ou, fora das candidatas, o da `findRoute`. */
function routeOf(
  grid: CostGrid,
  cities: readonly RoutePoint[],
  cells: readonly number[],
  paths: ReadonlyMap<number, number[]>,
  n: number,
  { from, to }: { from: number; to: number },
): RoutePoint[] | null {
  const path = paths.get(from * n + to)
  if (!path) return findRoute(grid, cities[from], cities[to], 'land')?.points ?? null
  const weight = grid.cost.slice()
  if (weight[cells[from]] === Infinity) weight[cells[from]] = 1
  if (weight[cells[to]] === Infinity) weight[cells[to]] = 1
  return simplifyPath(grid.size, weight, grid.river, path, cities[from], cities[to])
}

/**
 * Dijkstra por terra a partir de `start`, com o passo da `findRoute`. Uma célula `terminal` (uma
 * cidade com água ou rio) recebe a busca sem a ponte e sem expandir; a busca para quando todas as
 * células de cidade já saíram da fila (ou não há mais para onde ir).
 */
function dijkstra(
  grid: CostGrid,
  start: number,
  terminal: Uint8Array,
  cells: readonly number[],
  at: ReadonlyMap<number, number[]>,
): { g: Float64Array; came: Int32Array } {
  const { size, cost, river, elevation } = grid
  const total = size * size
  const g = new Float64Array(total).fill(Infinity)
  const came = new Int32Array(total).fill(-1)
  const closed = new Uint8Array(total)
  const heap = new MinHeap(total)
  // As pontas com água andam como planície (como na `findRoute`).
  const w = (c: number) => (cost[c] === Infinity && (c === start || terminal[c]) ? 1 : cost[c])
  const targets = new Set(cells)
  targets.delete(start)
  let left = targets.size
  g[start] = 0
  heap.push(start, 0)
  while (heap.length > 0 && left > 0) {
    const a = heap.pop()
    if (closed[a]) continue
    closed[a] = 1
    if (a !== start && at.has(a)) left--
    if (a !== start && terminal[a]) continue
    const ax = a % size
    const ay = Math.floor(a / size)
    const wa = w(a)
    for (let dy = -1; dy <= 1; dy++) {
      const y = ay + dy
      if (y < 0 || y >= size) continue
      for (let dx = -1; dx <= 1; dx++) {
        const x = ax + dx
        if ((dx === 0 && dy === 0) || x < 0 || x >= size) continue
        const b = y * size + x
        if (closed[b]) continue
        const wb = w(b)
        if (wb === Infinity) continue
        const diagonal = dx !== 0 && dy !== 0
        if (diagonal) {
          const p = ay * size + x
          const q = y * size + ax
          if (w(p) === Infinity || w(q) === Infinity) continue
          if ((river[p] || river[q]) && !river[a] && !river[b]) continue
        }
        const slope = Math.abs(elevation[b] - elevation[a]) * size * SLOPE_COST
        const bridge = river[b] && !terminal[b] ? BRIDGE_COST : 0
        const tentative = g[a] + (diagonal ? DIAGONAL : 1) * ((wa + wb) / 2 + slope) + bridge
        if (tentative < g[b]) {
          g[b] = tentative
          came[b] = a
          heap.push(b, tentative)
        }
      }
    }
  }
  return { g, came }
}
