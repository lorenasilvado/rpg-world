import { BIOME_ID, type Tone } from '../render/style/palette'

/**
 * Terreno de exemplo do spike visual (#7): geração simples, só para o mockup.
 * Não é o núcleo de produção (o M1 reescreve): ruído de valor com fBm, máscara de ilha e
 * classificação por quantis, nos parâmetros padrão do design system.
 */

export type MockTerrain = {
  width: number
  height: number
  /** Bioma de cada célula (índice de `BIOMES`). */
  biome: Uint8Array
  /** Tom de cada célula: 0 = sombra, 1 = base, 2 = luz. */
  tone: Uint8Array
  /** 1 = terra (inclui praia), 0 = água. */
  land: Uint8Array
}

export type MockParams = {
  /** Fração das células que é água. */
  ocean: number
  /** Fração da terra firme (sem montanhas) que vira deserto. */
  desert: number
  /** Fração da terra firme (sem montanhas) que vira floresta. */
  forest: number
  /** Fração da terra firme que vira montanha (rocha + neve). */
  mountains: number
  /** Fração das montanhas que tem neve. */
  snow: number
  /** Largura do anel de água rasa, em células. */
  shallowWidth: number
  /** Largura da praia, em células. */
  beachWidth: number
}

export const DEFAULT_MOCK_PARAMS: MockParams = {
  ocean: 0.45,
  desert: 0.15,
  forest: 0.35,
  mountains: 0.14,
  snow: 0.3,
  shallowWidth: 5,
  beachWidth: 3,
}

/** Gerador pseudoaleatório determinístico a partir de um texto (hash FNV-1a + mulberry32). */
export function seededRandom(seed: string): () => number {
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

/** Ruído de valor 2D numa grade de inteiros, interpolado com smoothstep. */
function valueNoise(rand: () => number) {
  const SIZE = 256
  const perm = new Uint8Array(SIZE * 2)
  const values = new Float32Array(SIZE)
  const order = Array.from({ length: SIZE }, (_, i) => i)
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (let i = 0; i < SIZE * 2; i++) perm[i] = order[i & (SIZE - 1)]
  for (let i = 0; i < SIZE; i++) values[i] = rand()
  const at = (x: number, y: number) => values[perm[(perm[x & 255] + y) & 511]]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = smooth(x - x0)
    const fy = smooth(y - y0)
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
    return a + (b - a) * fy
  }
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * freq, y * freq) * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/** Valor do percentil `q` (0..1) de `values` filtrado por `mask`. */
export function quantile(values: Float32Array, q: number, mask?: (i: number) => boolean): number {
  const picked: number[] = []
  for (let i = 0; i < values.length; i++) if (!mask || mask(i)) picked.push(values[i])
  if (picked.length === 0) return Infinity
  picked.sort((a, b) => a - b)
  const k = Math.min(picked.length - 1, Math.max(0, Math.floor(q * picked.length)))
  return picked[k]
}

/** Distância (em passos de 8 vizinhos) de cada célula até a célula mais próxima com `isSource`. */
function distanceTo(width: number, height: number, isSource: (i: number) => boolean): Int32Array {
  const dist = new Int32Array(width * height).fill(-1)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  for (let i = 0; i < dist.length; i++) {
    if (isSource(i)) {
      dist[i] = 0
      queue[tail++] = i
    }
  }
  while (head < tail) {
    const i = queue[head++]
    const x = i % width
    const y = (i - x) / width
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const j = ny * width + nx
        if (dist[j] !== -1) continue
        dist[j] = dist[i] + 1
        queue[tail++] = j
      }
    }
  }
  return dist
}

