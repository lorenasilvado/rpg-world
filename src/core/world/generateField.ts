import { MAX_DECOR, placeDecor } from '../decor/decor'
import { BIOME, type CoreField, type RiverPoint, type WorldParams } from '../types'
import { composeTemperature, sampleClimateNoise, type ClimateNoise } from './climate'
import { distanceToWater } from './coast'
import { BORDER_ELEVATION, composeElevation, sampleTerrainNoise } from './elevation'
import { placeOases } from './oasis'
import { DEFAULT_WORLD_PARAMS, validateWorldParams } from './params'
import { quantile, quantiles } from './quantile'
import { cutRivers, minLakeCells, traceHydrology, visibleLakes, type Hydrology } from './rivers'
import { hillshade } from './shade'
import { seaWater } from './water'

/**
 * Gera o campo do mundo: elevação, clima, biomas, hillshade, rios e lagos e a decoração.
 *
 * Ordem de classificação fixa (`docs/specs/geracao-terreno.md`, Regras): água → lago → praia → montanha
 * (rochosa ou nevada) → deserto ou floresta → campo → oásis. Cada etapa só olha as células que as
 * anteriores deixaram, então os sliders não brigam. Colina (campo alto) e campo gelado (campo
 * abaixo da geada, bioma `frozenField`) são variantes do campo: não são etapas à parte. A neve de
 * montanha (`snow`) e o campo gelado são biomas distintos (ADR 0007).
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
/**
 * Até onde o deserto recua dos rios e dos lagos, em frações da largura do mapa (pelo menos as
 * vizinhas, também na diagonal): a terra a essa distância ou menos de um rio ou de um lago nunca é
 * deserto (ADR 0009).
 */
export const DESERT_WATER_MARGIN = 0.006
/** Distância até o lago (chanfrada) das células que encostam nele, retas ou na diagonal. */
const LAKE_SHORE = 1.5

export function generateField(
  seed: string,
  size = 256,
  params: WorldParams = DEFAULT_WORLD_PARAMS,
): CoreField {
  validateFieldRequest(size, params)
  const elevation = composeElevation(sampleTerrainNoise(seed, size), params)
  // Rios e lagos só dependem da seed e da elevação: os sliders de limiar não mudam o traçado.
  const hydrology = traceHydrology(seed, elevation, size)
  return classifyField(seed, size, params, { elevation, climate: sampleClimateNoise(seed, size), hydrology })
}

/** Confere o tamanho e os parâmetros de um pedido de campo. */
export function validateFieldRequest(size: number, params: Readonly<WorldParams>): void {
  if (!Number.isInteger(size) || size < 2) throw new Error(`generateField: tamanho inválido (${size})`)
  validateWorldParams(params)
}

/**
 * O que a classificação recebe pronto: a elevação (seed + Continente e Costa), o ruído do clima
 * (só a seed) e o traçado dos rios e lagos (seed + elevação). É o que o cache do worker guarda
 * (`fieldCache.ts`). Nenhum deles é alterado pela classificação.
 */
export type ShapedTerrain = { elevation: Float32Array; climate: ClimateNoise; hydrology: Hydrology }

/**
 * Classifica o terreno com os sete sliders de limiar: clima, biomas, praias, hillshade, o corte
 * dos rios na costa e a decoração. O campo devolvido usa a `elevation` e a umidade de `terrain`
 * sem copiar.
 */
