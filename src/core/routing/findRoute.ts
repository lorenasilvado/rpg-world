import { cellOf, type CostGrid } from './costGrid'

/**
 * Rota mais barata entre dois pontos do mapa (F5, AC-F5-09 a 11), pelo A* na grade de custo
 * (`buildCostGrid`), com 8 vizinhos.
 *
 * - Por terra (`land`): o passo custa a distância vezes a média do custo das duas células, mais a
 *   inclinação (`SLOPE_COST` vezes a diferença de elevação, por célula da grade). A água nunca é
 *   atravessada. Entrar numa célula de rio custa uma ponte (`BRIDGE_COST`): cada travessia é cara,
 *   e seguir o rio por dentro custaria uma ponte por célula. Um passo na diagonal não corta o canto
 *   de uma célula de água nem de rio (assim não passa entre duas células de rio na diagonal).
 * - Marítima (`sea`): a mesma busca só pelas células de oceano; a terra só vale perto das pontas
 *   (até `SEA_LAND_REACH` células), para a rota sair do pin até o mar.
 *
 * As pontas sempre valem, mesmo numa célula com água. O caminho volta simplificado
 * (`simplifyPath`) em pontos (u, v), de 0 a 1, do ponto de origem exato ao de destino exato.
 */

export type RouteMode = 'land' | 'sea'

export type RoutePoint = { u: number; v: number }

/** O caminho em pontos (u, v) e o custo dele no A*. */
export type Route = { points: RoutePoint[]; cost: number }

/** Custo da inclinação: vezes a diferença de elevação entre duas células, vezes o lado da grade. */
export const SLOPE_COST = 0.5
/** Custo de entrar numa célula de rio: uma ponte. */
export const BRIDGE_COST = 40
/** Até quantas células da grade (em cada eixo) a rota marítima anda por terra, perto das pontas. */
export const SEA_LAND_REACH = 6
/** Custo de andar uma célula por terra na rota marítima. */
export const SEA_LAND_COST = 4

/** √2: o passo na diagonal (literal: `Math.SQRT2` fica fora da lista do teste de determinismo). */
export const DIAGONAL = 1.4142135623730951

/** `null` quando não há caminho (ex.: uma ilha, por terra). */
export function findRoute(grid: CostGrid, from: RoutePoint, to: RoutePoint, mode: RouteMode): Route | null {
  const { size } = grid
  const start = cellOf(size, from.u, from.v)
  const goal = cellOf(size, to.u, to.v)
  const weight = mode === 'land' ? landWeight(grid, start, goal) : seaWeight(grid, start, goal)
  const cells = mode === 'land' ? searchLand(grid, weight, goal) : searchSea(weight)
  const found = aStar(size, start, goal, cells, 1)
  if (!found) return null
  const river = mode === 'land' ? grid.river : null
  return { points: simplifyPath(size, weight, river, found.path, from, to), cost: found.cost }
}

/**
 * Custo de andar uma célula por terra (`Infinity` onde a busca não pisa): o da grade; as pontas
 * numa célula com água andam como planície.
 */
function landWeight(grid: CostGrid, start: number, goal: number): Float32Array {
  const out = grid.cost.slice()
  if (out[start] === Infinity) out[start] = 1
  if (out[goal] === Infinity) out[goal] = 1
  return out
}

/** Custo de andar uma célula na rota marítima: 1 no oceano, `SEA_LAND_COST` na terra perto das pontas. */
function seaWeight(grid: CostGrid, start: number, goal: number): Float32Array {
  const { size } = grid
  const out = new Float32Array(size * size)
  for (let c = 0; c < out.length; c++) out[c] = grid.sea[c] ? 1 : Infinity
  for (const end of [start, goal]) {
    const ex = end % size
    const ey = Math.floor(end / size)
    for (let y = Math.max(0, ey - SEA_LAND_REACH); y <= Math.min(size - 1, ey + SEA_LAND_REACH); y++) {
      for (let x = Math.max(0, ex - SEA_LAND_REACH); x <= Math.min(size - 1, ex + SEA_LAND_REACH); x++) {
        const c = y * size + x
        if (!grid.sea[c]) out[c] = SEA_LAND_COST
      }
    }
  }
  return out
}

type Step = (a: number, b: number, corners: readonly [number, number] | null) => number

function searchLand(grid: CostGrid, weight: Float32Array, goal: number): Step {
  const { river, elevation, size } = grid
  return (a, b, corners) => {
    if (weight[b] === Infinity) return Infinity
    if (corners) {
      const [p, q] = corners
      if (weight[p] === Infinity || weight[q] === Infinity) return Infinity
      // Não passa entre células de rio na diagonal: atravessa o rio por dentro de uma delas.
      if ((river[p] || river[q]) && !river[a] && !river[b]) return Infinity
    }
    const slope = Math.abs(elevation[b] - elevation[a]) * size * SLOPE_COST
    // Cada célula de rio em que a rota entra custa uma ponte (o destino num rio, não).
    const bridge = river[b] && b !== goal ? BRIDGE_COST : 0
    return (corners ? DIAGONAL : 1) * ((weight[a] + weight[b]) / 2 + slope) + bridge
  }
}

