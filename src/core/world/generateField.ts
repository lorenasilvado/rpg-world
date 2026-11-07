import { createFbm3D } from '../noise/fbm'
import { createRandom } from '../rng/random'
import { BIOME, type CoreField, type CoreParams } from '../types'
import { quantile } from './quantile'

/**
 * Núcleo mínimo do spike de determinismo (#8): elevação por fBm 3D com máscara continental e
 * classificação por quantis de elevação. O pipeline completo (umidade, praias, decoração, rios)
 * é do M1.
 */

export const DEFAULT_CORE_PARAMS: CoreParams = {
  ocean: 0.45,
  shallow: 0.3,
  hills: 0.35,
  mountains: 0.15,
  snow: 0.4,
}

/** Frequência base do ruído, em ciclos por largura do mapa. */
const BASE_FREQUENCY = 3

export function generateField(
  seed: string,
  size = 256,
  params: CoreParams = DEFAULT_CORE_PARAMS,
): CoreField {
  if (!Number.isInteger(size) || size < 2) throw new Error(`generateField: tamanho inválido (${size})`)
  const random = createRandom(seed)
  const fbm = createFbm3D(random)
  const n = size * size
  const elevation = new Float32Array(n)

  // Amostragem no plano: (u, v) de 0 a 1 vira o ponto (u, v, 0) do espaço do ruído.
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const noise = fbm(u * BASE_FREQUENCY, v * BASE_FREQUENCY, 0) * 0.5 + 0.5
      // Máscara continental: 1 no centro, 0 nas bordas (distância ao quadrado, sem sqrt).
      const dx = u - 0.5
      const dy = v - 0.5
      const mask = 1 - Math.min(1, (dx * dx + dy * dy) * 4)
      elevation[y * size + x] = noise * 0.6 + mask * 0.4
    }
  }

  // Classificação por quantis: os sliders pedem frações, não limiares absolutos.
  const seaLevel = quantile(elevation, params.ocean)
  const deepLevel = quantile(elevation, params.ocean * (1 - params.shallow))
  const landStart = params.ocean
  const landSpan = 1 - landStart
  const hillLevel = quantile(elevation, landStart + landSpan * (1 - params.hills))
  const mountainLevel = quantile(elevation, landStart + landSpan * (1 - params.mountains))
  const snowLevel = quantile(elevation, landStart + landSpan * (1 - params.mountains * params.snow))

  const biome = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const e = elevation[i]
    if (e < deepLevel) biome[i] = BIOME.deepOcean
    else if (e < seaLevel) biome[i] = BIOME.shallowWater
    else if (e < hillLevel) biome[i] = BIOME.grassland
    else if (e < mountainLevel) biome[i] = BIOME.hill
    else if (e < snowLevel) biome[i] = BIOME.rockyMountain
    else biome[i] = BIOME.snow
  }

  return { width: size, height: size, elevation, biome }
}
