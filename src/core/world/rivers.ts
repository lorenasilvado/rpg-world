import { createRandom } from '../rng/random'
import type { RiverPoint } from '../types'
import { BORDER_ELEVATION } from './elevation'
import { quantile } from './quantile'

/**
 * Rios e lagos, sem hidrologia (ADR 0006): os rios nascem nas terras altas e descem pelo gradiente
 * da elevação; quando a descida fica presa numa depressão, a depressão vira lago e o rio termina
 * nele.
 *
 * Tudo aqui depende só da seed e da elevação. Os sete sliders de limiar não mudam a elevação, então
 * não mudam o traçado (`traceHydrology`); o Oceano só decide onde o rio é cortado na costa
 * (`cutRivers`). Tamanho do continente e Rugosidade da costa mudam a elevação, e o traçado é
 * refeito com ela.
 *
 * As constantes fazem parte do gerador: mudar qualquer uma exige subir `GENERATOR_VERSION`.
 */

/**
 * Fração mais alta do mapa onde os rios podem nascer. É fixa, e não o bioma montanha, para que o
 * slider Montanhas não mude as nascentes; com os sliders no padrão ela é a zona das montanhas.
 */
const SOURCE_SHARE = 0.06
/** Quantos rios o mapa tenta ter. */
const RIVER_COUNT = 24
/** Sorteios de nascente antes de desistir (mapas com pouca terra alta têm menos rios). */
const SOURCE_ATTEMPTS = 4000
/** Distância mínima entre duas nascentes, em frações da largura do mapa. */
const SOURCE_SPACING = 0.05
/**
 * Depressão menor que isso (em fração das células do mapa) não vira lago: o rio a enche e segue
 * pelo transbordo. Sem isso, as pequenas covas do ruído prenderiam quase todo rio logo depois da
 * nascente.
 */
const MIN_LAKE_SHARE = 0.001
/** Tamanho máximo de um lago, em fração das células do mapa (a mesma na prévia e no mapa final). */
const MAX_LAKE_SHARE = 0.004

/** Traçado dos rios e lagos, antes do corte na costa. */
export type Hydrology = {
  /** 1 nas células de lago. Um lago abaixo do nível do mar é oceano na classificação. */
  lake: Uint8Array
  /**
   * Células de cada rio, da nascente até a borda do mapa ou um lago. O rio sempre desce, exceto ao
   * atravessar uma depressão pequena, onde segue no nível da água até o transbordo; esse nível
   * nunca passa da altura da nascente.
   */
  traces: Int32Array[]
}

/** Vizinhança de 8 células, em ordem fixa (empates de elevação ficam com o primeiro vizinho). */
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

export function traceHydrology(seed: string, elevation: Float32Array, size: number): Hydrology {
  const n = size * size
  const lake = new Uint8Array(n)
  const traces: Int32Array[] = []
  const minLake = Math.max(2, Math.floor(MIN_LAKE_SHARE * n))
  const maxLake = Math.max(minLake, Math.floor(MAX_LAKE_SHARE * n))
  // Nível da água: começa na elevação e sobe nas depressões que os rios atravessam, para o rio
  // seguinte (e o mesmo rio, depois do transbordo) não cair de novo nelas.
  const surface = elevation.slice()
  const basins = new Basins(surface, size)
  const onPath = new Int32Array(n)
  let stamp = 0
  for (const source of pickSources(seed, elevation, size)) {
    stamp++
    const path: number[] = [source]
    onPath[source] = stamp
    let i = source
    let climbs = false
    // A borda é a célula mais baixa do mapa (e sempre oceano): o rio chega ao mar nela.
    while (surface[i] !== BORDER_ELEVATION && !lake[i]) {
      const next = lowestNeighbor(surface, size, i)
      if (next >= 0) {
        if (onPath[next] === stamp) {
          // Não acontece com o nível da água sempre subindo; se acontecer, o rio para num lago.
          lake[i] = 1
          break
        }
        path.push(next)
        onPath[next] = stamp
        i = next
        continue
      }
      const basin = basins.fill(i, lake, maxLake)
      if (basin.outlet < 0 || basin.cells.length >= minLake) {
        // A descida ficou presa: a depressão vira lago e o rio termina nele.
        lake[i] = 1
        for (const c of basin.cells) if (surface[c] < basin.level) lake[c] = 1
        break
      }
      if (basin.level > elevation[source]) {
        // Para sair da depressão, o rio teria de subir acima da nascente: a nascente é descartada.
        climbs = true
        break
      }
      // Depressão pequena: o rio a atravessa, da célula onde entrou nela até o transbordo.
      const entry = path.findIndex((c) => basins.contains(c))
      path.length = entry + 1
      for (const c of basins.route(path[entry], basin.outlet)) {
        path.push(c)
        onPath[c] = stamp
      }
      for (const c of basin.cells) if (surface[c] < basin.level) surface[c] = basin.level
      i = basin.outlet
    }
    if (!climbs) traces.push(Int32Array.from(path))
  }
  return { lake, traces }
}

