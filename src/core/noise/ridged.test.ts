import { createNoise3D } from 'simplex-noise'
import { describe, expect, it } from 'vitest'
import { createRandom } from '../rng/random'
import { createRidged3D } from './ridged'

const ONE = { octaves: 1, lacunarity: 2, gain: 0.5 }
const TWO = { octaves: 2, lacunarity: 2.03, gain: 0.5 }

function samples(ridged: (x: number, y: number, z: number) => number): number[] {
  const out: number[] = []
  for (let i = 0; i < 400; i++) out.push(ridged((i % 20) * 0.37, Math.floor(i / 20) * 0.41, 0))
  return out
}

describe('ruído ridged', () => {
  it('fica entre 0 e 1', () => {
    for (const options of [ONE, TWO]) {
      for (const v of samples(createRidged3D(createRandom('ridged'), options))) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('com uma oitava, é 1 menos o módulo do simplex da mesma seed', () => {
    const ridged = createRidged3D(createRandom('ridged'), ONE)
    const noise = createNoise3D(createRandom('ridged'))
    for (let i = 0; i < 50; i++) {
      const x = i * 0.73
      const y = i * 0.29
      expect(ridged(x, y, 0)).toBe(1 - Math.abs(noise(x, y, 0)))
    }
  })

  it('a mesma seed dá os mesmos valores; outra seed, outros', () => {
    const a = samples(createRidged3D(createRandom('ridged'), TWO))
    expect(samples(createRidged3D(createRandom('ridged'), TWO))).toEqual(a)
    expect(samples(createRidged3D(createRandom('outra'), TWO))).not.toEqual(a)
  })

  it('a segunda oitava acrescenta detalhe', () => {
    expect(samples(createRidged3D(createRandom('ridged'), TWO))).not.toEqual(
      samples(createRidged3D(createRandom('ridged'), ONE)),
    )
  })
})
