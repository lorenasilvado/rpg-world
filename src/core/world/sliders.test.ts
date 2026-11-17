import { describe, expect, it } from 'vitest'
import { BIOME, type CoreField, type WorldParams } from '../types'
import { generateField } from './generateField'
import { DEFAULT_WORLD_PARAMS } from './params'

// AC-F1-05: cada um dos 9 sliders muda o mapa na direção da tabela de sliders da spec. Para cada
// slider, o mapa com o valor baixo e com o alto (o resto no padrão), na prévia 256², em duas seeds
// (mais seeds pesam na suíte, que roda em paralelo).

const SEEDS = ['rpg-world', 'valdora']
const SIZE = 256
const field = (seed: string, over: Partial<WorldParams>) => generateField(seed, SIZE, { ...DEFAULT_WORLD_PARAMS, ...over })
const count = (f: CoreField, ...biomes: number[]) => f.biome.reduce((n, b) => (biomes.includes(b) ? n + 1 : n), 0)
const isOcean = (b: number) => b === BIOME.deepOcean || b === BIOME.shallowWater

/** Terra que encosta no oceano (4 vizinhas): quanto mais recortada a costa, maior. */
function coastLength(f: CoreField) {
  let n = 0
  for (let y = 1; y < f.height - 1; y++) {
    for (let x = 1; x < f.width - 1; x++) {
      const i = y * f.width + x
      if (isOcean(f.biome[i])) continue
      if ([i - 1, i + 1, i - f.width, i + f.width].some((j) => isOcean(f.biome[j]))) n++
    }
  }
  return n
}

/** Fração da terra no maior pedaço de terra (8 vizinhas): perto de 1 é pangeia; menor, ilhas. */
function largestLandShare(f: CoreField) {
  const seen = new Uint8Array(f.biome.length)
  let land = 0
  let largest = 0
  for (let start = 0; start < f.biome.length; start++) {
    if (seen[start] || isOcean(f.biome[start])) continue
    let size = 0
    const stack = [start]
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop()!
      size++
      const x = i % f.width
      const y = Math.floor(i / f.width)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= f.width || ny >= f.height) continue
          const j = ny * f.width + nx
          if (!seen[j] && !isOcean(f.biome[j])) {
            seen[j] = 1
            stack.push(j)
          }
        }
      }
    }
    land += size
    largest = Math.max(largest, size)
  }
  return largest / land
}

const SLIDERS: { key: keyof WorldParams; low: number; high: number; measure: (f: CoreField) => number; grows: boolean; what: string }[] = [
  { key: 'ocean', low: 25, high: 70, measure: (f) => count(f, BIOME.deepOcean, BIOME.shallowWater), grows: true, what: 'mais água' },
  { key: 'beach', low: 10, high: 80, measure: (f) => count(f, BIOME.beach), grows: true, what: 'mais praia' },
  { key: 'desert', low: 5, high: 60, measure: (f) => count(f, BIOME.desert), grows: true, what: 'mais deserto' },
  { key: 'forest', low: 10, high: 80, measure: (f) => count(f, BIOME.forest), grows: true, what: 'mais floresta' },
  { key: 'mountains', low: 10, high: 70, measure: (f) => count(f, BIOME.rockyMountain, BIOME.snow), grows: true, what: 'mais montanha' },
  {
    key: 'snow',
    low: 10,
    high: 90,
    measure: (f) => count(f, BIOME.snow) / Math.max(1, count(f, BIOME.rockyMountain, BIOME.snow)),
    grows: true,
    what: 'mais picos nevados que rochosos',
  },
  { key: 'continentSize', low: 10, high: 90, measure: largestLandShare, grows: true, what: 'menos ilhas, mais pangeia' },
  { key: 'coastRoughness', low: 10, high: 90, measure: coastLength, grows: true, what: 'costa mais recortada' },
  { key: 'temperature', low: 15, high: 85, measure: (f) => count(f, BIOME.snow, BIOME.frozenField), grows: false, what: 'menos neve e campo gelado' },
]

describe('cada slider muda o mapa na direção da tabela (AC-F1-05)', () => {
  for (const s of SLIDERS) {
    it(`${s.key}: do ${s.low} para o ${s.high}, ${s.what}`, () => {
      for (const seed of SEEDS) {
        const low = s.measure(field(seed, { [s.key]: s.low }))
        const high = s.measure(field(seed, { [s.key]: s.high }))
        if (s.grows) expect(high, seed).toBeGreaterThan(low)
        else expect(high, seed).toBeLessThan(low)
      }
    })
  }
})