/**
 * Corta cada rio na primeira célula de água oceânica ou de lago, ou onde ele encontra um rio
 * anterior (vira afluente). A célula do corte entra no rio, para ele tocar a água. Cada ponto é o
 * centro da célula, de 0 a 1.
 */
export function cutRivers(hydrology: Hydrology, water: Uint8Array, size: number): RiverPoint[][] {
  const onRiver = new Uint8Array(size * size)
  const rivers: RiverPoint[][] = []
  for (const trace of hydrology.traces) {
    let end = trace.length
    for (let k = 0; k < trace.length; k++) {
      const i = trace[k]
      if (water[i] || hydrology.lake[i] || onRiver[i]) {
        end = k + 1
        break
      }
    }
    if (end < 2) continue
    const river: RiverPoint[] = []
    for (let k = 0; k < end; k++) {
      const i = trace[k]
      onRiver[i] = 1
      river.push({ u: ((i % size) + 0.5) / size, v: (Math.floor(i / size) + 0.5) / size })
    }
    rivers.push(river)
  }
  return rivers
}

/**
 * Nascentes sorteadas pelo RNG da seed (`seed#rios`) em coordenadas de 0 a 1, para a prévia e o
 * mapa final sortearem os mesmos pontos: valem as que caem na terra alta, longe das anteriores.
 */
function pickSources(seed: string, elevation: Float32Array, size: number): number[] {
  const random = createRandom(`${seed}#rios`)
  const highLevel = quantile(elevation, 1 - SOURCE_SHARE)
  const picked: { u: number; v: number; i: number }[] = []
  const spacing2 = SOURCE_SPACING * SOURCE_SPACING
  for (let attempt = 0; attempt < SOURCE_ATTEMPTS && picked.length < RIVER_COUNT; attempt++) {
    const u = random()
    const v = random()
    const i = Math.floor(v * size) * size + Math.floor(u * size)
    if (elevation[i] < highLevel || elevation[i] === BORDER_ELEVATION) continue
    let free = true
    for (const p of picked) {
      const du = p.u - u
      const dv = p.v - v
      if (du * du + dv * dv < spacing2 || p.i === i) {
        free = false
        break
      }
    }
    if (free) picked.push({ u, v, i })
  }
  return picked.map((p) => p.i)
}

/** Vizinho mais baixo que a célula `i`, ou -1 se ela é um fundo de depressão. */
function lowestNeighbor(elevation: Float32Array, size: number, i: number): number {
  const x = i % size
  const y = Math.floor(i / size)
  let best = -1
  let bestElevation = elevation[i]
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
    const j = ny * size + nx
    if (elevation[j] < bestElevation) {
      best = j
      bestElevation = elevation[j]
    }
  }
  return best
}

/** Uma depressão cheia até o transbordo. */
type Basin = {
  /** Células visitadas, do fundo até a margem (as abaixo de `level` ficam debaixo da água). */
  cells: number[]
  /** Nível da água: a altura do ponto de transbordo. */
  level: number
  /** Célula mais baixa que o nível, por onde a água sai, ou -1 (achou um lago ou passou do máximo). */
  outlet: number
}

