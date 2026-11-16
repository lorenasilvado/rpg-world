import { describe, expect, it } from 'vitest'
import { BIOME, DECOR, type CoreField, type WorldParams } from '../types'
import { distanceToWater } from './coast'
import { DESERT_WATER_MARGIN, generateField } from './generateField'
import { OASIS_LAKE_RADIUS, OASIS_RING_RADIUS } from './oasis'
import { DEFAULT_WORLD_PARAMS } from './params'
import { minLakeCells } from './rivers'
import { depressions, seaWater } from './water'

const SEEDS = ['rpg-world', 'Aldebaran', '42', 'valdora', 'mar do norte']
const params = (over: Partial<WorldParams>): WorldParams => ({ ...DEFAULT_WORLD_PARAMS, ...over })
/** Preset "Deserto árido" (`docs/specs/geracao-terreno.md`, assistente). */
const ARID = params({ ocean: 32, beach: 25, desert: 62, forest: 10, mountains: 34, snow: 12, continentSize: 74, coastRoughness: 45, temperature: 85 })
const isOcean = (b: number) => b === BIOME.deepOcean || b === BIOME.shallowWater

/** Chama `visit` para cada vizinha das 8 da célula `i`. */
function neighbors(i: number, size: number, visit: (j: number) => void): void {
  const x = i % size
  const y = Math.floor(i / size)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx
      const ny = y + dy
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < size && ny < size) visit(ny * size + nx)
    }
  }
}

/** Distância (em frações da largura) do centro da célula `i` ao ponto (u, v). */
function distanceTo(i: number, size: number, u: number, v: number): number {
  const du = ((i % size) + 0.5) / size - u
  const dv = (Math.floor(i / size) + 0.5) / size - v
  return Math.sqrt(du * du + dv * dv)
}

/** 1 nas células do oásis (lago e anel). */
function oasisMask(f: CoreField): Uint8Array {
  return Uint8Array.from(f.biome, (_, i) => (f.oases.some((o) => distanceTo(i, f.width, o.u, o.v) <= OASIS_RING_RADIUS) ? 1 : 0))
}

/** Água doce fora dos oásis: os lagos e as células dos rios. */
function freshWater(f: CoreField): Uint8Array {
  const oasis = oasisMask(f)
  const fresh = Uint8Array.from(f.biome, (b, i) => (b === BIOME.lake && !oasis[i] ? 1 : 0))
  for (const river of f.rivers) for (const p of river) fresh[Math.floor(p.v * f.height) * f.width + Math.floor(p.u * f.width)] = 1
  return fresh
}

describe('água interior como lago (AC-F1-29)', () => {
  it('o oceano é só a água ligada à borda, e continua no alvo do slider Oceano (AC-F1-02)', () => {
    for (const seed of SEEDS) {
      for (const ocean of [10, 30, 45, 70]) {
        const size = 128
        const f = generateField(seed, size, params({ ocean }))
        const label = `${seed} oceano ${ocean}`
        const share = f.biome.filter(isOcean).length / f.biome.length
        expect(Math.abs(share - ocean / 100), label).toBeLessThanOrEqual(0.02)
        // Busca a partir da borda, só pelo oceano: tem de chegar em todo o oceano.
        const reached = new Uint8Array(size * size)
        const queue: number[] = []
        for (let i = 0; i < size * size; i++) {
          const x = i % size
          const y = Math.floor(i / size)
          if ((x === 0 || y === 0 || x === size - 1 || y === size - 1) && isOcean(f.biome[i])) {
            reached[i] = 1
            queue.push(i)
          }
        }
        for (let h = 0; h < queue.length; h++) {
          neighbors(queue[h], size, (j) => {
            if (!reached[j] && isOcean(f.biome[j])) {
              reached[j] = 1
              queue.push(j)
            }
          })
        }
        expect(f.biome.filter((b, i) => isOcean(b) && !reached[i]).length, label).toBe(0)
      }
    }
  }, 30_000)

  it('a água abaixo do nível do mar sem ligação com a borda é lago, não oceano', () => {
    let inlandLakes = 0
    for (const seed of SEEDS) {
      const size = 128
      const p = params({ ocean: 45 })
      const f = generateField(seed, size, p)
      const { inland } = seaWater(f.elevation, depressions(f.elevation, size), p.ocean / 100)
      // Cada grupo de água interior é lago inteiro, ou volta a ser terra se é menor que o lago mínimo.
      const seen = new Uint8Array(size * size)
      for (let start = 0; start < size * size; start++) {
        if (!inland[start] || seen[start]) continue
        const cells = [start]
        seen[start] = 1
        for (let h = 0; h < cells.length; h++) {
          neighbors(cells[h], size, (j) => {
            if (inland[j] && !seen[j]) {
              seen[j] = 1
              cells.push(j)
            }
          })
        }
        const lake = cells.filter((c) => f.biome[c] === BIOME.lake).length
        expect(cells.filter((c) => isOcean(f.biome[c])), seed).toEqual([])
        if (cells.length >= minLakeCells(size)) {
          expect(lake, seed).toBe(cells.length)
          inlandLakes++
        }
      }
    }
    expect(inlandLakes).toBeGreaterThan(0)
  })

  it('nenhuma margem de lago tem praia, com qualquer valor do slider Praias', () => {
    for (const seed of SEEDS) {
      for (const beach of [0, 30, 70, 100]) {
        for (const ocean of [20, 45]) {
          const size = 128
          const f = generateField(seed, size, params({ beach, ocean }))
          const shore: number[] = []
          f.biome.forEach((b, i) => {
            if (b === BIOME.lake) neighbors(i, size, (j) => f.biome[j] === BIOME.beach && shore.push(j))
          })
          expect(shore, `${seed} Praias ${beach} Oceano ${ocean}`).toEqual([])
        }
      }
    }
  }, 30_000)

  it('com Praias no máximo, ainda há praia no oceano', () => {
    const f = generateField('rpg-world', 128, params({ beach: 100 }))
    expect(f.biome.filter((b) => b === BIOME.beach).length).toBeGreaterThan(0)
  })
})

