import { describe, expect, it } from 'vitest'
import { generateField, hashField } from '../core'
import { generatorApi } from './generatorApi'

describe('API do worker de geração', () => {
  it('gera o mesmo campo do núcleo, com o tempo medido', () => {
    const r = generatorApi.generate({ seed: 'rpg-world', size: 64 })
    expect(r.seed).toBe('rpg-world')
    expect(r.field.width).toBe(64)
    expect(hashField(r.field)).toBe(hashField(generateField('rpg-world', 64)))
    expect(r.workerMs).toBeGreaterThanOrEqual(0)
  })

  it('sem passar pelo postMessage, os buffers continuam no lugar (não transferidos)', () => {
    generatorApi.generate({ seed: 'x', size: 16 })
    expect(generatorApi.lastResultTransferred()).toBe(false)
  })
})
