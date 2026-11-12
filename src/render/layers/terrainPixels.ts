import { BIOME, type CoreField, type RiverPoint } from '../../core/types'
import { BIOMES, BIOME_TONES, COAST_STROKE, RIVER_STYLE, hexToRgb, type Tone } from '../style/palette'

/**
 * Converte o campo gerado na textura RGBA do terreno (uma célula = um pixel), no estilo do mockup
 * aprovado (#7): 3 tons chapados por bioma (paleta posterizada), o hillshade do núcleo nas
 * encostas, o anel de água rasa clareando perto da terra, o contorno da costa e os rios.
 *
 * As distâncias são medidas em células do mapa 1024² (`REF_SIZE`): a prévia 256² tem o mesmo
 * desenho, só com menos detalhe. Nada aqui muda o campo; é só como ele é pintado.
 */

/** Tamanho de referência das distâncias (o mapa final). */
export const REF_SIZE = 1024

/** Limiares do desenho, em células do mapa 1024². */
export const TERRAIN_STYLE = {
  /** Oceano profundo: luz até esta distância da água rasa ou da terra; depois, base. */
  deepLight: 12,
  /** Oceano profundo: base até esta distância; mais longe, sombra. */
  deepBase: 56,
  /** Água rasa e lago: luz até esta distância da terra; depois, base. */
  shallowLight: 4,
  /** Água rasa e lago: base até esta distância da terra; mais longe, sombra. */
  shallowBase: 12,
  /** Praia: luz até esta distância da água. */
  beachLight: 1,
  /** Espessura da costa (água encostada na terra pintada com o traço da costa). */
  coast: 2,
  /** Corte do posterizado: abaixo de −corte é sombra, acima de +corte é luz. */
  toneCut: 0.22,
  /** Peso do hillshade nos biomas de relevo (colina, montanha, neve) e nos demais. */
  reliefShade: 1.4,
  flatShade: 0.35,
  /** Peso das manchas (ruído de baixa frequência) nos biomas de relevo e nos demais. */
  reliefPatches: 0.5,
  flatPatches: 1.6,
  /** Frequência das manchas, em ciclos por largura do mapa. */
  patchFrequency: 14,
} as const

const RGB = BIOMES.map((b) => BIOME_TONES[b].map(hexToRgb))
const COAST = hexToRgb(COAST_STROKE.color)
const RIVER = hexToRgb(RIVER_STYLE.color)
const RIVER_OUTLINE = hexToRgb(RIVER_STYLE.outline)

const isWaterBiome = (b: number) => b === BIOME.deepOcean || b === BIOME.shallowWater || b === BIOME.lake
const isRelief = (b: number) => b === BIOME.hill || b === BIOME.rockyMountain || b === BIOME.snow

/**
 * RGBA do terreno, `width × height × 4` bytes. `patchSeed` sorteia as manchas de tom (use a seed do
 * mundo, para o mapa ter sempre as mesmas manchas).
 */
export function terrainPixels(field: CoreField, patchSeed = ''): Uint8ClampedArray<ArrayBuffer> {
  const { width: w, height: h, biome, shade } = field
  const n = w * h
  const cells = w / REF_SIZE
  const water = new Uint8Array(n)
  for (let i = 0; i < n; i++) water[i] = isWaterBiome(biome[i]) ? 1 : 0

  const toLand = chebyshevDistance(w, h, (i) => !water[i])
  const toWater = chebyshevDistance(w, h, (i) => water[i] === 1)
  const toShallow = chebyshevDistance(w, h, (i) => biome[i] !== BIOME.deepOcean)
  const patches = patchNoise(w, h, patchSeed)
  const s = TERRAIN_STYLE
  const coastCells = Math.max(1, Math.round(s.coast * cells))

  const tone = (i: number): Tone => {
    const b = biome[i]
    if (b === BIOME.deepOcean) {
      const d = toShallow[i] / cells
      return d <= s.deepLight ? 2 : d <= s.deepBase ? 1 : 0
    }
    if (b === BIOME.shallowWater || b === BIOME.lake) {
      const d = toLand[i] / cells
      return d <= s.shallowLight ? 2 : d <= s.shallowBase ? 1 : 0
    }
    if (b === BIOME.beach) return toWater[i] / cells <= s.beachLight ? 2 : 1
    const relief = isRelief(b)
    const t =
      (shade[i] / 127) * (relief ? s.reliefShade : s.flatShade) +
      (patches[i] - 0.5) * (relief ? s.reliefPatches : s.flatPatches)
    return t < -s.toneCut ? 0 : t > s.toneCut ? 2 : 1
  }

  const out = new Uint8ClampedArray(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const [r, g, b] = water[i] && toLand[i] <= coastCells ? COAST : RGB[biome[i]][tone(i)]
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  }
  paintRivers(out, field.rivers, w, h, water)
  return out
}

