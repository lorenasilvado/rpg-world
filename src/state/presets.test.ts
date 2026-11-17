import { describe, expect, it } from 'vitest'
import { BIOME, DEFAULT_WORLD_PARAMS, generateField, type CoreField } from '../core'
import { matchingPreset, PRESETS } from './presets'

const count = (f: CoreField, ...biomes: number[]) => f.biome.filter((b) => biomes.includes(b)).length

describe('presets (AC-F1-16)', () => {
  it('são os 4 da spec, com os 9 parâmetros de 0 a 100 e Desertos + Florestas ≤ 100', () => {
    expect(PRESETS.map((p) => p.name)).toEqual(['Continente temperado', 'Arquipélago', 'Deserto árido', 'Terras geladas'])
    for (const p of PRESETS) {
      expect(Object.keys(p.params).sort(), p.name).toEqual(Object.keys(DEFAULT_WORLD_PARAMS).sort())
      for (const v of Object.values(p.params)) expect(v >= 0 && v <= 100, p.name).toBe(true)
      expect(p.params.desert + p.params.forest, p.name).toBeLessThanOrEqual(100)
    }
  })

  it('"Continente temperado" é o padrão', () => {
    expect(PRESETS[0].params).toEqual(DEFAULT_WORLD_PARAMS)
    expect(matchingPreset(DEFAULT_WORLD_PARAMS)).toBe('temperado')
  })

  it('reconhece o preset pelos valores, e nenhum depois de mexer num slider', () => {
    for (const p of PRESETS) expect(matchingPreset({ ...p.params })).toBe(p.id)
    expect(matchingPreset({ ...DEFAULT_WORLD_PARAMS, ocean: 46 })).toBeNull()
  })

  it('com "Deserto árido", mais de 50% da terra firme sem montanhas é deserto, em várias seeds', () => {
    const arid = PRESETS.find((p) => p.id === 'deserto')!.params
    for (const seed of ['rpg-world', 'valdora', 'Aldebaran', '42', 'mar do norte']) {
      const f = generateField(seed, 256, arid)
      // A terra firme sem montanhas: o que não é água, lago, praia, montanha rochosa nem neve.
      const land = count(f, BIOME.grassland, BIOME.hill, BIOME.forest, BIOME.desert, BIOME.frozenField)
      expect(count(f, BIOME.desert) / land, seed).toBeGreaterThan(0.5)
    }
  })
})
