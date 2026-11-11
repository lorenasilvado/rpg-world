import { describe, expect, it } from 'vitest'
import type { WorldParams } from '../types'
import { createFieldCache, fieldBytes } from './fieldCache'
import { generateField } from './generateField'
import { GOLDEN_HASHES, GOLDEN_SIZE } from './golden'
import { hashField } from './hashField'
import { DEFAULT_WORLD_PARAMS } from './params'

const SIZE = 96
const P = DEFAULT_WORLD_PARAMS
const hash = (seed: string, size: number, params: WorldParams = P) => hashField(generateField(seed, size, params))

describe('cache do ruído da seed (#45)', () => {
  it('gera o mesmo campo que generateField, nos hashes de referência', () => {
    const cache = createFieldCache()
    for (const { seed, params, hash: golden } of GOLDEN_HASHES) {
      expect(hashField(cache.generate(seed, GOLDEN_SIZE, params ?? P).field)).toBe(golden)
    }
  })

  it('o que muda invalida só o que depende dele (ADR 0006)', () => {
    const cache = createFieldCache()
    const steps: { seed: string; params: WorldParams; size?: number; recomputed: string }[] = [
      { seed: 'a', params: P, recomputed: 'noise' },
      { seed: 'a', params: { ...P, ocean: 30 }, recomputed: 'classification' },
      { seed: 'a', params: { ...P, ocean: 30, beach: 80, desert: 40, forest: 20 }, recomputed: 'classification' },
      { seed: 'a', params: { ...P, mountains: 70, snow: 10, temperature: 90 }, recomputed: 'classification' },
      { seed: 'a', params: { ...P, continentSize: 20 }, recomputed: 'elevation' },
      { seed: 'a', params: { ...P, continentSize: 20, ocean: 60 }, recomputed: 'classification' },
      { seed: 'a', params: { ...P, continentSize: 20, coastRoughness: 90 }, recomputed: 'elevation' },
      { seed: 'a', params: { ...P, continentSize: 20, coastRoughness: 90 }, size: 48, recomputed: 'noise' },
      // O outro tamanho continua no cache: a prévia e o mapa final se alternam.
      { seed: 'a', params: { ...P, continentSize: 20, coastRoughness: 90, ocean: 20 }, recomputed: 'classification' },
      { seed: 'b', params: P, recomputed: 'noise' },
      // Trocar a seed esvaziou o cache: a seed antiga é refeita do zero.
      { seed: 'a', params: P, recomputed: 'noise' },
    ]
    for (const { seed, params, size = SIZE, recomputed } of steps) {
      const r = cache.generate(seed, size, params)
      expect({ seed, params, size, recomputed: r.recomputed }).toEqual({ seed, params, size, recomputed })
      // Reaproveitar nunca muda o resultado: o campo é o mesmo da geração do zero.
      expect(hashField(r.field)).toBe(hash(seed, size, params))
    }
  })

  it('o campo devolvido não divide arrays com o cache: alterá-lo não muda a próxima geração', () => {
    const cache = createFieldCache()
    const first = cache.generate('c', SIZE, P).field
    first.elevation.fill(0)
    first.moisture.fill(0)
    first.biome.fill(0)
    expect(hashField(cache.generate('c', SIZE, { ...P, ocean: 50 }).field)).toBe(hash('c', SIZE, { ...P, ocean: 50 }))
  })

  it('valida o pedido como generateField', () => {
    const cache = createFieldCache()
    expect(() => cache.generate('a', 1, P)).toThrow(/tamanho inválido/)
    expect(() => cache.generate('a', SIZE, { ...P, ocean: 120 })).toThrow(/ocean inválido/)
  })

  it('conta a memória: 6 camadas de ruído, 2 de clima, a elevação e os lagos por tamanho', () => {
    const cache = createFieldCache()
    expect(cache.bytes()).toBe(0)
    const { field } = cache.generate('d', SIZE, P)
    const n = SIZE * SIZE
    const traces = cache.bytes() - (8 * 4 * n + 4 * n + n)
    expect(traces).toBeGreaterThanOrEqual(0)
    expect(traces).toBeLessThan(4 * n)
    // Elevação, umidade e temperatura em Float32, bioma e sombra em 1 byte, mais decoração e rios.
    expect(fieldBytes(field)).toBeGreaterThanOrEqual(3 * 4 * n + 2 * n)
  })
})