/**
 * Distância de Chebyshev (passos de 8 vizinhos) de cada célula até a mais próxima com `isSource`.
 * Sem nenhuma fonte, todas ficam em `Infinity`.
 */
export function chebyshevDistance(width: number, height: number, isSource: (i: number) => boolean): Float32Array {
  const n = width * height
  const dist = new Float32Array(n).fill(Infinity)
  const queue = new Int32Array(n)
  let head = 0
  let tail = 0
  for (let i = 0; i < n; i++) {
    if (isSource(i)) {
      dist[i] = 0
      queue[tail++] = i
    }
  }
  while (head < tail) {
    const i = queue[head++]
    const x = i % width
    const y = (i - x) / width
    const next = dist[i] + 1
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy
      if (ny < 0 || ny >= height) continue
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        if (nx < 0 || nx >= width) continue
        const j = ny * width + nx
        if (dist[j] !== Infinity) continue
        dist[j] = next
        queue[tail++] = j
      }
    }
  }
  return dist
}

/**
 * Pinta os rios por cima da terra: primeiro o contorno de todos, depois o miolo, para os afluentes
 * se juntarem sem contorno no encontro. Na água (mar e lago), o rio não é pintado: a foz se funde
 * com a água. A largura cresce da nascente até a foz.
 */
function paintRivers(out: Uint8ClampedArray, rivers: RiverPoint[][], w: number, h: number, water: Uint8Array) {
  const cells = w / REF_SIZE
  // 0 = nada, 1 = contorno, 2 = miolo.
  const mask = new Uint8Array(w * h)
  const minHalf = 0.5
  for (const pass of [1, 2] as const) {
    for (const river of rivers) {
      const last = river.length - 1
      for (let k = 0; k < last; k++) {
        const along = last > 0 ? k / last : 1
        const scale = RIVER_STYLE.sourceScale + (1 - RIVER_STYLE.sourceScale) * along
        const half = Math.max(minHalf, RIVER_STYLE.halfWidth * scale * cells)
        const radius = pass === 2 ? half : half + Math.max(minHalf, RIVER_STYLE.outlineWidth * cells)
        stampSegment(mask, w, h, river[k], river[k + 1], radius, pass)
      }
    }
  }
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || water[i]) continue
    const [r, g, b] = mask[i] === 2 ? RIVER : RIVER_OUTLINE
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
  }
}

/** Marca com `value` as células cujo centro fica a até `radius` (em células) do segmento a–b. */
function stampSegment(
  mask: Uint8Array,
  w: number,
  h: number,
  a: RiverPoint,
  b: RiverPoint,
  radius: number,
  value: 1 | 2,
) {
  // Em células, com o centro da célula x em x + 0,5.
  const ax = a.u * w
  const ay = a.v * h
  const bx = b.u * w
  const by = b.v * h
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - radius))
  const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + radius))
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - radius))
  const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + radius))
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const r2 = radius * radius
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax
      const py = y + 0.5 - ay
      const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0
      const ex = px - t * dx
      const ey = py - t * dy
      const i = y * w + x
      if (ex * ex + ey * ey <= r2 && mask[i] < value) mask[i] = value
    }
  }
}

/**
 * Manchas de tom: ruído de valor de baixa frequência (2 oitavas), de 0 a 1, amostrado em (u, v)
 * para a prévia e o mapa final terem as mesmas manchas. Só decide o tom; não é o núcleo.
 */
export function patchNoise(width: number, height: number, seed: string): Float32Array {
  const random = seededRandom(`${seed}#manchas`)
  const values = new Float32Array(256)
  const perm = new Uint8Array(512)
  for (let i = 0; i < 256; i++) {
    values[i] = random()
    perm[i] = i
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const t = perm[i]
    perm[i] = perm[j]
    perm[j] = t
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]
  const at = (x: number, y: number) => values[perm[perm[x & 255] + (y & 255)]]
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = x - xi
    const fy = y - yi
    const u = fx * fx * (3 - 2 * fx)
    const v = fy * fy * (3 - 2 * fy)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  const f = TERRAIN_STYLE.patchFrequency
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width
      out[y * width + x] = noise(u * f, v * f) * 0.7 + noise(u * f * 2.3 + 17.1, v * f * 2.3 + 5.3) * 0.3
    }
  }
  return out
}

/** Gerador pseudoaleatório a partir de um texto (FNV-1a + mulberry32). */
function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let s = h >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
