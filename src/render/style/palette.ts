/**
 * Paleta do mapa: 3 tons chapados por bioma (sombra, base, luz) e os traços.
 * Copiada de docs/design/tokens.json → map (a fonte); o teste palette.test.ts confere a cópia.
 */

export const BIOMES = [
  'deepOcean',
  'shallowWater',
  'beach',
  'grassland',
  'forest',
  'desert',
  'hill',
  'rockyMountain',
  'snow',
  'frozenField',
  'lake',
] as const

export type Biome = (typeof BIOMES)[number]

/** Índice do bioma, na ordem de `BIOMES` (é o valor guardado no `Uint8Array` do campo). */
export const BIOME_ID = Object.fromEntries(BIOMES.map((b, i) => [b, i])) as Record<Biome, number>

/** Ordem dos tons: 0 = sombra, 1 = base, 2 = luz. */
export type Tone = 0 | 1 | 2

export const BIOME_TONES: Record<Biome, readonly [string, string, string]> = {
  deepOcean: ['#1F4E79', '#2B6CA3', '#3A82BF'],
  shallowWater: ['#4A9CC9', '#6BB8DD', '#8FD0EB'],
  beach: ['#D9C08A', '#EBD9A6', '#F5EACB'],
  grassland: ['#6FA544', '#8CC152', '#A8D672'],
  forest: ['#2E6B3A', '#3F8A4B', '#55A55E'],
  desert: ['#D19A4E', '#E6B866', '#F2D08A'],
  hill: ['#7E8F55', '#98A86A', '#B2C184'],
  rockyMountain: ['#6B6560', '#8A837C', '#A9A39C'],
  snow: ['#C9D6DE', '#E4ECF0', '#FFFFFF'],
  frozenField: ['#C9D6DE', '#E4ECF0', '#FFFFFF'],
  lake: ['#4A9CC9', '#6BB8DD', '#8FD0EB'],
}

export const COAST_STROKE = { width: 2, color: '#163A5C' } as const

/** Fundo do canvas fora do mapa. */
export const CANVAS_BACKGROUND = '#1F4E79'

/** Converte `#RRGGBB` em [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
