import { BIOME, type CoreField } from '../types'

/**
 * Grade de custo da rota pelo terreno (F5, AC-F5-09 a 11): o campo do mapa reduzido a uma grade de
 * no máximo 256², onde roda o A* (`findRoute`). Cada célula da grade junta um bloco de células do
 * campo (4×4 no mapa 1024²).
 *
 * - Custo da célula: a média do custo do bioma (`BIOME_COST`) das células do bloco.
 * - Água: a célula com qualquer água no bloco (oceano, água rasa ou lago, que inclui o oásis) é
 *   água e nunca é atravessada por terra. Assim, um ponto qualquer de uma célula de terra é terra.
 * - Margem: a célula de terra vizinha de uma de água custa `SHORE_COST` a mais, para a rota não
 *   raspar na água (e a curva suavizada não entrar nela).
 * - Mar: a célula só de oceano (sem terra e sem lago), por onde passa a rota marítima.
 * - Rio: as células por onde passa um rio, numa linha 4-conectada (sem passo na diagonal), que um
 *   caminho de 8 vizinhos não atravessa sem pisar nela.
 */

/** Lado máximo da grade da rota. */
export const ROUTE_GRID = 256

/**
 * Custo de andar uma célula em cada bioma (o índice é o valor de `BIOME`): planícies baratas,
 * floresta e colina mais caras, montanha rochosa e neve muito mais. Água é `Infinity`.
 */
export const BIOME_COST: readonly number[] = (() => {
  const cost: number[] = []
  cost[BIOME.deepOcean] = Infinity
  cost[BIOME.shallowWater] = Infinity
  cost[BIOME.beach] = 1.2
  cost[BIOME.grassland] = 1
  cost[BIOME.forest] = 2.5
  cost[BIOME.desert] = 1.5
  cost[BIOME.hill] = 3
  cost[BIOME.rockyMountain] = 14
  cost[BIOME.snow] = 18
  cost[BIOME.frozenField] = 1.5
  cost[BIOME.lake] = Infinity
  return cost
})()

/** Custo a mais da célula de terra vizinha da água. */
export const SHORE_COST = 1

/** O que a rota usa do campo. */
export type RouteField = Pick<CoreField, 'width' | 'height' | 'biome' | 'elevation' | 'rivers'>

export type CostGrid = {
  /** Lado da grade (quadrada). */
  size: number
  /** Custo de andar uma célula, por terra; `Infinity` na água. */
  cost: Float32Array
  /** Elevação média do bloco, de 0 a 1. */
  elevation: Float32Array
  /** 1 onde o bloco é só oceano (a rota marítima passa). */
  sea: Uint8Array
  /** 1 onde passa um rio. */
  river: Uint8Array
}

const isOcean = (b: number) => b === BIOME.deepOcean || b === BIOME.shallowWater

export function buildCostGrid(field: RouteField): CostGrid {
  const { width, height, biome, elevation: fineElevation } = field
  if (width !== height) throw new Error(`a rota pede um campo quadrado (veio ${width}×${height})`)
  const size = Math.min(ROUTE_GRID, width)
  const n = size * size
  const sum = new Float64Array(n)
  const elevSum = new Float64Array(n)
  const count = new Uint32Array(n)
  const water = new Uint8Array(n)
  const notOcean = new Uint8Array(n)
  for (let y = 0; y < height; y++) {
    const cy = Math.floor((y * size) / height)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const c = cy * size + Math.floor((x * size) / width)
      const b = biome[i]
      const cost = BIOME_COST[b] ?? 1
      if (cost === Infinity) water[c] = 1
      else sum[c] += cost
      if (!isOcean(b)) notOcean[c] = 1
      elevSum[c] += fineElevation[i]
      count[c]++
    }
  }
  const cost = new Float32Array(n)
  const elevation = new Float32Array(n)
  const sea = new Uint8Array(n)
  for (let c = 0; c < n; c++) {
    elevation[c] = elevSum[c] / count[c]
    sea[c] = notOcean[c] ? 0 : 1
    cost[c] = water[c] ? Infinity : sum[c] / count[c]
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = y * size + x
      if (water[c] || !nearWater(water, size, x, y)) continue
      cost[c] += SHORE_COST
    }
  }
  return { size, cost, elevation, sea, river: rasterizeRivers(field.rivers, size) }
}

function nearWater(water: Uint8Array, size: number, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < size && ny < size && water[ny * size + nx]) return true
    }
  }
  return false
}

/** Célula da grade do ponto (u, v), de 0 a 1 no mapa; fica dentro da grade. */
export function cellOf(size: number, u: number, v: number): number {
  const x = Math.min(size - 1, Math.max(0, Math.floor(u * size)))
  const y = Math.min(size - 1, Math.max(0, Math.floor(v * size)))
  return y * size + x
}

/** Os rios na grade, cada um como uma linha 4-conectada de células. */
function rasterizeRivers(rivers: RouteField['rivers'], size: number): Uint8Array {
  const river = new Uint8Array(size * size)
  for (const line of rivers) {
    for (let k = 0; k < line.length; k++) {
      const c = cellOf(size, line[k].u, line[k].v)
      river[c] = 1
      if (k === 0) continue
      const p = cellOf(size, line[k - 1].u, line[k - 1].v)
      let x = p % size
      let y = Math.floor(p / size)
      const tx = c % size
      const ty = Math.floor(c / size)
      // Um passo na diagonal vira dois: primeiro no x, depois no y.
      while (x !== tx || y !== ty) {
        if (x !== tx) x += tx > x ? 1 : -1
        else y += ty > y ? 1 : -1
        river[y * size + x] = 1
      }
    }
  }
  return river
}
