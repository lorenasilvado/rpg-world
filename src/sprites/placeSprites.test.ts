import { describe, expect, it } from 'vitest'
import { generateMockTerrain, type MockTerrain } from '../mockup/terrain'
import { DECOR_BY_BIOME } from '../render/style/decor'
import { BIOMES } from '../render/style/palette'
import { placeSprites } from './placeSprites'

const terrain = generateMockTerrain('valdora', 200, 125)

describe('placeSprites', () => {
  it('coloca exatamente a quantidade pedida, ordenada por y', () => {
    const decor = placeSprites(terrain, 'valdora', 5000)
    expect(decor).toHaveLength(5000)
    for (let i = 1; i < decor.length; i++) expect(decor[i].y).toBeGreaterThanOrEqual(decor[i - 1].y)
  })

  it('só usa os ícones do bioma de cada posição', () => {
    for (const d of placeSprites(terrain, 'valdora', 500)) {
      const biome = BIOMES[terrain.biome[Math.floor(d.y) * terrain.width + Math.floor(d.x)]]
      expect(DECOR_BY_BIOME[biome]).toContain(d.kind)
    }
  })

  it('a mesma seed dá as mesmas posições', () => {
    expect(placeSprites(terrain, 'a', 50)).toEqual(placeSprites(terrain, 'a', 50))
    expect(placeSprites(terrain, 'a', 50)).not.toEqual(placeSprites(terrain, 'b', 50))
  })

  it('falha em vez de travar quando não há bioma com decoração', () => {
    const water: MockTerrain = { ...terrain, biome: new Uint8Array(terrain.biome.length) }
    expect(() => placeSprites(water, 'a', 1)).toThrow()
  })
})
