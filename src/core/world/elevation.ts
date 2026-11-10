import { createFbm3D, type FbmOptions } from '../noise/fbm'
import { createRidged3D } from '../noise/ridged'
import { createRandom } from '../rng/random'
import type { WorldParams } from '../types'

/**
 * Elevação em duas etapas: `sampleTerrainNoise` amostra as camadas de ruído, que só dependem da
 * seed; `composeElevation` combina essas camadas com Tamanho do continente e Rugosidade da costa.
 * Os dois sliders só mudam os pesos da combinação, sem amostrar ruído de novo.
 */

export type TerrainNoise = {
  size: number
  /** Massas grandes de terra, em [-1, 1]: domina perto da pangeia. */
  broad: Float32Array
  /** Massas pequenas, em [-1, 1]: domina perto das ilhas. */
  island: Float32Array
  /** Detalhe fino, em [-1, 1], que recorta a costa. */
  detail: Float32Array
  /** Cordilheiras, em [0, 1]. */
  ridged: Float32Array
  /** Distância ao centro do mapa, perturbada para o continente não ser um círculo. */
  radial: Float32Array
  /** Linhas de estreitos, em [0, 1]: valem 1 no meio do estreito. */
  straits: Float32Array
}

/** Elevação das células da borda: fica abaixo de qualquer outra, que começa em `MIN_INTERIOR`. */
export const BORDER_ELEVATION = 0
const MIN_INTERIOR = 0.001
/**
 * Início da escala do terreno. O que as quedas perto da borda e o fundo dos estreitos empurram
 * para baixo do terreno fica em [`MIN_INTERIOR`, `TERRAIN_FLOOR`], para não comprimirem a altura da
 * terra.
 */
export const TERRAIN_FLOOR = 0.1

const TWO_OCTAVES: FbmOptions = { octaves: 2, lacunarity: 2.03, gain: 0.5 }
const ONE_OCTAVE: FbmOptions = { octaves: 1, lacunarity: 2, gain: 0.5 }

/** Frequências, em ciclos por largura do mapa. */
const WARP_FREQUENCY = 3
const BROAD_FREQUENCY = 2.4
const ISLAND_FREQUENCY = 5.5
const DETAIL_FREQUENCY = 16
const RIDGED_FREQUENCY = 4.5
const RADIAL_FREQUENCY = 2.6
const STRAIT_FREQUENCY = 3.4

/** Deslocamento máximo do domain warp, em frações do mapa. */
const WARP_AMPLITUDE = 0.05
/** Quanto a perturbação muda a distância ao centro. */
const RADIAL_NOISE = 0.6
/** Teto da máscara continental: o miolo do continente é um platô, sem pico no centro. */
const MASK_PLATEAU = 0.5
/** Altura somada no topo das cordilheiras. */
const RIDGE_HEIGHT = 0.42
/** Faixa da elevação em que as cordilheiras entram, para não criar terra no meio do mar. */
const RIDGE_START = 0.42
const RIDGE_SPAN = 0.16
/**
 * Distância circular ao centro (1 no meio de cada lado do mapa) a partir da qual o terreno afunda,
 * em ilhas e em pangeia. Ser circular evita que a terra acompanhe o retângulo do mapa quando há
 * pouco oceano; nas ilhas ela começa mais longe, para não juntar tudo numa massa só.
 */
const EDGE_START_ISLANDS = 1.04
const EDGE_START_PANGEA = 0.82
/** Parte da perturbação de `radial` que entra na queda: mais que isso leva a terra até a borda. */
const EDGE_NOISE_SHARE = 0.3
/**
 * Faixa estreita junto à moldura (0 no centro, 1 na moldura) que afunda o terreno, para a terra não
 * encostar nela. O início varia com o ruído, para a costa dali não sair reta.
 */
