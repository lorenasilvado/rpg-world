/**
 * Hillshade pela inclinação, com luz vinda do noroeste: de -127 (encosta na sombra) a 127
 * (encosta virada para a luz); terreno plano, água e a borda ficam em 0. A inclinação é medida
 * por largura do mapa, então a prévia 256² e o mapa 1024² têm o mesmo sombreamento.
 *
 * As constantes fazem parte do gerador: mudar exige subir `GENERATOR_VERSION`.
 */

/** Ganho: quanto da inclinação vira sombra antes do corte em ±127. */
const SHADE_GAIN = 12
/** Componente x e y da direção da luz (noroeste, normalizada). */
const LIGHT = 0.7071067811865476

export function hillshade(elevation: Float32Array, isWater: Uint8Array, size: number): Int8Array {
  const shade = new Int8Array(size * size)
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x
      if (isWater[i]) continue
      // Diferença central, em altura por largura do mapa.
      const dzdx = (elevation[i + 1] - elevation[i - 1]) * 0.5 * size
      const dzdy = (elevation[i + size] - elevation[i - size]) * 0.5 * size
      // Luz do noroeste: a encosta que sobe para o sudeste (dz > 0) fica de frente para ela.
      const lit = (dzdx + dzdy) * LIGHT * SHADE_GAIN
      shade[i] = Math.max(-127, Math.min(127, Math.round(lit)))
    }
  }
  return shade
}
