/**
 * Valor no percentil `q` (0 a 1) de `values`: o limiar abaixo do qual fica a fração `q` dos
 * valores. Ordena uma cópia (ordem numérica do typed array, determinística).
 */
export function quantile(values: Float32Array, q: number): number {
  if (values.length === 0) throw new Error('quantile: lista vazia')
  const sorted = values.slice().sort()
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))
  return sorted[i]
}
