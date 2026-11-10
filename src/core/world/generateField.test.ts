import { describe, expect, it } from 'vitest'
import { BIOME, GENERATOR_VERSION } from '../types'
import { generateField } from './generateField'
import { GOLDEN_HASHES, GOLDEN_SIZE, GOLDEN_VERSION } from './golden'
import { hashField } from './hashField'
import { DEFAULT_WORLD_PARAMS } from './params'
import { quantile, quantiles } from './quantile'

describe('núcleo de geração (AC-M0-10)', () => {
  it('gera o campo 256² a partir de uma seed', () => {
    const f = generateField('rpg-world')
    expect(f.width).toBe(256)
    expect(f.height).toBe(256)
    expect(f.elevation).toHaveLength(256 * 256)
    expect(f.biome).toHaveLength(256 * 256)
    for (const e of f.elevation) {
      expect(e).toBeGreaterThanOrEqual(0)
      expect(e).toBeLessThanOrEqual(1)
    }
  })

  it('a mesma seed gera o mesmo campo; outra seed gera outro', () => {
    const a = generateField('rpg-world')
    expect(generateField('rpg-world')).toEqual(a)
    expect(hashField(generateField('outra seed'))).not.toBe(hashField(a))
  })

  it('classifica por quantis: a fração de água é a pedida', () => {
    const f = generateField('rpg-world')
    const water = f.biome.filter((b) => b === BIOME.deepOcean || b === BIOME.shallowWater).length
    expect(water / f.biome.length).toBeCloseTo(DEFAULT_WORLD_PARAMS.ocean / 100, 2)
    const ocean30 = generateField('rpg-world', 256, { ...DEFAULT_WORLD_PARAMS, ocean: 30 })
    const water30 = ocean30.biome.filter((b) => b <= BIOME.shallowWater).length
    expect(water30 / ocean30.biome.length).toBeCloseTo(0.3, 2)
  })

  it('com Montanhas em 0 não há montanha nem neve; com Neve em 0 não há neve', () => {
    const noMountains = generateField('rpg-world', 64, { ...DEFAULT_WORLD_PARAMS, mountains: 0 })
    expect(noMountains.biome.filter((b) => b === BIOME.rockyMountain || b === BIOME.snow)).toHaveLength(0)
    const noSnow = generateField('rpg-world', 64, { ...DEFAULT_WORLD_PARAMS, snow: 0 })
    expect(noSnow.biome.filter((b) => b === BIOME.snow)).toHaveLength(0)
    expect(noSnow.biome.filter((b) => b === BIOME.rockyMountain).length).toBeGreaterThan(0)
  })

  it('recusa tamanho inválido', () => {
    expect(() => generateField('x', 1)).toThrow()
    expect(() => generateField('x', 2.5)).toThrow()
  })
})

describe('hash do campo (AC-M0-11)', () => {
  it('os hashes de referência são da versão atual do gerador', () => {
    expect(GOLDEN_VERSION).toBe(GENERATOR_VERSION)
  })

  it(`bate com os hashes de referência no Node (gerador v${GENERATOR_VERSION})`, () => {
    for (const { seed, params, hash } of GOLDEN_HASHES) {
      expect(hashField(generateField(seed, GOLDEN_SIZE, params)), seed).toBe(hash)
    }
  })

  it('muda se uma única célula muda', () => {
    const f = generateField('rpg-world')
    const h = hashField(f)
    f.biome[1234] ^= 1
    expect(hashField(f)).not.toBe(h)
    f.biome[1234] ^= 1
    f.elevation[99] += 1e-6
    expect(hashField(f)).not.toBe(h)
  })
})

describe('quantile', () => {
  it('dá exatamente o mesmo resultado que ordenar tudo, também com valores repetidos', () => {
    let state = 7
    const next = () => (state = (Math.imul(state, 1103515245) + 12345) >>> 0) / 4294967296
    for (let round = 0; round < 40; round++) {
      const n = 1 + Math.floor(next() * 3000)
      const levels = round % 2 === 0 ? 0 : 1 + Math.floor(next() * 20)
      const v = new Float32Array(n)
      for (let i = 0; i < n; i++) v[i] = levels ? Math.floor(next() * levels) : next()
      const qs = [0, next(), next(), 0.5, next(), 1]
      const sorted = v.slice().sort()
      const expected = qs.map((q) => sorted[Math.min(n - 1, Math.floor(q * n))])
      expect(quantiles(v, qs), `rodada ${round}`).toEqual(expected)
    }
  })

  it('devolve o limiar do percentil pedido', () => {
    const v = new Float32Array([5, 1, 4, 2, 3])
    expect(quantile(v, 0)).toBe(1)
    expect(quantile(v, 0.4)).toBe(3)
    expect(quantile(v, 1)).toBe(5)
    expect(() => quantile(new Float32Array(), 0.5)).toThrow()
  })

  it('lê vários percentis de uma ordenação só, com o mesmo valor de cada um', () => {
    const v = new Float32Array([9, 1, 5, 3, 7, 2, 8])
    expect(quantiles(v, [0, 0.25, 0.5, 0.75, 1])).toEqual([1, 2, 5, 8, 9])
    expect(() => quantiles(new Float32Array(), [0.5])).toThrow()
  })
})
