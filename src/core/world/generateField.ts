import { BIOME, type CoreField, type WorldParams } from '../types'
import { BORDER_ELEVATION, composeElevation, sampleTerrainNoise } from './elevation'
import { DEFAULT_WORLD_PARAMS } from './params'
import { quantiles } from './quantile'

/**
 * Gera o campo do mundo: elevação de produção e oceano por quantil. A classificação da terra
 * ainda é mínima, só por elevação; clima, biomas de terra e praias entram depois.
 */

/** Fração da água que é rasa. */
const SHALLOW_SHARE = 0.16
/** Fração da terra que é montanha, com o slider Montanhas em 100. */
const MOUNTAIN_SHARE = 0.4

export function generateField(
  seed: string,
  size = 256,
  params: WorldParams = DEFAULT_WORLD_PARAMS,
): CoreField {
  if (!Number.isInteger(size) || size < 2) throw new Error(`generateField: tamanho inválido (${size})`)
  const elevation = composeElevation(sampleTerrainNoise(seed, size), params)

  // Classificação por quantis: os sliders pedem frações, não limiares absolutos.
  const ocean = params.ocean / 100
  const mountains = (params.mountains / 100) * MOUNTAIN_SHARE
  const hills = mountains + 0.04 + (params.mountains / 100) * 0.12
  const snow = params.snow / 100
  const landSpan = 1 - ocean
  const [seaQuantile, deepLevel, hillLevel, mountainLevel, snowLevel] = quantiles(elevation, [
    ocean,
    ocean * (1 - SHALLOW_SHARE),
    ocean + landSpan * (1 - hills),
    ocean + landSpan * (1 - mountains),
    ocean + landSpan * (1 - mountains * snow),
  ])
  // Em 100% o quantil cai na célula mais alta, que ficaria de fora de `e < seaLevel`.
  const seaLevel = ocean >= 1 ? Infinity : seaQuantile

  const n = size * size
  const biome = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const e = elevation[i]
    if (e === BORDER_ELEVATION || e < deepLevel) biome[i] = BIOME.deepOcean
    else if (e < seaLevel) biome[i] = BIOME.shallowWater
    else if (e < hillLevel) biome[i] = BIOME.grassland
    else if (e < mountainLevel) biome[i] = BIOME.hill
    else if (e < snowLevel) biome[i] = BIOME.rockyMountain
    else biome[i] = BIOME.snow
  }

  return { width: size, height: size, elevation, biome }
}
