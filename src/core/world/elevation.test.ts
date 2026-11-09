import { describe, expect, it } from 'vitest'
import { BIOME, type CoreField, type WorldParams } from '../types'
import { BORDER_ELEVATION, composeElevation, sampleTerrainNoise } from './elevation'
import { generateField } from './generateField'
import { DEFAULT_WORLD_PARAMS } from './params'

const SEEDS = ['rpg-world', 'Aldebaran', '42', 'valdora', 'mar do norte']
const params = (over: Partial<WorldParams>): WorldParams => ({ ...DEFAULT_WORLD_PARAMS, ...over })
const isWater = (b: number) => b === BIOME.deepOcean || b === BIOME.shallowWater

function waterShare(f: CoreField): number {
  let water = 0
  for (const b of f.biome) if (isWater(b)) water++
  return water / f.biome.length
}

/** Pares de células vizinhas em que uma é água e a outra é terra: o comprimento da costa. */
function coastLength(f: CoreField): number {
  let coast = 0
  for (let y = 0; y < f.height - 1; y++) {
    for (let x = 0; x < f.width - 1; x++) {
      const i = y * f.width + x
      if (isWater(f.biome[i]) !== isWater(f.biome[i + 1])) coast++
      if (isWater(f.biome[i]) !== isWater(f.biome[i + f.width])) coast++
    }
  }
  return coast
}

/** Tamanho, em células, de cada massa de terra (vizinhança de 4 células). */
function landMasses(f: CoreField): number[] {
  const seen = new Uint8Array(f.biome.length)
  const masses: number[] = []
  for (let start = 0; start < f.biome.length; start++) {
    if (seen[start] || isWater(f.biome[start])) continue
    seen[start] = 1
    const stack = [start]
    let cells = 0
    while (stack.length > 0) {
      const i = stack.pop() as number
      cells++
      for (const j of [i - 1, i + 1, i - f.width, i + f.width]) {
        if (j < 0 || j >= f.biome.length || seen[j] || isWater(f.biome[j])) continue
        seen[j] = 1
        stack.push(j)
      }
    }
    masses.push(cells)
  }
  return masses
}

function expectAllBordersWater(f: CoreField, label: string) {
  const { width: w, height: h } = f
  for (let x = 0; x < w; x++) {
    expect(isWater(f.biome[x]), `${label}: topo ${x}`).toBe(true)
    expect(isWater(f.biome[(h - 1) * w + x]), `${label}: base ${x}`).toBe(true)
  }
  for (let y = 0; y < h; y++) {
    expect(isWater(f.biome[y * w]), `${label}: esquerda ${y}`).toBe(true)
    expect(isWater(f.biome[y * w + w - 1]), `${label}: direita ${y}`).toBe(true)
  }
}

describe('oceano por quantil (AC-F1-02)', () => {
  it('com o Oceano em 30, 30% ± 2% do mapa é água, em várias seeds', () => {
    for (const seed of SEEDS) {
      expect(Math.abs(waterShare(generateField(seed, 256, params({ ocean: 30 }))) - 0.3), seed).toBeLessThanOrEqual(0.02)
    }
  })

  it('o alvo vale de 5% a 95%, com qualquer forma de continente', () => {
    for (const ocean of [5, 20, 50, 80, 95]) {
      for (const shape of [{ continentSize: 0, coastRoughness: 100 }, { continentSize: 100, coastRoughness: 0 }]) {
        const share = waterShare(generateField('Aldebaran', 256, params({ ocean, ...shape })))
        expect(Math.abs(share - ocean / 100), `oceano ${ocean}, ${JSON.stringify(shape)}`).toBeLessThanOrEqual(0.02)
      }
    }
  })
})

