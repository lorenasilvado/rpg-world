import decorUrl from './decor.png'
import type { Biome } from './palette'

/**
 * Spritesheet inicial dos ícones decorativos (`decor.png`, 512×128: quadros de 128 px lado a lado).
 * Origem: Kenney "Map Pack", CC0 (LICENSE-kenney-map-pack.txt e README.md desta pasta).
 */
export const DECOR_SHEET_URL = decorUrl

export const DECOR_FRAME_SIZE = 128

export const DECOR_FRAMES = {
  pine: { x: 0, y: 0 },
  roundTree: { x: 128, y: 0 },
  cactus: { x: 256, y: 0 },
  rock: { x: 384, y: 0 },
} as const

export type DecorKind = keyof typeof DECOR_FRAMES

/** Ícones possíveis em cada bioma (vazio = sem decoração). */
export const DECOR_BY_BIOME: Record<Biome, readonly DecorKind[]> = {
  deepOcean: [],
  shallowWater: [],
  beach: [],
  grassland: [],
  forest: ['pine', 'pine', 'roundTree'],
  desert: ['cactus'],
  hill: [],
  rockyMountain: ['rock'],
  snow: [],
}
