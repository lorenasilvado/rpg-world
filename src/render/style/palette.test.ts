import { describe, expect, it } from 'vitest'
import tokens from '../../../docs/design/tokens.json'
import { BIOMES, BIOME_TONES, CANVAS_BACKGROUND, COAST_STROKE, hexToRgb } from './palette'

const biomeTokens: Record<string, string[]> = tokens.map.biome

describe('paleta do mapa (AC-M0-06, AC-M0-08)', () => {
  it('tem os 3 tons de cada bioma de tokens.json → map.biome, na ordem sombra, base, luz', () => {
    expect([...BIOMES].sort()).toEqual(Object.keys(biomeTokens).sort())
    for (const b of BIOMES) expect(BIOME_TONES[b]).toEqual(biomeTokens[b])
  })

  it('tem o traço da costa e o fundo do canvas de tokens.json', () => {
    expect(COAST_STROKE).toEqual(tokens.map.stroke.coast)
    expect(CANVAS_BACKGROUND).toBe(tokens.map.canvasBackground)
  })

  it('converte #RRGGBB em rgb', () => {
    expect(hexToRgb('#1F4E79')).toEqual([31, 78, 121])
  })
})