export function classifyField(
  seed: string,
  size: number,
  params: Readonly<WorldParams>,
  { elevation, climate, hydrology }: ShapedTerrain,
): CoreField {
  const temperature = composeTemperature(climate, elevation, params.temperature)
  const { moisture } = climate
  const n = size * size

  // 1. Água, por quantil da elevação: os sliders pedem frações, não limiares absolutos. Só a água
  // ligada à borda é oceano, e é ela que fica no alvo (ADR 0009).
  const { deepLevel, hillLevel, mountainLevel } = elevationLevels(elevation, params)
  const sea = seaWater(elevation, hydrology.depressions, params.ocean / 100)
  const water = sea.ocean

  const biome = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (!water[i]) continue
    // Só a borda tem elevação igual a `BORDER_ELEVATION`: o interior começa em `MIN_INTERIOR`, acima
    // dela (ver `composeElevation`). Por isso a borda é sempre água, com qualquer Oceano.
    const e = elevation[i]
    biome[i] = e === BORDER_ELEVATION || e < deepLevel ? BIOME.deepOcean : BIOME.shallowWater
  }
  // Lago: a água interior e o lago dos rios fora do oceano. O resto pequeno de um lago dos rios
  // cortado pelo mar volta a ser terra, e a água interior menor que o lago mínimo também.
  const lakes = visibleLakes(hydrology.lake, water, size)
  const minLake = minLakeCells(size)
  for (const cells of components(sea.inland, size)) {
    if (cells.length < minLake) continue
    for (const c of cells) lakes[c] = 1
  }
  for (let i = 0; i < n; i++) if (lakes[i]) biome[i] = BIOME.lake
  // Os rios são cortados na costa atual. O deserto recua deles e dos lagos (passo 4).
  const rivers = cutRivers(hydrology, water, lakes, elevation, size)

  // 2. Praia: a terra a até `beachWidth` células do oceano, pela distância, não pela altura, mais
  // perto do oceano que de um lago e sem encostar num lago (nem na diagonal, a 4/3 de distância):
  // margem de lago nunca é praia.
  const beachWidth = params.beach > 0 ? Math.max(1, (params.beach / 100) * BEACH_MAX_WIDTH * size) : 0
  const distance = distanceToWater(water, size)
  const lakeDistance = distanceToWater(lakes, size)
  // 3. Montanha, por percentil da elevação. 4. Base de desertos e florestas: o que sobrou.
  const base: number[] = []
  const peaks: number[] = []
  for (let i = 0; i < n; i++) {
    if (water[i] || lakes[i]) continue
    if (distance[i] <= beachWidth && distance[i] < lakeDistance[i] && lakeDistance[i] > LAKE_SHORE) biome[i] = BIOME.beach
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

  // 4. Desertos (os mais áridos) e Florestas (os mais úmidos do que sobrou), sobre a base. O
  // deserto recua dos rios e dos lagos: a terra junto deles nunca é deserto e fica para a floresta
  // ou o campo, e o deserto pedido sai do resto da base.
  const desertCount = Math.floor((params.desert / 100) * base.length)
  const forestCount = Math.min(base.length - desertCount, Math.floor((params.forest / 100) * base.length))
  const freshDistance = distanceToWater(freshWater(lakes, rivers, size), size)
  const desertMargin = Math.max(LAKE_SHORE, DESERT_WATER_MARGIN * size)
  const dry: number[] = []
  for (const i of base) if (freshDistance[i] > desertMargin) dry.push(i)
  const aridity = new Float32Array(dry.length)
  for (let k = 0; k < dry.length; k++) {
    const i = dry[k]
    aridity[k] = (1 - moisture[i]) * (1 - DESERT_HEAT_WEIGHT) + temperature[i] * DESERT_HEAT_WEIGHT
  }
  const desertLevel =
    desertCount <= 0 ? Infinity : desertCount >= dry.length ? -Infinity : valueAtRank(aridity, dry.length - desertCount)
  for (let k = 0; k < dry.length; k++) if (aridity[k] >= desertLevel) biome[dry[k]] = BIOME.desert
  const rest: number[] = []
  for (const i of base) if (biome[i] !== BIOME.desert) rest.push(i)
  const wetness = new Float32Array(rest.length)
  for (let k = 0; k < rest.length; k++) wetness[k] = moisture[rest[k]]
  const forestLevel = forestCount > 0 && rest.length > 0 ? valueAtRank(wetness, rest.length - forestCount) : Infinity

  // 5. Campo: o resto; o campo alto é colina, e o campo abaixo da geada fica gelado.
  for (let k = 0; k < rest.length; k++) {
    const i = rest[k]
    if (wetness[k] >= forestLevel) biome[i] = BIOME.forest
    else if (temperature[i] < FROST_LEVEL) biome[i] = BIOME.frozenField
    else biome[i] = elevation[i] >= hillLevel ? BIOME.hill : BIOME.grassland
  }

  // 6. Oásis: a única água dentro do deserto, com o anel de vegetação.
  const oases = placeOases(seed, biome, size)

  // Lago é água: plano, sem sombra.
  const flat = new Uint8Array(n)
  for (let i = 0; i < n; i++) flat[i] = water[i] || biome[i] === BIOME.lake ? 1 : 0
  const shade = hillshade(elevation, flat, size)
  // Decoração: os ícones por bioma, sobre a classificação final, e as palmeiras dos oásis.
  const decor = placeDecor(seed, biome, size, MAX_DECOR, oases)
  return {
    width: size,
    height: size,
    elevation,
    moisture,
    temperature,
    biome,
    shade,
    rivers,
    oases: oases.map(({ u, v }) => ({ u, v })),
    decor,
  }
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

/** Água doce: os lagos e as células por onde passam os rios. */
function freshWater(lakes: Uint8Array, rivers: RiverPoint[][], size: number): Uint8Array {
  const fresh = lakes.slice()
  for (const river of rivers) {
    for (const p of river) fresh[Math.min(size - 1, Math.floor(p.v * size)) * size + Math.min(size - 1, Math.floor(p.u * size))] = 1
  }
  return fresh
}

/** Grupos de células ligadas (vizinhança de 8) da máscara `mask`, na ordem do primeiro índice. */
function components(mask: Uint8Array, size: number): number[][] {
  const seen = new Uint8Array(mask.length)
  const groups: number[][] = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    seen[start] = 1
    const cells = [start]
    for (let head = 0; head < cells.length; head++) {
      const x = cells[head] % size
      const y = Math.floor(cells[head] / size)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
          const j = ny * size + nx
          if (!mask[j] || seen[j]) continue
          seen[j] = 1
          cells.push(j)
        }
      }
    }
    groups.push(cells)
  }
  return groups
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