describe('borda do mapa (AC-F1-06)', () => {
  it('tem oceano em todas as bordas, com os sliders nos extremos', () => {
    const extremes = [0, 100]
    for (const seed of SEEDS.slice(0, 2)) {
      for (const ocean of [0, 5, 100]) {
        for (const continentSize of extremes) {
          for (const coastRoughness of extremes) {
            for (const mountains of extremes) {
              const p = params({ ocean, continentSize, coastRoughness, mountains })
              expectAllBordersWater(generateField(seed, 64, p), `${seed} ${JSON.stringify(p)}`)
            }
          }
        }
      }
    }
  })

  it('com o Oceano em 0, só a borda é água; em 100, o mapa todo', () => {
    const none = generateField('rpg-world', 64, params({ ocean: 0 }))
    expect(waterShare(none)).toBeCloseTo((64 * 4 - 4) / (64 * 64), 5)
    expect(waterShare(generateField('rpg-world', 64, params({ ocean: 100 })))).toBe(1)
  })
})

describe('elevação de produção', () => {
  it('fica entre 0 e 1, e só a borda fica no valor da borda', () => {
    for (const continentSize of [0, 100]) {
      const size = 64
      const e = composeElevation(sampleTerrainNoise('rpg-world', size), { continentSize, coastRoughness: 100 })
      for (let i = 0; i < e.length; i++) {
        const x = i % size
        const y = Math.floor(i / size)
        const border = x === 0 || y === 0 || x === size - 1 || y === size - 1
        expect(e[i] === BORDER_ELEVATION, `célula ${x},${y}`).toBe(border)
        expect(e[i]).toBeGreaterThanOrEqual(0)
        expect(e[i]).toBeLessThanOrEqual(1)
      }
    }
  })

  it('as camadas de ruído só dependem da seed', () => {
    expect(sampleTerrainNoise('rpg-world', 32)).toEqual(sampleTerrainNoise('rpg-world', 32))
    expect(sampleTerrainNoise('outra', 32).broad).not.toEqual(sampleTerrainNoise('rpg-world', 32).broad)
  })

  it('os sliders de limiar não mudam a elevação', () => {
    const base = generateField('rpg-world', 64).elevation
    for (const over of [{ ocean: 10 }, { beach: 90 }, { desert: 80 }, { forest: 5 }, { mountains: 90 }, { snow: 0 }, { temperature: 100 }]) {
      expect(generateField('rpg-world', 64, params(over)).elevation, JSON.stringify(over)).toEqual(base)
    }
  })

  it('as cordilheiras levantam a terra alta', () => {
    const noise = sampleTerrainNoise('rpg-world', 128)
    const flat = { ...noise, ridged: new Float32Array(noise.ridged.length) }
    const shape = { continentSize: 50, coastRoughness: 50 }
    const relief = (e: Float32Array) => {
      let high = 0
      for (const v of e) if (v > 0.7) high++
      return high
    }
    expect(composeElevation(noise, shape)).not.toEqual(composeElevation(flat, shape))
    expect(relief(composeElevation(noise, shape))).toBeGreaterThan(0)
  })
})

describe('sliders de forma', () => {
  it('mais Rugosidade da costa deixa a costa mais longa', () => {
    for (const seed of SEEDS) {
      const smooth = coastLength(generateField(seed, 256, params({ coastRoughness: 0 })))
      const rough = coastLength(generateField(seed, 256, params({ coastRoughness: 100 })))
      expect(rough, seed).toBeGreaterThan(smooth * 1.15)
    }
  })

  it('Tamanho do continente vai de ilhas a uma massa dominante', () => {
    for (const seed of SEEDS) {
      const largestShare = (m: number[]) => Math.max(...m) / m.reduce((a, b) => a + b, 0)
      const islands = landMasses(generateField(seed, 256, params({ continentSize: 0 })))
      const pangea = landMasses(generateField(seed, 256, params({ continentSize: 100 })))
      expect(islands.length, seed).toBeGreaterThan(pangea.length)
      expect(largestShare(pangea), seed).toBeGreaterThan(largestShare(islands))
    }
  })
})
