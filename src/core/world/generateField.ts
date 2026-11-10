import { BIOME, type CoreField, type WorldParams } from '../types'
import { BORDER_ELEVATION, composeElevation, sampleTerrainNoise } from './elevation'
import { DEFAULT_WORLD_PARAMS, validateWorldParams } from './params'
import { quantiles } from './quantile'

/**
 * Gera o campo do mundo: elevação de produção e oceano por quantil. A classificação da terra
 * ainda é mínima, só por elevação; clima, biomas de terra e praias entram depois.
 *
 * As constantes de classificação deste arquivo também fazem parte do gerador: mudar qualquer uma
 * exige subir `GENERATOR_VERSION` e atualizar os hashes de `golden.ts`.
 */

/** Fração da água que é rasa. */
const SHALLOW_SHARE = 0.16
/** Fração da terra que é montanha, com o slider Montanhas em 100. */
const MOUNTAIN_SHARE = 0.4
/** Fração da terra que é colina, além das montanhas, e quanto ela cresce até Montanhas em 100. */
const HILL_SHARE_BASE = 0.04
const HILL_SHARE_RANGE = 0.12

export function generateField(
  seed: string,
  size = 256,
  params: WorldParams = DEFAULT_WORLD_PARAMS,
): CoreField {
  if (!Number.isInteger(size) || size < 2) throw new Error(`generateField: tamanho inválido (${size})`)
  validateWorldParams(params)
  const elevation = composeElevation(sampleTerrainNoise(seed, size), params)

  // Classificação por quantis: os sliders pedem frações, não limiares absolutos.
  const ocean = params.ocean / 100
  const mountains = (params.mountains / 100) * MOUNTAIN_SHARE
  const hills = mountains + HILL_SHARE_BASE + (params.mountains / 100) * HILL_SHARE_RANGE
  const snow = params.snow / 100
  const landSpan = 1 - ocean
  const [seaQuantile, deepLevel, hillLevel, mountainQuantile, snowQuantile] = quantiles(elevation, [
    ocean,
    ocean * (1 - SHALLOW_SHARE),
    ocean + landSpan * (1 - hills),
    ocean + landSpan * (1 - mountains),
    ocean + landSpan * (1 - mountains * snow),
  ])
  // Em 100% (ou em 0% de terra alta) o quantil cai na célula mais alta, que ficaria de fora do `e <`.
  const seaLevel = ocean >= 1 ? Infinity : seaQuantile
  const mountainLevel = mountains > 0 ? mountainQuantile : Infinity
  const snowLevel = mountains * snow > 0 ? snowQuantile : Infinity

  const n = size * size
  const biome = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const e = elevation[i]
    // Só a borda tem elevação igual a `BORDER_ELEVATION`: o interior começa em `MIN_INTERIOR`, acima
    // dela (ver `composeElevation`). Por isso a borda é sempre água, com qualquer Oceano.
    if (e === BORDER_ELEVATION || e < deepLevel) biome[i] = BIOME.deepOcean
    else if (e < seaLevel) biome[i] = BIOME.shallowWater
    else if (e < hillLevel) biome[i] = BIOME.grassland
    else if (e < mountainLevel) biome[i] = BIOME.hill
    else if (e < snowLevel) biome[i] = BIOME.rockyMountain
    else biome[i] = BIOME.snow
  }

  return { width: size, height: size, elevation, biome }
}