export function generateMockTerrain(
  seed: string,
  width: number,
  height: number,
  params: MockParams = DEFAULT_MOCK_PARAMS,
): MockTerrain {
  const rand = seededRandom(seed)
  const elevNoise = valueNoise(rand)
  const warpNoise = valueNoise(rand)
  const moistNoise = valueNoise(rand)
  const toneNoise = valueNoise(rand)
  const ridgeNoise = valueNoise(rand)
  const n = width * height
  const elevation = new Float32Array(n)
  const moisture = new Float32Array(n)
  const patches = new Float32Array(n)
  /** Elevação com ruído fino, só para escolher onde há neve: quebra a neve em manchas nos picos. */
  const snowScore = new Float32Array(n)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width
      const v = y / height
      const wx = u * 6 + (fbm(warpNoise, u * 3, v * 3, 3) - 0.5) * 1.6
      const wy = v * 6 + (fbm(warpNoise, u * 3 + 7.3, v * 3 + 2.1, 3) - 0.5) * 1.6
      // Máscara de ilha: 1 no centro, cai até as bordas (elipse no formato do mapa).
      const dx = (u - 0.5) * 2
      const dy = (v - 0.5) * 2
      const r = Math.sqrt(dx * dx + dy * dy)
      const mask = 1 - Math.min(1, r * r)
      const i = y * width + x
      // Cordilheiras por ridged noise: cristas finas, mais altas no interior da ilha.
      const ridge = 1 - Math.abs(2 * fbm(ridgeNoise, u * 5 + 3.1, v * 5 + 8.4, 4) - 1)
      elevation[i] = fbm(elevNoise, wx, wy, 5) * 0.55 + mask * 0.75 + ridge * ridge * ridge * mask * 0.45
      moisture[i] = fbm(moistNoise, u * 4 + 11.7, v * 4 + 3.9, 4)
      patches[i] = fbm(toneNoise, u * 14, v * 14, 3)
      snowScore[i] = elevation[i] + (fbm(toneNoise, u * 40 + 5.5, v * 40 + 1.7, 2) - 0.5) * 0.4
    }
  }

  const sea = quantile(elevation, params.ocean)
  const land = new Uint8Array(n)
  for (let i = 0; i < n; i++) land[i] = elevation[i] > sea ? 1 : 0

  const toLand = distanceTo(width, height, (i) => land[i] === 1)
  const toWater = distanceTo(width, height, (i) => land[i] === 0)

  const biome = new Uint8Array(n)
  const isInland = (i: number) => land[i] === 1 && toWater[i] > params.beachWidth
  const mountainLevel = quantile(elevation, 1 - params.mountains, isInland)
  const snowLevel = quantile(snowScore, 1 - params.snow, (i) => isInland(i) && elevation[i] >= mountainLevel)
  const hillLevel = quantile(elevation, 1 - params.mountains * 1.8, isInland)
  const isLowland = (i: number) => isInland(i) && elevation[i] < hillLevel
  const desertLevel = quantile(moisture, params.desert, isLowland)
  const forestLevel = quantile(moisture, 1 - params.forest, isLowland)

  for (let i = 0; i < n; i++) {
    if (land[i] === 0) biome[i] = toLand[i] <= params.shallowWidth ? BIOME_ID.shallowWater : BIOME_ID.deepOcean
    else if (!isInland(i)) biome[i] = BIOME_ID.beach
    else if (elevation[i] >= mountainLevel && snowScore[i] >= snowLevel) biome[i] = BIOME_ID.snow
    else if (elevation[i] >= mountainLevel) biome[i] = BIOME_ID.rockyMountain
    else if (elevation[i] >= hillLevel) biome[i] = BIOME_ID.hill
    else if (moisture[i] <= desertLevel) biome[i] = BIOME_ID.desert
    else if (moisture[i] >= forestLevel) biome[i] = BIOME_ID.forest
    else biome[i] = BIOME_ID.grassland
  }

  const tone = new Uint8Array(n)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      tone[i] = toneFor(biome[i], i, x, y)
    }
  }

  function toneFor(b: number, i: number, x: number, y: number): Tone {
    if (b === BIOME_ID.deepOcean) {
      const d = toLand[i] - params.shallowWidth
      return d <= 3 ? 2 : d <= 14 ? 1 : 0
    }
    if (b === BIOME_ID.shallowWater) return toLand[i] <= 1 ? 2 : toLand[i] <= 3 ? 1 : 0
    // Praia: luz junto da água, base no resto.
    if (b === BIOME_ID.beach) return toWater[i] <= 1 ? 2 : 1
    // Luz vinda do noroeste: hillshade posterizado, somado a manchas de baixa frequência.
    const x0 = Math.max(0, x - 1)
    const y0 = Math.max(0, y - 1)
    const x1 = Math.min(width - 1, x + 1)
    const y1 = Math.min(height - 1, y + 1)
    const slope = elevation[y0 * width + x0] - elevation[y1 * width + x1]
    const relief = b === BIOME_ID.rockyMountain || b === BIOME_ID.snow || b === BIOME_ID.hill ? 60 : 12
    const t = slope * relief + (patches[i] - 0.5) * 1.6
    return t < -0.22 ? 0 : t > 0.22 ? 2 : 1
  }

  return { width, height, biome, tone, land }
}