describe('deserto com oásis (AC-F1-28)', () => {
  const cases: [string, WorldParams][] = [
    ['padrão', DEFAULT_WORLD_PARAMS],
    ['Deserto árido', ARID],
    ['Deserto árido, Praias 100', { ...ARID, beach: 100 }],
    ['Desertos 100', params({ desert: 100, forest: 0 })],
  ]

  it('o deserto recua dos rios e dos lagos: a terra junto deles é campo ou floresta', () => {
    for (const seed of SEEDS) {
      for (const [name, p] of cases) {
        const size = 128
        const f = generateField(seed, size, p)
        const distance = distanceToWater(freshWater(f), size)
        const margin = Math.max(1.5, DESERT_WATER_MARGIN * size)
        let near = 0
        const desert: number[] = []
        f.biome.forEach((b, i) => {
          if (distance[i] > margin || distance[i] === 0) return
          if (b === BIOME.desert) desert.push(i)
          near++
        })
        expect(near).toBeGreaterThan(0)
        expect(desert, `${seed} ${name}`).toEqual([])
      }
    }
  }, 30_000)

  it('dentro do deserto, a única água é o oásis', () => {
    for (const seed of SEEDS) {
      for (const [name, p] of cases) {
        const size = 128
        const f = generateField(seed, size, p)
        const oasis = oasisMask(f)
        const wet: number[] = []
        f.biome.forEach((b, i) => {
          // O mar na costa não é água dentro do deserto: o deserto pode chegar à praia.
          if (b === BIOME.desert) neighbors(i, size, (j) => f.biome[j] === BIOME.lake && !oasis[j] && wet.push(j))
        })
        for (const river of f.rivers) {
          for (const pt of river) {
            const i = Math.floor(pt.v * size) * size + Math.floor(pt.u * size)
            if (f.biome[i] === BIOME.desert) wet.push(i)
          }
        }
        expect(wet, `${seed} ${name}`).toEqual([])
      }
    }
  }, 30_000)

  it('o oásis é um lago pequeno com anel de vegetação, cercado de deserto, e tem palmeiras no anel', () => {
    let total = 0
    for (const seed of SEEDS) {
      for (const size of [256, 512]) {
        const f = generateField(seed, size, ARID)
        expect(f.oases.length, `${seed} ${size}²`).toBeGreaterThan(0)
        total += f.oases.length
        for (const o of f.oases) {
          let lake = 0
          f.biome.forEach((b, i) => {
            const d = distanceTo(i, size, o.u, o.v)
            if (d <= OASIS_LAKE_RADIUS) {
              expect(b).toBe(BIOME.lake)
              lake++
            } else if (d <= OASIS_RING_RADIUS) expect(b).toBe(BIOME.grassland)
            else if (d <= OASIS_RING_RADIUS + 1.5 / size) expect(b).toBe(BIOME.desert)
          })
          // Lago pequeno: bem menor que o lago mínimo dos rios.
          expect(lake).toBeGreaterThan(0)
          expect(lake).toBeLessThan(minLakeCells(size))
          const palms: number[] = []
          for (let k = 0; k < f.decor.kind.length; k++) {
            if (f.decor.kind[k] !== DECOR.palm) continue
            const du = f.decor.u[k] - o.u
            const dv = f.decor.v[k] - o.v
            if (Math.sqrt(du * du + dv * dv) <= OASIS_RING_RADIUS) palms.push(k)
          }
          expect(palms.length).toBeGreaterThanOrEqual(2)
          expect(palms.length).toBeLessThanOrEqual(3)
          for (const k of palms) {
            const i = Math.floor(f.decor.v[k] * size) * size + Math.floor(f.decor.u[k] * size)
            expect(f.biome[i]).toBe(BIOME.grassland)
          }
        }
      }
    }
    expect(total).toBeGreaterThan(10)
  }, 30_000)

  it('é sorteado pela seed: a mesma seed dá os mesmos oásis, e a prévia e o mapa final os põem nos mesmos lugares', () => {
    const a = generateField('rpg-world', 256, ARID).oases
    expect(generateField('rpg-world', 256, ARID).oases).toEqual(a)
    expect(generateField('Aldebaran', 256, ARID).oases).not.toEqual(a)
    let shared = 0
    let preview = 0
    for (const seed of SEEDS) {
      const small = generateField(seed, 256, ARID).oases
      const final = generateField(seed, 1024, ARID).oases
      preview += small.length
      shared += small.filter((o) => final.some((q) => q.u === o.u && q.v === o.v)).length
    }
    expect(shared / preview).toBeGreaterThanOrEqual(0.6)
  }, 60_000)

  it('sem deserto não há oásis, e não há palmeira fora dos oásis', () => {
    const f = generateField('rpg-world', 256, params({ desert: 0 }))
    expect(f.oases).toEqual([])
    expect(f.decor.kind.includes(DECOR.palm)).toBe(false)
  })
})
