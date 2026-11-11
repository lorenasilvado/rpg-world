import { BIOME, type CoreField, type WorldParams } from '../types'
import { composeTemperature, sampleClimateNoise } from './climate'
import { distanceToWater } from './coast'
import { BORDER_ELEVATION, composeElevation, sampleTerrainNoise } from './elevation'
import { DEFAULT_WORLD_PARAMS, validateWorldParams } from './params'
import { quantile, quantiles } from './quantile'
import { hillshade } from './shade'

/**
 * Gera o campo do mundo: elevação, clima, biomas e hillshade.
 *
 * Ordem de classificação fixa (`docs/specs/geracao-terreno.md`, Regras): água → praia → montanha
 * (rochosa ou nevada) → deserto ou floresta → campo. Cada etapa só olha as células que as
 * anteriores deixaram, então os sliders não brigam. Colina (campo alto) e campo gelado (campo
 * abaixo da geada, com o bioma neve) são variantes do campo: não são etapas à parte.
 *
 * As constantes de classificação deste arquivo também fazem parte do gerador: mudar qualquer uma
 * exige subir `GENERATOR_VERSION` e atualizar os hashes de `golden.ts`.
 */

/** Fração da água que é rasa. */
const SHALLOW_SHARE = 0.16
/** Fração da terra que é montanha, com o slider Montanhas em 100. */
const MOUNTAIN_SHARE = 0.4
/** Fração da terra que é colina, além das montanhas, e quanto ela cresce até Montanhas em 100. */
const HILL_SHARE_BASE = 0.04
const HILL_SHARE_RANGE = 0.12
/** Largura máxima da praia (Praias em 100), em frações da largura do mapa. */
const BEACH_MAX_WIDTH = 0.02
/**
 * Quanto a Temperatura global muda a neve: em 0, a neve é 1 + `SNOW_TEMPERATURE_SHIFT` vezes a
 * pedida no slider Neve; em 100, 1 - `SNOW_TEMPERATURE_SHIFT` vezes; em 50, exatamente a pedida.
 */
const SNOW_TEMPERATURE_SHIFT = 0.6
/** Peso do calor na aridez que escolhe os desertos (o resto é a secura). */
const DESERT_HEAT_WEIGHT = 0.35
/**
 * Temperatura abaixo da qual o campo fica gelado. É um limiar absoluto: é por ele que a Temperatura
 * global muda o mapa fora das montanhas (mais fria, mais campo gelado; mais quente, nenhum). Não
 * mexe em desertos e florestas, que vêm antes na ordem e mantêm o percentual pedido.
 */
const FROST_LEVEL = -0.1