const FRAME_START = 0.93
const FRAME_START_MAX = 0.95
const FRAME_NOISE_SHARE = 0.08
const FRAME_DROP = 5
/** Largura e profundidade dos estreitos, que só existem do Continente 50 para baixo. */
const STRAIT_START = 0.66
const STRAIT_DEPTH = 0.95
/** Quanto as massas grandes abrem o estreito em baías ou o fecham, ao longo do caminho. */
const STRAIT_WIDTH_NOISE = 0.18
/** Quanto o detalhe fino recorta a costa do estreito. */
const STRAIT_EDGE_NOISE = 0.1
/**
 * Parte do afundamento dos estreitos que conta para o piso da escala: contar tudo achata o relevo, e
 * não contar nada joga a terra rasa perto dos estreitos na faixa comprimida.
 */
const STRAIT_FLOOR_SHARE = 0.5
/**
 * Quanto das quedas perto da borda conta para o piso da escala. Contar tudo achata o relevo; sem
 * contar nada, a terra perto da borda cai na faixa comprimida quando há pouco oceano.
 */
const DROP_FLOOR_CAP = 0.45
/** Peso da máscara continental em ilhas e quanto ele cresce até a pangeia. */
const MASK_WEIGHT_ISLANDS = 0.14
const MASK_WEIGHT_RANGE = 0.5
/** Peso do detalhe na costa lisa e quanto ele cresce até a costa recortada. */
const DETAIL_WEIGHT_SMOOTH = 0.015
const DETAIL_WEIGHT_RANGE = 0.13
/** Inclinação da queda circular em ilhas e quanto ela cresce até a pangeia. */
const EDGE_DROP_ISLANDS = 5
const EDGE_DROP_RANGE = 1.5

export function sampleTerrainNoise(seed: string, size: number): TerrainNoise {
  const random = createRandom(seed)
  // A ordem de criação faz parte do gerador: cada camada consome o mesmo `random`.
  const warpU = createFbm3D(random, ONE_OCTAVE)
  const warpV = createFbm3D(random, ONE_OCTAVE)
  const broadNoise = createFbm3D(random, TWO_OCTAVES)
  const islandNoise = createFbm3D(random, TWO_OCTAVES)
  const detailNoise = createFbm3D(random, TWO_OCTAVES)
  const ridgedNoise = createRidged3D(random, TWO_OCTAVES)
  const radialNoise = createFbm3D(random, ONE_OCTAVE)
  const straitNoise = createRidged3D(random, ONE_OCTAVE)

  const n = size * size
  const broad = new Float32Array(n)
  const island = new Float32Array(n)
  const detail = new Float32Array(n)
  const ridged = new Float32Array(n)
  const radial = new Float32Array(n)
  const straits = new Float32Array(n)

  // Amostragem no plano: (u, v) de 0 a 1 vira o ponto (u, v, 0) do espaço do ruído (RNF-9).
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const i = y * size + x
      const wu = u + WARP_AMPLITUDE * warpU(u * WARP_FREQUENCY, v * WARP_FREQUENCY, 0)
      const wv = v + WARP_AMPLITUDE * warpV(u * WARP_FREQUENCY, v * WARP_FREQUENCY, 0)
      broad[i] = broadNoise(wu * BROAD_FREQUENCY, wv * BROAD_FREQUENCY, 0)
      island[i] = islandNoise(wu * ISLAND_FREQUENCY, wv * ISLAND_FREQUENCY, 0)
      detail[i] = detailNoise(wu * DETAIL_FREQUENCY, wv * DETAIL_FREQUENCY, 0)
      ridged[i] = ridgedNoise(wu * RIDGED_FREQUENCY, wv * RIDGED_FREQUENCY, 0)
      straits[i] = straitNoise(wu * STRAIT_FREQUENCY, wv * STRAIT_FREQUENCY, 0)
      const dx = (u - 0.5) * 2
      const dy = (v - 0.5) * 2
      radial[i] =
        Math.sqrt(dx * dx * 0.85 + dy * dy * 1.15) +
        radialNoise(u * RADIAL_FREQUENCY, v * RADIAL_FREQUENCY, 0) * RADIAL_NOISE
    }
  }

  return { size, broad, island, detail, ridged, radial, straits }
}

