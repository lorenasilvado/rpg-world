import { createFbm3D, type FbmOptions } from '../noise/fbm'
import { createRandom } from '../rng/random'

/**
 * Clima em duas etapas, como a elevação: `sampleClimateNoise` amostra o ruído de umidade e o de
 * temperatura, que só dependem da seed; `composeTemperature` junta o ruído com a latitude, a
 * altitude e o slider Temperatura global.
 *
 * Todas as constantes deste arquivo fazem parte do gerador: mudar qualquer uma exige subir
 * `GENERATOR_VERSION` (`core/types.ts`) e atualizar os hashes de `golden.ts`.
 */

export type ClimateNoise = {
  size: number
  /** Umidade, em [0, 1]: só depende da seed. */
  moisture: Float32Array
  /** Variação local da temperatura, em [-1, 1]. */
  heat: Float32Array
}

/**
 * Sufixo da seed do clima. O clima tem um gerador próprio: assim ele não altera a ordem em que as
 * camadas da elevação consomem o `random` da seed.
 */
const CLIMATE_SEED_SUFFIX = '#clima'

const MOISTURE_FBM: FbmOptions = { octaves: 3, lacunarity: 2.1, gain: 0.5 }
const HEAT_FBM: FbmOptions = { octaves: 2, lacunarity: 2, gain: 0.5 }
/** Frequências, em ciclos por largura do mapa. */
const MOISTURE_FREQUENCY = 3.2
const HEAT_FREQUENCY = 2.2
/** Passo da grade em que o ruído do clima é amostrado, em células. */
const CLIMATE_STEP = 4
/** Plano do espaço do ruído usado pelo clima: longe do `z = 0` da elevação. */
const CLIMATE_Z = 17.3

/** Pesos da temperatura: latitude (1 no "equador", 0 nos polos), ruído local e altitude. */
const LATITUDE_WEIGHT = 0.6
const HEAT_NOISE_WEIGHT = 0.15
const LAPSE_RATE = 0.55
/** Base da temperatura e quanto o slider Temperatura global a desloca, de 0 a 100. */
const TEMPERATURE_BASE = 0.2
const GLOBAL_RANGE = 0.5

export function sampleClimateNoise(seed: string, size: number): ClimateNoise {
  const random = createRandom(seed + CLIMATE_SEED_SUFFIX)
  // A ordem de criação faz parte do gerador: as duas camadas consomem o mesmo `random`.
  const moistureNoise = createFbm3D(random, MOISTURE_FBM)
  const heatNoise = createFbm3D(random, HEAT_FBM)

  // O clima varia devagar: o ruído é amostrado nos cantos de uma grade de `CLIMATE_STEP` células
  // e interpolado (bilinear) no meio, com uma fração do custo de amostrar cada célula.
  const cells = Math.ceil(size / CLIMATE_STEP)
  const grid = cells + 1
  const moistureGrid = new Float32Array(grid * grid)
  const heatGrid = new Float32Array(grid * grid)
  for (let gy = 0; gy < grid; gy++) {
    const v = (gy * CLIMATE_STEP + 0.5) / size
    for (let gx = 0; gx < grid; gx++) {
      const u = (gx * CLIMATE_STEP + 0.5) / size
      const g = gy * grid + gx
      moistureGrid[g] = 0.5 + 0.5 * moistureNoise(u * MOISTURE_FREQUENCY, v * MOISTURE_FREQUENCY, CLIMATE_Z)
      heatGrid[g] = heatNoise(u * HEAT_FREQUENCY, v * HEAT_FREQUENCY, CLIMATE_Z)
    }
  }

  const n = size * size
  const moisture = new Float32Array(n)
  const heat = new Float32Array(n)
  for (let y = 0; y < size; y++) {
    const gy = Math.floor(y / CLIMATE_STEP)
    const fy = (y - gy * CLIMATE_STEP) / CLIMATE_STEP
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / CLIMATE_STEP)
      const fx = (x - gx * CLIMATE_STEP) / CLIMATE_STEP
      const g = gy * grid + gx
      const i = y * size + x
      moisture[i] = bilinear(moistureGrid, g, grid, fx, fy)
      heat[i] = bilinear(heatGrid, g, grid, fx, fy)
    }
  }
  return { size, moisture, heat }
}

/** Interpolação bilinear entre os cantos `g`, `g + 1`, `g + grid` e `g + grid + 1`. */
function bilinear(values: Float32Array, g: number, grid: number, fx: number, fy: number): number {
  const top = values[g] + (values[g + 1] - values[g]) * fx
  const bottom = values[g + grid] + (values[g + grid + 1] - values[g + grid]) * fx
  return top + (bottom - top) * fy
}

/**
 * Temperatura de cada célula, sem corte, em torno de [0, 1] com a Temperatura global em 50. Cai
 * com a distância do "equador" (a linha do meio do mapa) e com a altitude; o slider Temperatura
 * global soma o mesmo valor a todas as células. Não cortar evita empates no percentil da neve.
 */
export function composeTemperature(climate: ClimateNoise, elevation: Float32Array, temperature: number): Float32Array {
  const { size, heat } = climate
  const offset = TEMPERATURE_BASE + (temperature / 100 - 0.5) * GLOBAL_RANGE
  const result = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const latitude = 1 - Math.abs((y + 0.5) / size - 0.5) * 2
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      result[i] = offset + latitude * LATITUDE_WEIGHT + heat[i] * HEAT_NOISE_WEIGHT - elevation[i] * LAPSE_RATE
    }
  }
  return result
}
