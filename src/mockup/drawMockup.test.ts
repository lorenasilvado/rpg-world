import { describe, expect, it } from 'vitest'
import { DECOR_BY_BIOME, DECOR_FRAMES, DECOR_FRAME_SIZE } from '../render/style/decor'
import { BIOMES, BIOME_TONES, hexToRgb } from '../render/style/palette'
import { coastSegments, placeDecor, terrainPixels } from './drawMockup'
import { generateMockTerrain } from './terrain'

const W = 120
const H = 75
const terrain = generateMockTerrain('valdora', W, H)

describe('desenho do mockup', () => {
  it('pinta cada célula com um dos 3 tons do seu bioma, chapado (AC-M0-06)', () => {
    const px = terrainPixels(terrain)
    for (let i = 0; i < terrain.biome.length; i++) {
      const expected = hexToRgb(BIOME_TONES[BIOMES[terrain.biome[i]]][terrain.tone[i]])
      expect([px[i * 4], px[i * 4 + 1], px[i * 4 + 2], px[i * 4 + 3]]).toEqual([...expected, 255])
    }
  })

  it('traça a costa só nas arestas entre terra e água (AC-M0-06)', () => {
    const segs = coastSegments(terrain)
    expect(segs.length).toBeGreaterThan(0)
    const landAt = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < W && y < H ? terrain.land[y * W + x] : 0
    for (const [x0, y0, x1] of segs) {
      // Aresta vertical separa (x-1, y) de (x, y); horizontal separa (x, y-1) de (x, y).
      const [a, b] = x0 === x1 ? [landAt(x0 - 1, y0), landAt(x0, y0)] : [landAt(x0, y0 - 1), landAt(x0, y0)]
      expect(a + b).toBe(1)
    }
  })

  it('põe ícones só nos biomas que têm decoração, ordenados por y (AC-M0-07)', () => {
    const decor = placeDecor(terrain, 'valdora')
    expect(decor.length).toBeGreaterThan(0)
    expect(new Set(decor.map((d) => d.kind)).size).toBeGreaterThanOrEqual(3)
    for (const d of decor) {
      const b = BIOMES[terrain.biome[Math.floor(d.y) * W + Math.floor(d.x)]]
      expect(DECOR_BY_BIOME[b]).toContain(d.kind)
    }
    expect(decor.map((d) => d.y)).toEqual([...decor.map((d) => d.y)].sort((a, b) => a - b))
  })

  it('tem 3 a 4 ícones no spritesheet, em quadros de 128 px (AC-M0-07, AC-M0-08)', () => {
    const frames = Object.values(DECOR_FRAMES)
    expect(frames.length).toBeGreaterThanOrEqual(3)
    expect(frames.length).toBeLessThanOrEqual(4)
    expect(DECOR_FRAME_SIZE).toBe(128)
    frames.forEach((f, i) => expect(f).toEqual({ x: i * 128, y: 0 }))
  })
})
