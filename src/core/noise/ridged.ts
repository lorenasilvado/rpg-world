import { createNoise3D } from 'simplex-noise'
import type { FbmOptions } from './fbm'

/**
 * Ruído ridged 3D, normalizado para [0, 1]: cada camada é `1 - |ruído|`, que forma cristas finas
 * onde o ruído cruza o zero. A tabela de permutação vem do `random`.
 */
export function createRidged3D(
  random: () => number,
  { octaves, lacunarity, gain }: FbmOptions,
): (x: number, y: number, z: number) => number {
  const noise = createNoise3D(random)
  let norm = 0
  let amp = 1
  for (let o = 0; o < octaves; o++) {
    norm += amp
    amp *= gain
  }
  return (x, y, z) => {
    let sum = 0
    let a = 1
    let f = 1
    for (let o = 0; o < octaves; o++) {
      sum += a * (1 - Math.abs(noise(x * f, y * f, z * f)))
      a *= gain
      f *= lacunarity
    }
    return sum / norm
  }
}