/**
 * Elevação de 0 a 1. A borda do mapa fica em `BORDER_ELEVATION`; o interior é reescalado em dois
 * trechos contínuos e crescentes (ver `TERRAIN_FLOOR`), sem cortar valores: cortar criaria empates
 * que o quantil do oceano não consegue separar.
 */
export function composeElevation(
  noise: TerrainNoise,
  { continentSize, coastRoughness }: Pick<WorldParams, 'continentSize' | 'coastRoughness'>,
): Float32Array {
  const { size, broad, island, detail, ridged, radial, straits } = noise
  const continent = continentSize / 100
  const straitWeight = Math.max(0, 1 - continent * 2) * STRAIT_DEPTH
  const maskWeight = MASK_WEIGHT_ISLANDS + continent * MASK_WEIGHT_RANGE
  const detailWeight = DETAIL_WEIGHT_SMOOTH + (coastRoughness / 100) * DETAIL_WEIGHT_RANGE
  const edgeDrop = EDGE_DROP_ISLANDS + continent * EDGE_DROP_RANGE
  const edgeStart = EDGE_START_ISLANDS + (EDGE_START_PANGEA - EDGE_START_ISLANDS) * continent

  const elevation = new Float32Array(size * size)
  let min = Infinity
  let max = -Infinity
  let floor = Infinity
  for (let y = 1; y < size - 1; y++) {
    const dy = ((y + 0.5) / size - 0.5) * 2
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x
      const mass = island[i] + (broad[i] - island[i]) * continent
      const mask = Math.min(MASK_PLATEAU, 1 - radial[i])
      let e = (0.5 + 0.5 * mass) * (1 - maskWeight) + mask * maskWeight
      e += detail[i] * detailWeight
      const strait = straits[i] + broad[i] * STRAIT_WIDTH_NOISE + detail[i] * STRAIT_EDGE_NOISE
      const cut = strait > STRAIT_START ? ((strait - STRAIT_START) / (1 - STRAIT_START)) * straitWeight : 0
      e -= cut
      const inland = Math.min(1, Math.max(0, (e - RIDGE_START) / RIDGE_SPAN))
      e += ridged[i] * ridged[i] * RIDGE_HEIGHT * inland
      const terrain = e + cut * (1 - STRAIT_FLOOR_SHARE)
      const dx = ((x + 0.5) / size - 0.5) * 2
      const distance = Math.sqrt(dx * dx + dy * dy)
      const reach = distance + (radial[i] - distance) * EDGE_NOISE_SHARE
      let drop = reach > edgeStart ? (reach - edgeStart) * edgeDrop : 0
      const frame = Math.max(Math.abs(dx), Math.abs(dy))
      const frameStart = Math.min(FRAME_START_MAX, FRAME_START + (radial[i] - distance) * FRAME_NOISE_SHARE)
      if (frame > frameStart) drop += ((frame - frameStart) / (1 - frameStart)) * FRAME_DROP
      e -= drop
      const lowest = terrain - Math.min(drop, DROP_FLOOR_CAP)
      if (lowest < floor) floor = lowest
      elevation[i] = e
      if (e < min) min = e
      if (e > max) max = e
    }
  }

  if (floor === Infinity) floor = max
  const upper = max > floor ? (1 - TERRAIN_FLOOR) / (max - floor) : 0
  const lower = floor > min ? (TERRAIN_FLOOR - MIN_INTERIOR) / (floor - min) : 0
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x
      const e = elevation[i]
      // `min(1, …)`: o valor guardado em Float32 pode arredondar acima do `max` medido em double.
      elevation[i] = e >= floor ? Math.min(1, TERRAIN_FLOOR + (e - floor) * upper) : MIN_INTERIOR + (e - min) * lower
    }
  }
  return elevation
}
