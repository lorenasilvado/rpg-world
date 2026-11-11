import { describe, expect, it } from 'vitest'
import { BIOME, type CoreField, type RiverPoint, type WorldParams } from '../types'
import { composeElevation, sampleTerrainNoise } from './elevation'
import { elevationLevels, generateField } from './generateField'
import { DEFAULT_WORLD_PARAMS } from './params'
import { quantile } from './quantile'
import { traceHydrology } from './rivers'

const SEEDS = ['rpg-world', 'Aldebaran', '42', 'valdora', 'mar do norte']
const params = (over: Partial<WorldParams>): WorldParams => ({ ...DEFAULT_WORLD_PARAMS, ...over })
const ARCHIPELAGO = params({
  ocean: 66, beach: 55, desert: 8, forest: 45, mountains: 22, snow: 15, continentSize: 8, coastRoughness: 72, temperature: 64,
})
const CASES: WorldParams[] = [
  DEFAULT_WORLD_PARAMS,
  ARCHIPELAGO,
  params({ ocean: 5 }),
  params({ ocean: 95 }),
  params({ mountains: 0 }),
  params({ continentSize: 100, coastRoughness: 0 }),
]
const isOcean = (b: number) => b === BIOME.deepOcean || b === BIOME.shallowWater
const cellOf = (f: CoreField, p: RiverPoint) => Math.floor(p.v * f.height) * f.width + Math.floor(p.u * f.width)
const cellsOf = (f: CoreField, river: RiverPoint[]) => river.map((p) => cellOf(f, p))

describe('rios e lagos (AC-F1-07)', () => {
  it('todo rio desce da nascente até o mar ou um lago, direto ou como afluente de outro rio', () => {
    for (const seed of SEEDS) {
      for (const p of CASES) {
        const f = generateField(seed, 128, p)
        const label = `${seed} ${JSON.stringify(p)}`
        const reachesWater: boolean[] = []
        const riverAt = new Map<number, number>()
        f.rivers.forEach((river, r) => {
          const cells = cellsOf(f, river)
          const last = cells[cells.length - 1]
          const b = f.biome[last]
          let ok = isOcean(b) || b === BIOME.lake
          // Afluente: termina num ponto de um rio anterior, que leva ao mar ou a um lago.
          if (!ok && riverAt.has(last)) ok = reachesWater[riverAt.get(last)!]
          expect(ok, `${label}: rio ${r} termina no bioma ${b}`).toBe(true)
          reachesWater.push(ok)
          for (const c of cells) if (!riverAt.has(c)) riverAt.set(c, r)
        })
      }
    }
  })

  it('desce: termina abaixo da nascente e nunca sobe acima dela, em passos entre células vizinhas', () => {
    // Eldoria (256²) e qa43-10 e qa43-13 (128²) têm nascentes dentro de uma depressão pequena com o
    // transbordo mais alto que elas: o rio subiria acima da nascente para sair (/qa da #43).
    const cases: [string, number][] = [...SEEDS.map((s): [string, number] => [s, 256]), ['Eldoria', 256], ['qa43-10', 128], ['qa43-13', 128]]
    for (let s = 0; s < 40; s++) cases.push([`qa43-${s}`, 128])
    for (const [seed, size] of cases) {
      const f = generateField(seed, size)
      for (const river of f.rivers) {
        const cells = cellsOf(f, river)
        expect(river.length).toBeGreaterThanOrEqual(2)
        const top = f.elevation[cells[0]]
        expect(f.elevation[cells[cells.length - 1]]).toBeLessThan(top)
        for (let k = 1; k < cells.length; k++) {
          expect(f.elevation[cells[k]], `${seed} ${size}²: passo ${k}`).toBeLessThanOrEqual(top)
          const dx = Math.abs((cells[k] % f.width) - (cells[k - 1] % f.width))
          const dy = Math.abs(Math.floor(cells[k] / f.width) - Math.floor(cells[k - 1] / f.width))
          expect(Math.max(dx, dy), `${seed}: passo ${k}`).toBe(1)
        }
      }
    }
  })

  it('o rio só toca água no último ponto, e não atravessa outro rio', () => {
    for (const seed of SEEDS) {
      const f = generateField(seed, 256, ARCHIPELAGO)
      const seen = new Set<number>()
      for (const river of f.rivers) {
        const cells = cellsOf(f, river)
        for (let k = 0; k < cells.length - 1; k++) {
          expect(isOcean(f.biome[cells[k]]) || f.biome[cells[k]] === BIOME.lake).toBe(false)
          expect(seen.has(cells[k])).toBe(false)
        }
        for (const c of cells) seen.add(c)
      }
    }
  })

  it('os rios nascem na terra alta, escolhida pelo RNG da seed, e o mapa tem rios e lagos', () => {
    for (const seed of SEEDS) {
      const f = generateField(seed, 256)
      const high = quantile(f.elevation, 0.94)
      expect(f.rivers.length, seed).toBeGreaterThanOrEqual(10)
      for (const river of f.rivers) expect(f.elevation[cellOf(f, river[0])]).toBeGreaterThanOrEqual(high)
      expect(f.biome.filter((b) => b === BIOME.lake).length, seed).toBeGreaterThan(0)
    }
    const other = generateField('outra seed', 256)
    expect(other.rivers[0]).not.toEqual(generateField('rpg-world', 256).rivers[0])
  })

  it('a prévia 256² e o mapa 1024² têm quase todas as nascentes nos mesmos lugares', () => {
    // As nascentes são sorteadas em coordenadas de 0 a 1; só as da margem da terra alta podem valer
    // numa resolução e não na outra.
    const near = (a: RiverPoint, b: RiverPoint) => Math.abs(a.u - b.u) + Math.abs(a.v - b.v) < 0.01
    for (const seed of ['rpg-world', 'Aldebaran']) {
      const preview = generateField(seed, 256).rivers.map((r) => r[0])
      const final = generateField(seed, 1024).rivers.map((r) => r[0])
      const shared = preview.filter((a) => final.some((b) => near(a, b))).length
      expect(shared / preview.length, seed).toBeGreaterThanOrEqual(0.7)
    }
  })

  it('lago não conta como oceano e fica acima do nível do mar', () => {
    for (const seed of SEEDS) {
      const f = generateField(seed, 128, params({ ocean: 30 }))
      const ocean = f.biome.filter(isOcean).length / f.biome.length
      expect(Math.abs(ocean - 0.3), seed).toBeLessThanOrEqual(0.02)
      const { seaLevel } = elevationLevels(f.elevation, params({ ocean: 30 }))
      f.biome.forEach((b, i) => {
        if (b === BIOME.lake) expect(f.elevation[i]).toBeGreaterThanOrEqual(seaLevel)
      })
    }
  })
})

