import { createNoise3D } from 'simplex-noise'

export type FbmOptions = {
  /** Número de camadas de ruído. */
  octaves: number
  /** Multiplicador da frequência a cada camada. */
  lacunarity: number
  /** Multiplicador da amplitude a cada camada (sem `Math.pow`: só multiplicações). */
  gain: number
}

/** Opções padrão do fBm. Congeladas: alterá-las mudaria o ruído sem subir `GENERATOR_VERSION`. */
export const DEFAULT_FBM: Readonly<FbmOptions> = Object.freeze({ octaves: 5, lacunarity: 2, gain: 0.5 })

/**
 * fBm de ruído simplex 3D, normalizado para [-1, 1]. O ruído 3D permite trocar o plano pela
 * esfera sem trocar o gerador. A tabela de permutação vem do `random` (nunca de `Math.random`).
 */
export function createFbm3D(
  random: () => number,
  { octaves, lacunarity, gain }: FbmOptions = DEFAULT_FBM,
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
      sum += a * noise(x * f, y * f, z * f)
      a *= gain
      f *= lacunarity
    }
    return sum / norm
  }
}
