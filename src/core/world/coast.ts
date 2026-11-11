/**
 * Distância de cada célula até a água mais próxima, em células, pela distância chanfrada 3-4
 * (passos retos valem 3 e diagonais 4, depois divididos por 3). Só usa inteiros: o resultado é o
 * mesmo em qualquer engine. Células de água ficam em 0.
 */
export function distanceToWater(isWater: Uint8Array, size: number): Float32Array {
  const n = size * size
  const far = 0x3fffffff
  const d = new Int32Array(n)
  for (let i = 0; i < n; i++) d[i] = isWater[i] ? 0 : far

  // Passo de cima para baixo: vizinhos já visitados (esquerda e a linha de cima).
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      let best = d[i]
      if (best === 0) continue
      if (x > 0) best = Math.min(best, d[i - 1] + 3)
      if (y > 0) {
        best = Math.min(best, d[i - size] + 3)
        if (x > 0) best = Math.min(best, d[i - size - 1] + 4)
        if (x < size - 1) best = Math.min(best, d[i - size + 1] + 4)
      }
      d[i] = best
    }
  }
  // Passo de baixo para cima: direita e a linha de baixo.
  for (let y = size - 1; y >= 0; y--) {
    for (let x = size - 1; x >= 0; x--) {
      const i = y * size + x
      let best = d[i]
      if (best === 0) continue
      if (x < size - 1) best = Math.min(best, d[i + 1] + 3)
      if (y < size - 1) {
        best = Math.min(best, d[i + size] + 3)
        if (x < size - 1) best = Math.min(best, d[i + size + 1] + 4)
        if (x > 0) best = Math.min(best, d[i + size - 1] + 4)
      }
      d[i] = best
    }
  }

  const result = new Float32Array(n)
  for (let i = 0; i < n; i++) result[i] = d[i] / 3
  return result
}