describe('rios com os sliders (ADR 0006)', () => {
  it('os sete sliders de limiar não mudam o traçado: o Oceano só corta o rio na costa nova', () => {
    for (const seed of SEEDS) {
      const size = 128
      const elevation = composeElevation(sampleTerrainNoise(seed, size), DEFAULT_WORLD_PARAMS)
      const traces = traceHydrology(seed, elevation, size).traces.map((t) => [...t])
      const base = generateField(seed, size)
      for (const over of [{ beach: 90 }, { desert: 60, forest: 10 }, { mountains: 80 }, { snow: 0 }, { temperature: 0 }]) {
        const f = generateField(seed, size, params(over))
        expect(f.rivers, `${seed} ${JSON.stringify(over)}`).toEqual(base.rivers)
        expect(f.biome.map((b) => (b === BIOME.lake ? 1 : 0))).toEqual(base.biome.map((b) => (b === BIOME.lake ? 1 : 0)))
      }
      for (const ocean of [10, 45, 80]) {
        // Cada rio é um começo do traçado de uma nascente: mudar o oceano só muda onde ele termina.
        for (const river of generateField(seed, size, params({ ocean })).rivers) {
          const cells = river.map((p) => Math.floor(p.v * size) * size + Math.floor(p.u * size))
          const trace = traces.find((t) => t[0] === cells[0])
          expect(trace, `${seed} oceano ${ocean}`).toBeDefined()
          expect(cells).toEqual(trace!.slice(0, cells.length))
        }
      }
    }
  })

  it('Tamanho do continente e Rugosidade da costa refazem o traçado', () => {
    const base = generateField('rpg-world', 128).rivers
    expect(generateField('rpg-world', 128, params({ continentSize: 10 })).rivers).not.toEqual(base)
    expect(generateField('rpg-world', 128, params({ coastRoughness: 95 })).rivers).not.toEqual(base)
  })
})
