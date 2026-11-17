import { describe, expect, it } from 'vitest'
import { BIOME, generateField } from '../../core'
import { BIOMES } from '../../render/style/palette'
import { BIOME_LABELS, biomeShares, distribution } from './distribution'

describe('Distribuição do mapa (AC-F1-18)', () => {
  it('conta a fração real de cada bioma, célula a célula', () => {
    const biome = new Uint8Array([BIOME.deepOcean, BIOME.deepOcean, BIOME.desert, BIOME.forest])
    const shares = biomeShares(biome)
    expect(shares[BIOME.deepOcean]).toBe(0.5)
    expect(shares[BIOME.desert]).toBe(0.25)
    expect(shares[BIOME.forest]).toBe(0.25)
    expect(shares[BIOME.snow]).toBe(0)
  })

  it('lista só os biomas presentes, na ordem do campo, com nome, cor e porcentagem arredondada', () => {
    const biome = new Uint8Array(1000)
    biome.fill(BIOME.desert, 0, 333)
    biome.fill(BIOME.deepOcean, 333, 1000)
    expect(distribution(biome)).toEqual([
      { biome: 'deepOcean', label: 'Oceano', color: '#2B6CA3', share: 0.667, percent: 67 },
      { biome: 'desert', label: 'Deserto', color: '#E6B866', share: 0.333, percent: 33 },
    ])
  })

  it('num campo gerado, as frações somam 1 e cada bioma da paleta tem nome', () => {
    const field = generateField('valdora', 64)
    const total = distribution(field.biome).reduce((sum, s) => sum + s.share, 0)
    expect(total).toBeCloseTo(1, 10)
    for (const b of BIOMES) expect(BIOME_LABELS[b]).toBeTruthy()
  })

  it('sem células, não lista nada', () => {
    expect(distribution(new Uint8Array(0))).toEqual([])
  })
})