export function generateField(
  seed: string,
  size = 256,
  params: WorldParams = DEFAULT_WORLD_PARAMS,
): CoreField {
  if (!Number.isInteger(size) || size < 2) throw new Error(`generateField: tamanho inválido (${size})`)
  validateWorldParams(params)
  const elevation = composeElevation(sampleTerrainNoise(seed, size), params)
  const climate = sampleClimateNoise(seed, size)
  const temperature = composeTemperature(climate, elevation, params.temperature)
  const { moisture } = climate
  const n = size * size

  // 1. Água, por quantil da elevação: os sliders pedem frações, não limiares absolutos.
  const { deepLevel, seaLevel, hillLevel, mountainLevel } = elevationLevels(elevation, params)

  const biome = new Uint8Array(n)
  const water = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const e = elevation[i]
    // Só a borda tem elevação igual a `BORDER_ELEVATION`: o interior começa em `MIN_INTERIOR`, acima
    // dela (ver `composeElevation`). Por isso a borda é sempre água, com qualquer Oceano.
    if (e === BORDER_ELEVATION || e < deepLevel) biome[i] = BIOME.deepOcean
    else if (e < seaLevel) biome[i] = BIOME.shallowWater
    else continue
    water[i] = 1
  }

  // 2. Praia: a terra a até `beachWidth` células da água, pela distância, não pela altura.
  const beachWidth = params.beach > 0 ? Math.max(1, (params.beach / 100) * BEACH_MAX_WIDTH * size) : 0
  const distance = distanceToWater(water, size)
  // 3. Montanha, por percentil da elevação. 4. Base de desertos e florestas: o que sobrou.
  const base: number[] = []
  const peaks: number[] = []
  for (let i = 0; i < n; i++) {
    if (water[i]) continue
    if (distance[i] <= beachWidth) biome[i] = BIOME.beach
    else if (elevation[i] >= mountainLevel) {
      biome[i] = BIOME.rockyMountain
      peaks.push(i)
    } else base.push(i)
  }

  // Neve: as montanhas mais frias, na proporção do slider Neve, deslocada pela Temperatura global.
  const snowShare = Math.min(
    1,
    (params.snow / 100) * (1 + (0.5 - params.temperature / 100) * 2 * SNOW_TEMPERATURE_SHIFT),
  )
  markColdest(peaks, temperature, snowShare, biome, BIOME.snow)

  // 4. Desertos (os mais áridos) e Florestas (os mais úmidos do que sobrou), sobre a base.
  const desertCount = Math.floor((params.desert / 100) * base.length)
  const forestCount = Math.min(base.length - desertCount, Math.floor((params.forest / 100) * base.length))
  const aridity = new Float32Array(base.length)
  for (let k = 0; k < base.length; k++) {
    const i = base[k]
    aridity[k] = (1 - moisture[i]) * (1 - DESERT_HEAT_WEIGHT) + temperature[i] * DESERT_HEAT_WEIGHT
  }
  const desertLevel = desertCount > 0 ? valueAtRank(aridity, base.length - desertCount) : Infinity
  const rest: number[] = []
  for (let k = 0; k < base.length; k++) {
    if (aridity[k] >= desertLevel) biome[base[k]] = BIOME.desert
    else rest.push(base[k])
  }
  const wetness = new Float32Array(rest.length)
  for (let k = 0; k < rest.length; k++) wetness[k] = moisture[rest[k]]
  const forestLevel = forestCount > 0 && rest.length > 0 ? valueAtRank(wetness, rest.length - forestCount) : Infinity

  // 5. Campo: o resto; o campo alto é colina, e o campo abaixo da geada fica gelado (neve).
  for (let k = 0; k < rest.length; k++) {
    const i = rest[k]
    if (wetness[k] >= forestLevel) biome[i] = BIOME.forest
    else if (temperature[i] < FROST_LEVEL) biome[i] = BIOME.snow
    else biome[i] = elevation[i] >= hillLevel ? BIOME.hill : BIOME.grassland
  }

  const shade = hillshade(elevation, water, size)
  return { width: size, height: size, elevation, moisture, temperature, biome, shade }
}

/** Limiares de elevação da classificação, por quantis da elevação. */
export type ElevationLevels = { deepLevel: number; seaLevel: number; hillLevel: number; mountainLevel: number }

/**
 * Limiares de elevação: abaixo de `deepLevel` é oceano profundo, abaixo de `seaLevel` é água rasa;
 * a partir de `mountainLevel`, a terra que não é praia é montanha, e o campo a partir de
 * `hillLevel` é colina.
 */
export function elevationLevels(
  elevation: Float32Array,
  params: Pick<WorldParams, 'ocean' | 'mountains'>,
): ElevationLevels {
  const ocean = params.ocean / 100
  const mountains = (params.mountains / 100) * MOUNTAIN_SHARE
  const hills = mountains + HILL_SHARE_BASE + (params.mountains / 100) * HILL_SHARE_RANGE
  const landSpan = 1 - ocean
  const [seaQuantile, deepLevel, hillLevel, mountainQuantile] = quantiles(elevation, [
    ocean,
    ocean * (1 - SHALLOW_SHARE),
    ocean + landSpan * (1 - hills),
    ocean + landSpan * (1 - mountains),
  ])
  // Em 100% (ou em 0% de montanha) o quantil cai na célula mais alta, que ficaria de fora do `e <`.
  return {
    deepLevel,
    seaLevel: ocean >= 1 ? Infinity : seaQuantile,
    hillLevel,
    mountainLevel: mountains > 0 ? mountainQuantile : Infinity,
  }
}

/** Marca com `cold` a fração `share` das `cells` com menor temperatura. */
function markColdest(cells: number[], temperature: Float32Array, share: number, biome: Uint8Array, cold: number): void {
  const count = Math.floor(share * cells.length)
  if (count <= 0) return
  const values = new Float32Array(cells.length)
  for (let k = 0; k < cells.length; k++) values[k] = temperature[cells[k]]
  const level = count >= cells.length ? Infinity : valueAtRank(values, count)
  for (let k = 0; k < cells.length; k++) if (values[k] < level) biome[cells[k]] = cold
}

/**
 * Valor na posição `rank` da ordem crescente de `values`: exatamente `rank` valores ficam abaixo
 * dele (sem empates). O `+ 0.5` protege o `floor(q * n)` do quantil contra o arredondamento.
 */
function valueAtRank(values: Float32Array, rank: number): number {
  return quantile(values, (rank + 0.5) / values.length)
}
