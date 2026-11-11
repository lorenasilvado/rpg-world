import type { CoreField, WorldParams } from '../types'
import { sampleClimateNoise, type ClimateNoise } from './climate'
import { composeElevation, sampleTerrainNoise, type TerrainNoise } from './elevation'
import { classifyField, validateFieldRequest } from './generateField'
import { traceHydrology, type Hydrology } from './rivers'

/**
 * Cache do ruído da seed, para o worker reclassificar sem recalcular (#45). Gera o mesmo campo que
 * `generateField` (mesmo hash), mas guarda as etapas que só dependem da seed e dos sliders de forma:
 *
 * - **Seed** (ou tamanho novo): refaz tudo: ruído, elevação, classificação e rios.
 * - **Tamanho do continente ou Rugosidade da costa:** reaproveita o ruído, refaz a elevação
 *   (`composeElevation`), o traçado dos rios e a classificação.
 * - **Os outros sete sliders:** reaproveitam o ruído, a elevação e os rios; refazem só a
 *   classificação (os rios só são cortados na costa nova).
 *
 * Guarda uma entrada por tamanho (a prévia 256² e o mapa 1024² se alternam durante o arrasto), só
 * da seed mais recente: trocar a seed esvazia o cache. Não usa relógio nem nada fora da seed.
 */

/** A primeira etapa que precisou ser refeita: `noise` refaz tudo, `classification` só o fim. */
export type RecomputedStage = 'noise' | 'elevation' | 'classification'

export type CachedField = { field: CoreField; recomputed: RecomputedStage }

type Shape = { continentSize: number; coastRoughness: number; elevation: Float32Array; hydrology: Hydrology }

type Entry = { terrain: TerrainNoise; climate: ClimateNoise; shape: Shape | null }

export type FieldCache = {
  /**
   * Gera o campo, reaproveitando o que o cache tem. O campo devolvido é do chamador: nenhum array
   * dele fica no cache, então ele pode ser transferido para outra thread.
   */
  generate(seed: string, size: number, params: Readonly<WorldParams>): CachedField
  /** Bytes guardados no cache (arrays tipados), para medir a memória do mundo. */
  bytes(): number
}

export function createFieldCache(): FieldCache {
  let cachedSeed: string | null = null
  const bySize = new Map<number, Entry>()

  return {
    generate(seed, size, params) {
      validateFieldRequest(size, params)
      if (seed !== cachedSeed) {
        bySize.clear()
        cachedSeed = seed
      }
      let recomputed: RecomputedStage = 'classification'
      let entry = bySize.get(size)
      if (!entry) {
        entry = { terrain: sampleTerrainNoise(seed, size), climate: sampleClimateNoise(seed, size), shape: null }
        bySize.set(size, entry)
        recomputed = 'noise'
      }
      const { continentSize, coastRoughness } = params
      let shape = entry.shape
      if (!shape || shape.continentSize !== continentSize || shape.coastRoughness !== coastRoughness) {
        // Solta a elevação antiga antes de criar a nova: as duas não ficam na memória juntas. Nada
        // mais pode apontar para a forma antiga, nem o `shape` local.
        entry.shape = null
        shape = null
        const elevation = composeElevation(entry.terrain, params)
        shape = { continentSize, coastRoughness, elevation, hydrology: traceHydrology(seed, elevation, size) }
        entry.shape = shape
        if (recomputed === 'classification') recomputed = 'elevation'
      }
      const field = classifyField(seed, size, params, {
        elevation: shape.elevation,
        climate: entry.climate,
        hydrology: shape.hydrology,
      })
      // A classificação devolve a elevação e a umidade do cache; o chamador recebe cópias.
      return {
        field: { ...field, elevation: field.elevation.slice(), moisture: field.moisture.slice() },
        recomputed,
      }
    },

    bytes() {
      let total = 0
      for (const { terrain, climate, shape } of bySize.values()) {
        const { broad, island, detail, ridged, radial, straits } = terrain
        for (const a of [broad, island, detail, ridged, radial, straits, climate.moisture, climate.heat]) {
          total += a.byteLength
        }
        if (shape) {
          total += shape.elevation.byteLength + shape.hydrology.lake.byteLength
          for (const t of shape.hydrology.traces) total += t.byteLength
        }
      }
      return total
    },
  }
}

/** Bytes dos arrays de um campo gerado (a parte do mundo que vai para a thread principal). */
export function fieldBytes(field: CoreField): number {
  const { elevation, moisture, temperature, biome, shade, decor } = field
  let total = 0
  for (const a of [elevation, moisture, temperature, biome, shade, decor.u, decor.v, decor.kind]) total += a.byteLength
  // Rios: cada ponto tem `u` e `v` em double.
  for (const river of field.rivers) total += river.length * 16
  return total
}