function searchSea(weight: Float32Array): Step {
  return (a, b, corners) => {
    if (weight[b] === Infinity) return Infinity
    if (corners && (weight[corners[0]] === Infinity || weight[corners[1]] === Infinity)) return Infinity
    return (corners ? DIAGONAL : 1) * ((weight[a] + weight[b]) / 2)
  }
}

/**
 * A* com 8 vizinhos e heurística octil vezes `minStep` (o menor custo de um passo reto, para ela
 * nunca passar do custo real). `step(a, b, corners)` dá o custo de ir de `a` para `b`, com
 * `corners` as duas células ortogonais num passo na diagonal (`null` num passo reto), ou
 * `Infinity` se não pode.
 */
function aStar(
  size: number,
  start: number,
  goal: number,
  step: Step,
  minStep: number,
): { path: number[]; cost: number } | null {
  const n = size * size
  const g = new Float64Array(n).fill(Infinity)
  const came = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const heap = new MinHeap(n)
  const gx = goal % size
  const gy = Math.floor(goal / size)
  const h = (c: number) => {
    const dx = Math.abs((c % size) - gx)
    const dy = Math.abs(Math.floor(c / size) - gy)
    return minStep * (Math.max(dx, dy) + (DIAGONAL - 1) * Math.min(dx, dy))
  }
  const corners: [number, number] = [0, 0]
  g[start] = 0
  heap.push(start, h(start))
  while (heap.length > 0) {
    const a = heap.pop()
    if (closed[a]) continue
    if (a === goal) break
    closed[a] = 1
    const ax = a % size
    const ay = Math.floor(a / size)
    for (let dy = -1; dy <= 1; dy++) {
      const y = ay + dy
      if (y < 0 || y >= size) continue
      for (let dx = -1; dx <= 1; dx++) {
        const x = ax + dx
        if ((dx === 0 && dy === 0) || x < 0 || x >= size) continue
        const b = y * size + x
        if (closed[b]) continue
        let cost: number
        if (dx !== 0 && dy !== 0) {
          corners[0] = ay * size + x
          corners[1] = y * size + ax
          cost = step(a, b, corners)
        } else cost = step(a, b, null)
        if (cost === Infinity) continue
        const tentative = g[a] + cost
        if (tentative < g[b]) {
          g[b] = tentative
          came[b] = a
          heap.push(b, tentative + h(b))
        }
      }
    }
  }
  if (g[goal] === Infinity) return null
  const path: number[] = []
  for (let c = goal; c !== -1; c = came[c]) path.push(c)
  path.reverse()
  return { path, cost: g[goal] }
}

/** Fila de prioridade (heap binário) de células, com repetição (a entrada velha é ignorada ao sair). */
export class MinHeap {
  private items: Int32Array
  private keys: Float64Array
  length = 0

  constructor(capacity: number) {
    this.items = new Int32Array(Math.max(16, capacity))
    this.keys = new Float64Array(Math.max(16, capacity))
  }

  push(item: number, key: number) {
    if (this.length === this.items.length) {
      const items = new Int32Array(this.items.length * 2)
      const keys = new Float64Array(this.keys.length * 2)
      items.set(this.items)
      keys.set(this.keys)
      this.items = items
      this.keys = keys
    }
    let i = this.length++
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.keys[parent] <= key) break
      this.items[i] = this.items[parent]
      this.keys[i] = this.keys[parent]
      i = parent
    }
    this.items[i] = item
    this.keys[i] = key
  }

  pop(): number {
    const top = this.items[0]
    const last = --this.length
    const item = this.items[last]
    const key = this.keys[last]
    let i = 0
    for (;;) {
      let child = 2 * i + 1
      if (child >= last) break
      if (child + 1 < last && this.keys[child + 1] < this.keys[child]) child++
      if (this.keys[child] >= key) break
      this.items[i] = this.items[child]
      this.keys[i] = this.keys[child]
      i = child
    }
    this.items[i] = item
    this.keys[i] = key
    return top
  }
}

/** Distância máxima, em células da grade, entre o caminho e o trecho reto que o substitui. */
export const SIMPLIFY_TOLERANCE = 1
/** Maior trecho reto do caminho simplificado, em células da grade: a curva suavizada fica perto dele. */
export const MAX_SEGMENT = 4

/**
 * O caminho de células em pontos (u, v): Douglas-Peucker com `SIMPLIFY_TOLERANCE`, aceitando um
 * trecho reto só se ele passa só por células onde a busca pisa, nenhuma mais cara que a mais cara
 * do caminho que ele substitui (assim não corta o canto de uma montanha), e, por terra, por não
 * mais células de rio que esse caminho. Depois, os trechos longos são divididos (`MAX_SEGMENT`),
 * para a curva Catmull-Rom do desenho não se afastar do caminho. A primeira e a última célula viram
 * os pontos exatos de origem e de destino.
 *
 * `weight` é o custo de andar cada célula (`Infinity` onde a busca não pisa); `river`, as células
 * de rio, ou `null` na rota marítima.
 */
