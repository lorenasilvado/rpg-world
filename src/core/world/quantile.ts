/**
 * Valores nos percentis `qs` (0 a 1) de `values`: para cada `q`, o limiar abaixo do qual fica a
 * fração `q` dos valores. Ordena uma cópia uma vez só (ordem numérica do typed array,
 * determinística) e lê todos os percentis dela.
 */
export function quantiles(values: Float32Array, qs: readonly number[]): number[] {
  if (values.length === 0) throw new Error('quantile: lista vazia')
  const sorted = values.slice().sort()
  return qs.map((q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))])
}

/** Valor no percentil `q` (0 a 1) de `values`. */
export function quantile(values: Float32Array, q: number): number {
  return quantiles(values, [q])[0]
}
