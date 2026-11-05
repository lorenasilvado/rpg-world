import { describe, expect, it } from 'vitest'
import { BIOME_ID } from '../render/style/palette'
import { DEFAULT_MOCK_PARAMS, generateMockTerrain, seededRandom } from './terrain'

const W = 180
const H = 112
const terrain = generateMockTerrain('valdora', W, H)

/** Distância (8 vizinhos) da célula i até a terra mais próxima, por força bruta. */
function distToLand(i: number) {
  const x = i % W
  const y = Math.floor(i / W)
  let best = Infinity
  for (let j = 0; j < terrain.land.length; j++) {
    if (!terrain.land[j]) continue
    const d = Math.max(Math.abs((j % W) - x), Math.abs(Math.floor(j / W) - y))
    if (d < best) best = d
  }
  return best
}

describe('terreno do mockup (AC-M0-06)', () => {
  it('é determinístico pela seed', () => {
    const again = generateMockTerrain('valdora', W, H)
    expect(again.biome).toEqual(terrain.biome)
    expect(again.tone).toEqual(terrain.tone)
    expect(generateMockTerrain('outra', W, H).biome).not.toEqual(terrain.biome)
    expect(seededRandom('a')()).toBe(seededRandom('a')())
  })

  it('tem o percentual de oceano pedido', () => {
    const water = terrain.land.reduce((n, v) => n + (v ? 0 : 1), 0) / terrain.land.length
    expect(water).toBeGreaterThan(DEFAULT_MOCK_PARAMS.ocean - 0.01)
    expect(water).toBeLessThan(DEFAULT_MOCK_PARAMS.ocean + 0.01)
  })

  it('tem os 9 biomas e só tons 0, 1 e 2', () => {
    expect(new Set(terrain.biome).size).toBe(9)
    expect([...new Set(terrain.tone)].sort()).toEqual([0, 1, 2])
  })

  it('cerca a terra com um anel de água rasa da largura pedida', () => {
    const width = DEFAULT_MOCK_PARAMS.shallowWidth
    // Amostra de células de água: rasa se e só se está a até `width` células da terra.
    for (let i = 0; i < terrain.biome.length; i += 7) {
      if (terrain.land[i]) continue
      const shallow = terrain.biome[i] === BIOME_ID.shallowWater
      expect(shallow).toBe(distToLand(i) <= width)
    }
  })

  it('põe praia em toda célula de terra que encosta na água', () => {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x
        if (!terrain.land[i]) continue
        const touchesWater = [i - 1, i + 1, i - W, i + W].some((j) => !terrain.land[j])
        if (touchesWater) expect(terrain.biome[i]).toBe(BIOME_ID.beach)
      }
    }
  })
})
