/**
 * Valores nos percentis `qs` (0 a 1) de `values`: para cada `q`, o limiar abaixo do qual fica a
 * fração `q` dos valores, ou seja, o elemento de posição `floor(q * n)` na ordem crescente.
 *
 * Em vez de ordenar tudo, seleciona só essas posições numa cópia (quickselect com partição em três
 * partes, sem aleatoriedade). O resultado é exatamente o da ordenação, com uma fração do custo.
 */
export function quantiles(values: Float32Array, qs: readonly number[]): number[] {
  if (values.length === 0) throw new Error('quantile: lista vazia')
  const n = values.length
  const ranks = qs.map((q) => Math.min(n - 1, Math.max(0, Math.floor(q * n))))
  const order = ranks.map((_, i) => i).sort((a, b) => ranks[a] - ranks[b])
  const work = values.slice()
  const result: number[] = new Array(qs.length)
  // Depois de selecionar a posição k, tudo à esquerda é <= work[k]: a próxima posição, maior ou
  // igual, só precisa ser procurada de k em diante.
  let lo = 0
  for (const index of order) {
    const k = ranks[index]
    select(work, lo, n - 1, k)
    result[index] = work[k]
    lo = k
  }
  return result
}

/** Valor no percentil `q` (0 a 1) de `values`. */
export function quantile(values: Float32Array, q: number): number {
  return quantiles(values, [q])[0]
}

/** Deixa em `a[k]` o valor que ficaria ali com `a[lo..hi]` ordenado. */
function select(a: Float32Array, lo: number, hi: number, k: number): void {
  while (lo < hi) {
    const pivot = medianOfThree(a[lo], a[(lo + hi) >>> 1], a[hi])
    // Partição em três partes: [lo, lt) < pivô, [lt, gt] = pivô, (gt, hi] > pivô.
    let lt = lo
    let gt = hi
    let i = lo
    while (i <= gt) {
      const v = a[i]
      if (v < pivot) {
        a[i] = a[lt]
        a[lt] = v
        lt++
        i++
      } else if (v > pivot) {
        a[i] = a[gt]
        a[gt] = v
        gt--
      } else {
        i++
      }
    }
    if (k < lt) hi = lt - 1
    else if (k > gt) lo = gt + 1
    else return
  }
}

function medianOfThree(x: number, y: number, z: number): number {
  if (x < y) return y < z ? y : x < z ? z : x
  return x < z ? x : y < z ? z : y
}
