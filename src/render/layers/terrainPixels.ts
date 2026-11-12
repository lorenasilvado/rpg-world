import { BIOME, type CoreField, type RiverPoint } from '../../core/types'
import { distanceToWater } from '../../core/world/coast'
import { BIOMES, BIOME_TONES, COAST_STROKE, RIVER_STYLE, hexToRgb, type Tone } from '../style/palette'

/**
 * Converte o campo gerado na textura RGBA do terreno (uma célula = um pixel), no estilo do mockup
 * aprovado (#7): 3 tons chapados por bioma (paleta posterizada), o hillshade do núcleo nas
 * encostas, o anel de água rasa clareando perto da terra, o contorno da costa e os rios (a partir do
 * pé da montanha, com a foz alargando e passando para a cor da água).
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
  /**
   * Água rasa e lago: luz até esta distância do traço da costa (medida a partir de onde ele
   * termina, para a faixa clara não ficar escondida debaixo dele); depois, base.
   */
  shallowLight: 6,
  /** Água rasa e lago: base até esta distância do traço da costa; mais longe, sombra. */
  shallowBase: 16,
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

/** Folga para a vizinha diagonal (4/3 na distância chanfrada 3-4, guardada em Float32). */
const DIAGONAL_SLACK = 0.34

const RGB = BIOMES.map((b) => BIOME_TONES[b].map(hexToRgb))
const COAST = hexToRgb(COAST_STROKE.color)
const RIVER = hexToRgb(RIVER_STYLE.color)

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

  // Distância chanfrada 3-4 do núcleo (a diagonal vale 4/3): as faixas da água acompanham a costa,
  // sem os degraus retangulares de uma distância de 8 vizinhos com passo 1.
  const land = new Uint8Array(n)
  const notDeep = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    land[i] = water[i] ? 0 : 1
    notDeep[i] = biome[i] === BIOME.deepOcean ? 0 : 1
  }
  const toLand = distanceToWater(land, w)
  const toWater = distanceToWater(water, w)
  const toShallow = distanceToWater(notDeep, w)
  const patches = patchNoise(w, h, patchSeed)
  const s = TERRAIN_STYLE
  const coastCells = Math.max(1, Math.round(s.coast * cells))
  // Na distância chanfrada, a vizinha só na diagonal fica a 4/3: a folga a inclui nos limiares de
  // 1 célula (a costa da prévia e a luz da praia), para o traço e a luz não falharem nas diagonais.
  const coastLimit = coastCells + DIAGONAL_SLACK
  const beachLimit = Math.max(1, s.beachLight * cells) + DIAGONAL_SLACK

  const tone = (i: number): Tone => {
    const b = biome[i]
    if (b === BIOME.deepOcean) {
      const d = toShallow[i] / cells
      return d <= s.deepLight ? 2 : d <= s.deepBase ? 1 : 0
    }
    if (b === BIOME.shallowWater || b === BIOME.lake) {
      const d = (toLand[i] - coastCells) / cells
      return d <= s.shallowLight ? 2 : d <= s.shallowBase ? 1 : 0
    }
    if (b === BIOME.beach) return toWater[i] <= beachLimit ? 2 : 1
    const relief = isRelief(b)
    const t =
      (shade[i] / 127) * (relief ? s.reliefShade : s.flatShade) +
      (patches[i] - 0.5) * (relief ? s.reliefPatches : s.flatPatches)
    return t < -s.toneCut ? 0 : t > s.toneCut ? 2 : 1
  }

  const out = new Uint8ClampedArray(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const [r, g, b] = water[i] && toLand[i] <= coastLimit ? COAST : RGB[biome[i]][tone(i)]
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  }
  const isCoast = (i: number) => toLand[i] <= coastLimit
  // A cor da água em que o rio entra é a mais comum da água visível em volta da foz (já depois do
  // traço da costa), num raio do tamanho da boca: a célula onde o rio termina fica debaixo do traço,
  // e o tom dela, ou o de uma faixa fina de água rasa logo depois, pode não ser o que aparece em
  // volta (oceano profundo encostado na costa).
  const reach = coastCells + Math.ceil(RIVER_STYLE.halfWidth * RIVER_STYLE.mouthFlare * cells) + 1
  const visibleWater = (end: number): readonly [number, number, number] => {
    const ex = end % w
    const ey = (end - ex) / w
    const count = new Map<number, number>()
    let best = -1
    let bestCount = 0
    for (let y = Math.max(0, ey - reach); y <= Math.min(h - 1, ey + reach); y++) {
      for (let x = Math.max(0, ex - reach); x <= Math.min(w - 1, ex + reach); x++) {
        const i = y * w + x
        if (!water[i] || isCoast(i) || (x - ex) ** 2 + (y - ey) ** 2 > reach * reach) continue
        const color = (out[i * 4] << 16) | (out[i * 4 + 1] << 8) | out[i * 4 + 2]
        const c = (count.get(color) ?? 0) + 1
        count.set(color, c)
        if (c > bestCount) {
          bestCount = c
          best = color
        }
      }
    }
    if (best < 0) return RGB[biome[end]][tone(end)]
    return [(best >> 16) & 255, (best >> 8) & 255, best & 255]
  }
  paintRivers(out, field.rivers, w, h, biome, water, isCoast, visibleWater)
  return out
}

