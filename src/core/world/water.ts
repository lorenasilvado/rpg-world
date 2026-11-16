import { BORDER_ELEVATION } from './elevation'
import { quantile } from './quantile'

/**
 * Oceano e água interior (ADR 0009): a água abaixo do nível do mar só é oceano se tem ligação com
 * a borda do mapa (vizinhança de 8). A que fica presa no continente é água interior, que vira lago
 * na classificação.
 *
 * O alvo do slider Oceano (AC-F1-02) conta só o oceano ligado à borda. Para isso, cada célula tem
 * o seu nível de transbordo (`spillLevels`): o menor nível do mar com que ela fica debaixo da água
 * e ligada à borda. Com o nível do mar `L`, o oceano são as células com transbordo abaixo de `L`;
 * o nível do mar é o quantil do transbordo na fração pedida, e o oceano ligado fica exatamente no
 * alvo. O transbordo só depende da elevação, então é calculado junto do traçado dos rios e fica no
 * cache do worker, só onde ele difere da elevação (as depressões, `Depressions`): fora delas, o
 * transbordo é a própria elevação.
 */

/** Células em que o transbordo fica acima da elevação (dentro de depressões), e o transbordo delas. */
export type Depressions = { cells: Int32Array; level: Float32Array }

/**
 * Nível de transbordo de cada célula: o maior valor de elevação no caminho mais baixo dela até a
 * borda (priority-flood, enchendo a partir da borda pela célula mais baixa). O resultado só depende
 * da elevação, não da ordem dos empates.
 */
export function spillLevels(elevation: Float32Array, size: number): Float32Array {
  const n = size * size
  const spill = new Float32Array(n)
  const done = new Uint8Array(n)
  const heap = new SpillHeap(n, spill)
  for (let i = 0; i < n; i++) {
    const x = i % size
    const y = Math.floor(i / size)
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
      spill[i] = elevation[i]
      done[i] = 1
      heap.push(i)
    }
  }
  while (heap.length > 0) {
    const c = heap.pop()
    const level = spill[c]
    const x = c % size
    const y = Math.floor(c / size)
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy
      if (ny < 0 || ny >= size) continue
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        if (nx < 0 || nx >= size) continue
        const j = ny * size + nx
        if (done[j]) continue
        done[j] = 1
        spill[j] = elevation[j] > level ? elevation[j] : level
        heap.push(j)
      }
    }
  }
  return spill
}

/** As depressões do transbordo: as células em que ele passa da elevação. */
export function depressions(elevation: Float32Array, size: number): Depressions {
  const spill = spillLevels(elevation, size)
  let count = 0
  for (let i = 0; i < spill.length; i++) if (spill[i] > elevation[i]) count++
  const cells = new Int32Array(count)
  const level = new Float32Array(count)
  let k = 0
  for (let i = 0; i < spill.length; i++) {
    if (spill[i] <= elevation[i]) continue
    cells[k] = i
    level[k++] = spill[i]
  }
  return { cells, level }
}

export type SeaWater = {
  /** 1 no oceano: a borda e as células ligadas a ela abaixo do nível do mar. */
  ocean: Uint8Array
  /** 1 na água interior: abaixo do nível do mar e sem ligação com a borda. */
  inland: Uint8Array
}

/**
 * Oceano ligado à borda (a fração `ocean`, de 0 a 1, do mapa) e água interior, a partir da
 * elevação e das depressões do transbordo. A borda é sempre oceano, inclusive com `ocean` em 0.
 */
export function seaWater(elevation: Float32Array, pits: Depressions, ocean: number): SeaWater {
  const n = elevation.length
  const spill = elevation.slice()
  for (let k = 0; k < pits.cells.length; k++) spill[pits.cells[k]] = pits.level[k]
  const seaLevel = ocean >= 1 ? Infinity : quantile(spill, ocean)
  // Uma bacia cheia tem o mesmo transbordo em todas as células: no empate com o nível do mar, ela
  // entra inteira no oceano ou fica inteira de fora, o que deixar o oceano mais perto do alvo.
  let below = 0
  let tied = 0
  for (let i = 0; i < n; i++) {
    if (spill[i] < seaLevel) below++
    else if (spill[i] === seaLevel) tied++
  }
  const target = Math.floor(ocean * n)
  const withTie = below + tied - target < target - below
  const sea = new Uint8Array(n)
  const inland = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    // Só a borda tem elevação igual a `BORDER_ELEVATION` (ver `composeElevation`).
    if (elevation[i] === BORDER_ELEVATION || spill[i] < seaLevel || (withTie && spill[i] === seaLevel)) sea[i] = 1
    else if (elevation[i] < seaLevel) inland[i] = 1
  }
  return { ocean: sea, inland }
}

/** Fila de prioridade de células pelo transbordo; empates saem pelo menor índice. */
class SpillHeap {
  private readonly items: Int32Array
  private readonly key: Float32Array
  length = 0

  constructor(capacity: number, key: Float32Array) {
    this.items = new Int32Array(capacity)
    this.key = key
  }

  private less(a: number, b: number): boolean {
    const ka = this.key[a]
    const kb = this.key[b]
    return ka < kb || (ka === kb && a < b)
  }

  push(cell: number): void {
    const a = this.items
    let k = this.length++
    while (k > 0) {
      const parent = (k - 1) >> 1
      if (!this.less(cell, a[parent])) break
      a[k] = a[parent]
      k = parent
    }
    a[k] = cell
  }

  pop(): number {
    const a = this.items
    const top = a[0]
    const last = a[--this.length]
    let k = 0
    for (;;) {
      const l = 2 * k + 1
      if (l >= this.length) break
      const r = l + 1
      const m = r < this.length && this.less(a[r], a[l]) ? r : l
      if (!this.less(a[m], last)) break
      a[k] = a[m]
      k = m
    }
    a[k] = last
    return top
  }
}