/**
 * Enche depressões a partir do fundo, sempre pela célula mais baixa da margem (fila de prioridade),
 * até achar o transbordo: uma célula da margem mais baixa que o nível da água. Para antes se
 * encostar num lago que já existe ou passar de `maxCells`.
 */
class Basins {
  private readonly surface: Float32Array
  private readonly size: number
  private readonly queued: Int32Array
  private readonly member: Int32Array
  private readonly from: Int32Array
  private stamp = 0
  private readonly heap = new MinHeap()

  constructor(surface: Float32Array, size: number) {
    this.surface = surface
    this.size = size
    this.queued = new Int32Array(size * size)
    this.member = new Int32Array(size * size)
    this.from = new Int32Array(size * size)
  }

  fill(pit: number, lake: Uint8Array, maxCells: number): Basin {
    const { surface, heap } = this
    const stamp = ++this.stamp
    heap.clear()
    const cells = [pit]
    this.member[pit] = stamp
    this.queued[pit] = stamp
    this.pushNeighbors(pit, stamp)
    let level = surface[pit]
    let outlet = -1
    while (heap.length > 0 && cells.length < maxCells) {
      const c = heap.pop(surface)
      if (lake[c]) break
      if (surface[c] < level) {
        outlet = c
        break
      }
      level = surface[c]
      cells.push(c)
      this.member[c] = stamp
      this.pushNeighbors(c, stamp)
    }
    return { cells, level, outlet }
  }

  /** `true` se a célula está na última depressão cheia. */
  contains(cell: number): boolean {
    return this.member[cell] === this.stamp
  }

  /**
   * Caminho por dentro da última depressão, de `start` até `outlet` (inclusive, sem `start`), pela
   * busca em largura na ordem fixa dos vizinhos.
   */
  route(start: number, outlet: number): number[] {
    const { size, member, from, stamp } = this
    const seen = -stamp
    const queue = [start]
    from[start] = -1
    member[start] = seen
    let end = -1
    for (let head = 0; head < queue.length && end < 0; head++) {
      const c = queue[head]
      const x = c % size
      const y = Math.floor(c / size)
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
        const j = ny * size + nx
        if (j === outlet) {
          end = c
          break
        }
        if (member[j] !== stamp) continue
        member[j] = seen
        from[j] = c
        queue.push(j)
      }
    }
    const route = [outlet]
    for (let c = end; c !== start; c = from[c]) route.push(c)
    return route.reverse()
  }

  private pushNeighbors(i: number, stamp: number): void {
    const { size } = this
    const x = i % size
    const y = Math.floor(i / size)
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
      const j = ny * size + nx
      if (this.queued[j] === stamp) continue
      this.queued[j] = stamp
      this.heap.push(j, this.surface)
    }
  }
}

/** Fila de prioridade de células pela elevação; empates saem pelo menor índice (determinístico). */
class MinHeap {
  private items: number[] = []

  get length(): number {
    return this.items.length
  }

  clear(): void {
    this.items.length = 0
  }

  push(cell: number, elevation: Float32Array): void {
    const a = this.items
    a.push(cell)
    let k = a.length - 1
    while (k > 0) {
      const parent = (k - 1) >> 1
      if (!less(a[k], a[parent], elevation)) break
      ;[a[k], a[parent]] = [a[parent], a[k]]
      k = parent
    }
  }

  pop(elevation: Float32Array): number {
    const a = this.items
    const top = a[0]
    const last = a.pop() as number
    if (a.length > 0) {
      a[0] = last
      let k = 0
      for (;;) {
        const l = 2 * k + 1
        const r = l + 1
        let m = k
        if (l < a.length && less(a[l], a[m], elevation)) m = l
        if (r < a.length && less(a[r], a[m], elevation)) m = r
        if (m === k) break
        ;[a[k], a[m]] = [a[m], a[k]]
        k = m
      }
    }
    return top
  }
}

function less(a: number, b: number, elevation: Float32Array): boolean {
  return elevation[a] < elevation[b] || (elevation[a] === elevation[b] && a < b)
}
