import { BIOME_TONES, BIOMES, type Biome } from '../../render/style/palette'

/**
 * "Distribuição do mapa" (AC-F1-18): a fração real de cada bioma no campo exibido, contada célula a
 * célula no `Uint8Array` do bioma. Os nomes seguem a ordem de `BIOMES` (a do campo), e a cor é o tom
 * base do bioma na paleta do mapa.
 */
export const BIOME_LABELS: Record<Biome, string> = {
  deepOcean: 'Oceano',
  shallowWater: 'Água rasa',
  beach: 'Praia',
  grassland: 'Campo',
  forest: 'Floresta',
  desert: 'Deserto',
  hill: 'Colina',
  rockyMountain: 'Montanha',
  snow: 'Neve',
  frozenField: 'Campo gelado',
  lake: 'Lago',
}

/** Abaixo disso (1,5%), o bioma fica só na barra (com a porcentagem no título), fora da legenda. */
export const LEGEND_MIN_SHARE = 0.015

export type BiomeShare = { biome: Biome; label: string; color: string; share: number; percent: number }

/** Fração de cada bioma (de 0 a 1, na ordem de `BIOMES`) num campo de biomas. */
export function biomeShares(biome: Uint8Array): Float64Array {
  const counts = new Float64Array(BIOMES.length)
  for (let i = 0; i < biome.length; i++) counts[biome[i]]++
  if (biome.length > 0) for (let b = 0; b < counts.length; b++) counts[b] /= biome.length
  return counts
}

/** Os biomas presentes no campo, na ordem de `BIOMES`, com a porcentagem arredondada. */
export function distribution(biome: Uint8Array): BiomeShare[] {
  const shares = biomeShares(biome)
  return BIOMES.flatMap((b, i) =>
    shares[i] > 0
      ? [{ biome: b, label: BIOME_LABELS[b], color: BIOME_TONES[b][1], share: shares[i], percent: Math.round(shares[i] * 100) }]
      : [],
  )
}
