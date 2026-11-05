import decorUrl from './decor.png'
import type { Biome } from './palette'

/**
 * Spritesheet inicial dos ícones decorativos (`decor.png`, 512×128: quadros de 128 px lado a lado,
 * com o pé do ícone na borda de baixo).
 * Origem: Kenney "Cartography Pack", CC0 (LICENSE-kenney-cartography-pack.txt e README.md desta pasta).
 */
export const DECOR_SHEET_URL = decorUrl

export const DECOR_FRAME_SIZE = 128

export const DECOR_FRAMES = {
  mountain: { x: 0, y: 0 },
  snowMountain: { x: 128, y: 0 },
  pine: { x: 256, y: 0 },
  cactus: { x: 384, y: 0 },
} as const

export type DecorKind = keyof typeof DECOR_FRAMES

/** Tamanho de cada ícone no mapa, em px (a 100% de zoom). */
export const DECOR_SIZE: Record<DecorKind, number> = {
  mountain: 48,
  snowMountain: 48,
  pine: 28,
  cactus: 26,
}

/** Chance de um ponto da grade de amostragem receber o ícone (controla a densidade). */
export const DECOR_DENSITY: Record<DecorKind, number> = {
  mountain: 0.4,
  snowMountain: 0.4,
  pine: 0.75,
  cactus: 0.22,
}

/** Ícones possíveis em cada bioma (vazio = sem decoração). */
export const DECOR_BY_BIOME: Record<Biome, readonly DecorKind[]> = {
  deepOcean: [],
  shallowWater: [],
  beach: [],
  grassland: [],
  forest: ['pine'],
  desert: ['cactus'],
  hill: [],
  rockyMountain: ['mountain'],
  snow: ['snowMountain'],
}