/** Montanha rochosa e neve: o rio não é desenhado sobre elas (ele aparece a partir do pé da montanha). */
const isPeak = (b: number) => b === BIOME.rockyMountain || b === BIOME.snow

const smoothstep = (x: number) => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

/**
 * Pinta os rios, sem contorno, sobre a terra e sobre o traço da costa. O rio aparece a partir do
 * pé da montanha: nada é pintado sobre montanha rochosa ou neve, e ele afina a partir do primeiro
 * ponto fora delas. Na foz (o rio que termina no mar ou num lago), ele alarga aos poucos e a cor
 * passa suavemente para a da água visível em que entra (`waterColor`), abrindo o traço da costa, sem
 * degrau nem linha. O afluente, que termina em outro rio, não tem foz. No resto da água, nada é
 * pintado.
 */
function paintRivers(
  out: Uint8ClampedArray,
  rivers: RiverPoint[][],
  w: number,
  h: number,
  biome: Uint8Array,
  water: Uint8Array,
  isCoast: (i: number) => boolean,
  waterColor: (i: number) => readonly [number, number, number],
) {
  const cells = w / REF_SIZE
  const S = RIVER_STYLE
  const minHalf = 0.5
  const mouthLength = Math.max(1, S.mouthLength * cells)
  // Por pixel: quanto da cor da água entra (−1 = sem rio), de qual rio é a água e a distância ao
  // eixo do trecho que o pintou (vale o mais próximo, para a mistura não escorrer rio acima pelas
  // pontas arredondadas dos trechos vizinhos).
  const blend = new Float32Array(w * h).fill(-1)
  const axis = new Float32Array(w * h).fill(Infinity)
  const owner = new Int32Array(w * h)
  const targets: (readonly [number, number, number])[] = []
  const cellOf = (p: RiverPoint) =>
    Math.min(h - 1, Math.floor(p.v * h)) * w + Math.min(w - 1, Math.floor(p.u * w))

  for (const river of rivers) {
    const last = river.length - 1
    if (last < 1) continue
    const idx = river.map(cellOf)
    const k0 = idx.findIndex((i) => !isPeak(biome[i]))
    // Sem nenhum trecho fora da montanha (ou só a célula da água), o rio não aparece.
    if (k0 < 0 || (k0 === last && water[idx[last]])) continue
    const first = Math.max(0, k0 - 1)
    const mouth = water[idx[last]] === 1
    const id = targets.length
    targets.push(mouth ? waterColor(idx[last]) : RIVER)
    // Comprimento ao longo do rio até a foz, em células deste mapa.
    const toMouth = new Float64Array(river.length)
    for (let k = last - 1; k >= 0; k--) {
      const du = (river[k + 1].u - river[k].u) * w
      const dv = (river[k + 1].v - river[k].v) * h
      toMouth[k] = toMouth[k + 1] + Math.hypot(du, dv)
    }
    const span = last - first
    const shape = (k: number, t: number) => {
      const along = (k + t - first) / span
      const m = toMouth[k] + (toMouth[k + 1] - toMouth[k]) * t
      const near = mouth ? smoothstep(1 - m / mouthLength) : 0
      const scale = S.sourceScale + (1 - S.sourceScale) * along
      const half = Math.max(minHalf, S.halfWidth * scale * cells * (1 + (S.mouthFlare - 1) * near))
      return { half, near }
    }
    const maxHalf = Math.max(minHalf, S.halfWidth * cells * (mouth ? S.mouthFlare : 1))
    for (let k = first; k < last; k++) {
      stampSegment(w, h, river[k], river[k + 1], maxHalf, (i, t, d2) => {
        const { half, near } = shape(k, t)
        if (d2 > half * half || d2 >= axis[i]) return
        axis[i] = d2
        blend[i] = near
        owner[i] = id
      })
    }
  }
  for (let i = 0; i < blend.length; i++) {
    const b = blend[i]
    if (b < 0 || isPeak(biome[i]) || (water[i] && !isCoast(i))) continue
    const target = targets[owner[i]]
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(RIVER[c] + (target[c] - RIVER[c]) * b)
  }
}

/**
 * Chama `visit(i, t, d2)` para cada célula cujo centro fica a até `maxRadius` (em células) do
 * segmento a–b, com `t` (0 a 1) a posição da projeção no segmento e `d2` a distância ao quadrado.
 */
function stampSegment(
  w: number,
  h: number,
  a: RiverPoint,
  b: RiverPoint,
  maxRadius: number,
  visit: (i: number, t: number, d2: number) => void,
) {
  // Em células, com o centro da célula x em x + 0,5.
  const ax = a.u * w
  const ay = a.v * h
  const bx = b.u * w
  const by = b.v * h
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - maxRadius))
  const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + maxRadius))
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - maxRadius))
  const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + maxRadius))
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const r2 = maxRadius * maxRadius
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax
      const py = y + 0.5 - ay
      const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0
      const ex = px - t * dx
      const ey = py - t * dy
      const d2 = ex * ex + ey * ey
      if (d2 <= r2) visit(y * w + x, t, d2)
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
