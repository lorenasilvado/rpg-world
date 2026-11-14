import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_PARAMS, generateField, hashField } from '../core'
import { terrainPixels } from '../render/layers/terrainPixels'
import { generatorApi } from './generatorApi'

describe('API do worker de geração', () => {
  it('gera o mesmo campo do núcleo, com o tempo e a memória medidos', () => {
    const r = generatorApi.generate({ seed: 'rpg-world', size: 64 })
    expect(r.seed).toBe('rpg-world')
    expect(r.size).toBe(64)
    expect(r.params).toEqual(DEFAULT_WORLD_PARAMS)
    expect(r.field.width).toBe(64)
    expect(hashField(r.field)).toBe(hashField(generateField('rpg-world', 64)))
    expect(r.workerMs).toBeGreaterThanOrEqual(0)
    expect(r.memory.cacheBytes).toBeGreaterThan(0)
    expect(r.memory.fieldBytes).toBeGreaterThan(0)
  })

  it('monta no worker o RGBA do terreno, com o tempo medido (#90)', () => {
    const r = generatorApi.generate({ seed: 'textura', size: 64 })
    expect(r.terrainRgba).toEqual(terrainPixels(generateField('textura', 64), 'textura'))
    expect(r.terrainMs).toBeGreaterThanOrEqual(0)
    // O RGBA entra na memória do que vai para a thread principal.
    expect(r.memory.fieldBytes).toBeGreaterThanOrEqual(64 * 64 * 4)
  })

  it('guarda o ruído da seed: um slider de limiar só reclassifica', () => {
    generatorApi.generate({ seed: 'cache', size: 32 })
    const params = { ...DEFAULT_WORLD_PARAMS, ocean: 60 }
    const r = generatorApi.generate({ seed: 'cache', size: 32, params })
    expect(r.recomputed).toBe('classification')
    expect(hashField(r.field)).toBe(hashField(generateField('cache', 32, params)))
  })

  it('sem passar pelo postMessage, os buffers continuam no lugar (não transferidos)', () => {
    generatorApi.generate({ seed: 'x', size: 16 })
    expect(generatorApi.lastResultTransferred()).toBe(false)
  })
})