export function simplifyPath(
  size: number,
  weight: Float32Array,
  river: Uint8Array | null,
  path: readonly number[],
  from: RoutePoint,
  to: RoutePoint,
): RoutePoint[] {
  // Em unidades de célula da grade.
  const pts = path.map((c) => ({ x: (c % size) + 0.5, y: Math.floor(c / size) + 0.5 }))
  if (pts.length === 1) pts.push(pts[0])
  pts[0] = { x: from.u * size, y: from.v * size }
  pts[pts.length - 1] = { x: to.u * size, y: to.v * size }
  const cells = path.length === 1 ? [path[0], path[0]] : path
  const riverPrefix = new Int32Array(cells.length + 1)
  for (let k = 0; k < cells.length; k++) riverPrefix[k + 1] = riverPrefix[k] + (river ? river[cells[k]] : 0)
  const keep = new Uint8Array(pts.length)
  keep[0] = 1
  keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length > 0) {
    const [i, j] = stack.pop()!
    if (j - i < 2) continue
    let worst = -1
    let worstDist = -1
    let maxWeight = 0
    for (let k = i; k <= j; k++) {
      maxWeight = Math.max(maxWeight, weight[cells[k]])
      if (k === i || k === j) continue
      const d = distanceToSegment(pts[k], pts[i], pts[j])
      if (d > worstDist) {
        worstDist = d
        worst = k
      }
    }
    const rivers = riverPrefix[j + 1] - riverPrefix[i]
    if (worstDist <= SIMPLIFY_TOLERANCE && segmentFits(size, weight, river, pts[i], pts[j], maxWeight, rivers)) continue
    keep[worst] = 1
    stack.push([i, worst], [worst, j])
  }
  const out: RoutePoint[] = []
  let prev: XY | null = null
  for (let k = 0; k < pts.length; k++) {
    if (!keep[k]) continue
    const p = pts[k]
    if (prev) {
      const len = Math.sqrt((p.x - prev.x) * (p.x - prev.x) + (p.y - prev.y) * (p.y - prev.y))
      const parts = Math.ceil(len / MAX_SEGMENT)
      for (let s = 1; s < parts; s++) {
        const t = s / parts
        out.push({ u: (prev.x + (p.x - prev.x) * t) / size, v: (prev.y + (p.y - prev.y) * t) / size })
      }
    }
    out.push({ u: p.x / size, v: p.y / size })
    prev = p
  }
  return out
}

type XY = { x: number; y: number }

function distanceToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const ex = a.x + dx * t - p.x
  const ey = a.y + dy * t - p.y
  return Math.sqrt(ex * ex + ey * ey)
}

/**
 * Se o trecho reto de `a` a `b` (em células) passa só por células onde a busca pisa, de custo até
 * `maxWeight`, e por no máximo `rivers` células de rio.
 */
function segmentFits(
  size: number,
  weight: Float32Array,
  river: Uint8Array | null,
  a: XY,
  b: XY,
  maxWeight: number,
  rivers: number,
): boolean {
  let crossed = 0
  let ok = true
  segmentCells(size, a, b, (c) => {
    if (weight[c] > maxWeight) ok = false
    else if (river && river[c] && ++crossed > rivers) ok = false
    return ok
  })
  return ok
}

/**
 * Visita, em ordem, cada célula que o trecho reto de `a` a `b` toca (Amanatides e Woo), enquanto
 * `visit` devolver `true`. Quando o trecho passa exatamente por um canto, visita as duas células
 * do canto.
 */
export function segmentCells(size: number, a: XY, b: XY, visit: (cell: number) => boolean): void {
  const clamp = (v: number) => Math.min(size - 1, Math.max(0, Math.floor(v)))
  let x = clamp(a.x)
  let y = clamp(a.y)
  const tx = clamp(b.x)
  const ty = clamp(b.y)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const sx = dx > 0 ? 1 : -1
  const sy = dy > 0 ? 1 : -1
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx)
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy)
  let tMaxX = dx === 0 ? Infinity : (dx > 0 ? x + 1 - a.x : a.x - x) * tDeltaX
  let tMaxY = dy === 0 ? Infinity : (dy > 0 ? y + 1 - a.y : a.y - y) * tDeltaY
  if (!visit(y * size + x)) return
  let guard = 4 * size
  while ((x !== tx || y !== ty) && guard-- > 0) {
    if (tMaxX === tMaxY) {
      // No canto: as duas células vizinhas contam, e o passo vai na diagonal.
      if (!visit(y * size + clamp(x + sx)) || !visit(clamp(y + sy) * size + x)) return
      x = clamp(x + sx)
      y = clamp(y + sy)
      tMaxX += tDeltaX
      tMaxY += tDeltaY
    } else if (tMaxX < tMaxY) {
      x = clamp(x + sx)
      tMaxX += tDeltaX
    } else {
      y = clamp(y + sy)
      tMaxY += tDeltaY
    }
    if (!visit(y * size + x)) return
  }
}
