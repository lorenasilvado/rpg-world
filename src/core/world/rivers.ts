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
  const minLake = minLakeCells(size)
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
      // Só fica debaixo da água o que está abaixo do nível (a margem fica de fora); o fundo, sempre.
      const flooded = basin.cells.filter((c) => c === i || surface[c] < basin.level)
      // Por onde a água sai da depressão pequena: o transbordo ou um lago que ela encosta.
      const exit = basin.outlet >= 0 ? basin.outlet : basin.lakeCell
      if (flooded.length >= minLake || exit < 0) {
        // A descida ficou presa numa depressão grande: ela vira lago e o rio termina nele.
        for (const c of flooded) lake[c] = 1
        break
      }
      if (Math.max(basin.level, elevation[exit]) > elevation[source]) {
        // Para sair da depressão, o rio teria de subir acima da nascente: a nascente é descartada.
        climbs = true
        break
      }
      // Depressão pequena: não vira lago. O rio a atravessa, da célula onde entrou nela até a saída:
      // segue pelo transbordo, ou termina no lago que ela encosta.
      const entry = path.findIndex((c) => basins.contains(c))
      path.length = entry + 1
      for (const c of basins.route(path[entry], exit)) {
        path.push(c)
        onPath[c] = stamp
      }
      for (const c of basin.cells) if (surface[c] < basin.level) surface[c] = basin.level
      i = exit
    }
    if (!climbs) traces.push(Int32Array.from(path))
  }
  return { lake, traces }
}

/** Menor lago, em células: a depressão com menos células debaixo da água não vira lago. */
export function minLakeCells(size: number): number {
  return Math.max(2, Math.floor(MIN_LAKE_SHARE * size * size))
}

/**
 * Lagos que aparecem no mapa: as células de lago fora do oceano. A parte de um lago abaixo do
 * nível do mar vira oceano; se o que sobra encosta no mar e fica abaixo do tamanho mínimo, volta a
 * ser terra (`docs/specs/geracao-terreno.md`, Regras).
 */
export function visibleLakes(lake: Uint8Array, water: Uint8Array, size: number): Uint8Array {
  const n = size * size
  const min = minLakeCells(size)
  const visible = new Uint8Array(n)
  const seen = new Uint8Array(n)
  for (let start = 0; start < n; start++) {
    if (!lake[start] || water[start] || seen[start]) continue
    const cells = [start]
    seen[start] = 1
    let touchesWater = false
    for (let head = 0; head < cells.length; head++) {
      forEachNeighbor(cells[head], size, (j) => {
        if (water[j]) touchesWater = true
        else if (lake[j] && !seen[j]) {
          seen[j] = 1
          cells.push(j)
        }
      })
    }
    if (touchesWater && cells.length < min) continue
    for (const c of cells) visible[c] = 1
  }
  return visible
}

/**
 * Corta cada rio na primeira célula de água oceânica ou de lago visível, ou onde ele encontra um
 * rio anterior (vira afluente). A célula do corte entra no rio, para ele tocar a água. O rio que
 * termina num resto de lago que voltou a ser terra segue por ele até o mar que ele encosta, sem
 * subir acima da nascente; se não dá, o rio não existe. Cada ponto é o centro da célula, de 0 a 1.
 */
export function cutRivers(
  hydrology: Hydrology,
  water: Uint8Array,
  lakes: Uint8Array,
  elevation: Float32Array,
  size: number,
): RiverPoint[][] {
  const onRiver = new Uint8Array(size * size)
  const rivers: RiverPoint[][] = []
  for (const trace of hydrology.traces) {
    let cells: number[] = []
    let stopped = false
    for (const i of trace) {
      cells.push(i)
      if (water[i] || lakes[i] || onRiver[i]) {
        stopped = true
        break
      }
    }
    const last = cells[cells.length - 1]
    if (!stopped && hydrology.lake[last]) {
      const way = toWater(last, hydrology.lake, water, elevation, elevation[cells[0]], size)
      if (!way) continue
      cells = cells.concat(way)
    }
    if (cells.length < 2) continue
    const river: RiverPoint[] = []
    for (const i of cells) {
      onRiver[i] = 1
      river.push({ u: ((i % size) + 0.5) / size, v: (Math.floor(i / size) + 0.5) / size })
    }
    rivers.push(river)
  }
  return rivers
}

/**
 * Caminho por dentro do resto de lago, de `start` (sem ela) até a primeira célula de água que ele
 * encosta (inclusive), sem passar de `ceiling` de elevação; `null` se não há.
 */
function toWater(
  start: number,
  lake: Uint8Array,
  water: Uint8Array,
  elevation: Float32Array,
  ceiling: number,
  size: number,
): number[] | null {
  const from = new Map<number, number>([[start, -1]])
  const queue = [start]
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]
    let found = -1
    forEachNeighbor(c, size, (j) => {
      if (found >= 0 || from.has(j)) return
      if (water[j]) found = j
      else if (lake[j] && elevation[j] <= ceiling) {
        from.set(j, c)
        queue.push(j)
      }
    })
    if (found >= 0) {
      const way = [found]
      for (let k = c; k !== start; k = from.get(k)!) way.push(k)
      return way.reverse()
    }
  }
  return null
}

/** Chama `visit` para cada vizinha das 8, na ordem fixa de `NEIGHBORS`. */
function forEachNeighbor(i: number, size: number, visit: (j: number) => void): void {
  const x = i % size
  const y = Math.floor(i / size)
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
    visit(ny * size + nx)
  }
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
  /** Célula de um lago que já existe e que a depressão encostou antes do transbordo, ou -1. */
  lakeCell: number
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
    let lakeCell = -1
    while (heap.length > 0 && cells.length < maxCells) {
      const c = heap.pop(surface)
      if (lake[c]) {
        lakeCell = c
        break
      }
      if (surface[c] < level) {
        outlet = c
        break
      }
      level = surface[c]
      cells.push(c)
      this.member[c] = stamp
      this.pushNeighbors(c, stamp)
    }
    return { cells, level, outlet, lakeCell }
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
