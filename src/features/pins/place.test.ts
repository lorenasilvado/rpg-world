import { describe, expect, it } from 'vitest'
import { BIOME } from '../../core'
import { duplicateOffset, pinBiome, pinCoords, pinPlace, pinsOnWater, pinsOnWaterLabel } from './place'

const field = { width: 2, height: 2, biome: new Uint8Array([BIOME.deepOcean, BIOME.hill, BIOME.forest, BIOME.desert]) }

describe('lugar do pin no drawer (AC-F3-06)', () => {
  it('o bioma é o da célula sob o pin, no campo exibido', () => {
    expect(pinBiome(field, { u: 0.75, v: 0.1 })).toBe('Colina')
    expect(pinBiome(field, { u: 0.1, v: 0.9 })).toBe('Floresta')
    expect(pinBiome(field, { u: 1, v: 1 })).toBe('Deserto')
    expect(pinBiome(null, { u: 0.5, v: 0.5 })).toBeNull()
  })

  it('as coordenadas vão em unidades do mundo (0 a 1024)', () => {
    expect(pinCoords({ u: 710 / 1024, v: 580 / 1024 })).toBe('x 710, y 580')
  })

  it('a linha junta o bioma e as coordenadas; sem campo, só as coordenadas', () => {
    expect(pinPlace(field, { u: 0.75, v: 0.25 })).toBe('Colina · x 768, y 256')
    expect(pinPlace(null, { u: 0.75, v: 0.25 })).toBe('x 768, y 256')
  })
})

describe('pins sobre a água (AC-F1-30)', () => {
  const water = {
    width: 2,
    height: 2,
    biome: new Uint8Array([BIOME.deepOcean, BIOME.shallowWater, BIOME.lake, BIOME.beach]),
  }
  const at = (id: string, u: number, v: number) => ({ id, pos: { u, v } })

  it('conta os pins em oceano (fundo ou raso) e em lago, na ordem da lista; praia e terra não contam', () => {
    const pins = [at('praia', 0.9, 0.9), at('lago', 0.1, 0.9), at('fundo', 0.1, 0.1), at('raso', 0.9, 0.1)]
    expect(pinsOnWater(water, pins).map((p) => p.id)).toEqual(['lago', 'fundo', 'raso'])
    expect(pinsOnWater(field, [at('colina', 0.75, 0.1), at('floresta', 0.1, 0.9)])).toEqual([])
  })

  it('na borda do mapa, vale a última célula; sem campo, nenhum pin', () => {
    expect(pinsOnWater(water, [at('canto', 1, 0)]).map((p) => p.id)).toEqual(['canto'])
    expect(pinsOnWater(null, [at('a', 0.1, 0.1)])).toEqual([])
  })

  it('o texto concorda com o número', () => {
    expect(pinsOnWaterLabel(1)).toBe('1 pin ficou sobre a água')
    expect(pinsOnWaterLabel(2)).toBe('2 pins ficaram sobre a água')
  })
})

describe('Duplicar (AC-F3-09)', () => {
  it('a cópia cai 36 px à direita e 64 px abaixo na tela, no zoom atual', () => {
    expect(duplicateOffset({ u: 0.5, v: 0.5 }, 1)).toEqual({ u: 36 / 1024, v: 64 / 1024 })
    expect(duplicateOffset({ u: 0.5, v: 0.5 }, 2)).toEqual({ u: 18 / 1024, v: 32 / 1024 })
  })

  it('perto da borda direita ou de baixo, a cópia vai para o outro lado', () => {
    expect(duplicateOffset({ u: 0.99, v: 0.99 }, 1)).toEqual({ u: -36 / 1024, v: -64 / 1024 })
  })
})
