import { transfer } from 'comlink'
import {
  createFieldCache,
  DEFAULT_WORLD_PARAMS,
  fieldBytes,
  generateField,
  type CoreField,
  type Decor,
  type RecomputedStage,
  type WorldParams,
} from '../core'
import { terrainPixels } from '../render/layers/terrainPixels'

/**
 * API que o worker de geração expõe pelo Comlink (`generator.worker.ts`). Fica num módulo à parte
 * para o Vitest testá-la sem worker. O relógio (`performance`) é usado só aqui, para medir: o
 * núcleo (`src/core`) continua dependendo só da seed.
 *
 * O worker guarda o ruído da seed (`createFieldCache`): mudar um slider de limiar só reclassifica,
 * e Continente ou Costa refazem a elevação e os rios sem amostrar ruído de novo.
 *
 * O RGBA da textura do terreno (`terrainPixels`, só núcleo e paleta, sem Pixi) também é montado
 * aqui (#90): no mapa 1024² ele leva da ordem de 200 ms, e na thread principal travaria a UI.
 */
export type GenerateRequest = { seed: string; size: number; params?: WorldParams }

export type GenerateResult = {
  seed: string
  size: number
  params: WorldParams
  field: CoreField
  /** RGBA da textura do terreno (`terrainPixels` com a seed nas manchas), `size × size × 4` bytes. */
  terrainRgba: Uint8ClampedArray<ArrayBuffer>
  /** Tempo da geração dentro do worker, em ms (sem a textura e sem a ida e a volta das mensagens). */
  workerMs: number
  /** Tempo de `terrainPixels` dentro do worker, em ms. */
  terrainMs: number
  /** A primeira etapa refeita: `noise` (sem cache), `elevation` ou só `classification`. */
  recomputed: RecomputedStage
  /** Memória do mundo, em bytes: o cache do worker e os arrays entregues (o campo e o RGBA). */
  memory: { cacheBytes: number; fieldBytes: number }
}

/**
 * O terreno de um mapa exportado em PNG (#167): o RGBA (`terrainPixels`) e os ícones da decoração,
 * sem o resto do campo, que não serve à imagem e, em 4096², passaria de 200 MB.
 */
export type ExportTerrainResult = {
  size: number
  terrainRgba: Uint8ClampedArray<ArrayBuffer>
  decor: Decor
  /** Tempo da geração e do RGBA dentro do worker, em ms. */
  workerMs: number
  terrainMs: number
  /** Bytes do campo gerado e do RGBA (o campo é descartado no worker; só o RGBA e a decoração vêm). */
  fieldBytes: number
}

const cache = createFieldCache()

/** Buffers do último resultado enviado, para conferir que foram transferidos sem cópia. */
let lastBuffers: ArrayBuffer[] = []

export const generatorApi = {
  generate({ seed, size, params = DEFAULT_WORLD_PARAMS }: GenerateRequest): GenerateResult {
    const start = performance.now()
    const { field, recomputed } = cache.generate(seed, size, params)
    const workerMs = performance.now() - start
    const terrainStart = performance.now()
    const terrainRgba = terrainPixels(field, seed)
    const terrainMs = performance.now() - terrainStart
    const memory = { cacheBytes: cache.bytes(), fieldBytes: fieldBytes(field) + terrainRgba.byteLength }
    const { decor } = field
    lastBuffers = [
      field.elevation,
      field.moisture,
      field.temperature,
      field.biome,
      field.shade,
      decor.u,
      decor.v,
      decor.kind,
      terrainRgba,
    ].map((a) => a.buffer as ArrayBuffer)
    // Os arrays vão para a thread principal por transferência: o worker perde o acesso a eles
    // (o buffer fica com 0 bytes) e nada é copiado. O cache não divide arrays com o campo.
    return transfer(
      { seed, size, params: { ...params }, field, terrainRgba, workerMs, terrainMs, recomputed, memory },
      lastBuffers,
    )
  },

  /**
   * Gera o terreno do mapa exportado em `size`² (2048² ou 4096² no 2× e no 4×), sem passar pelo
   * cache: é um pedido só, e guardar o ruído de 4096² custaria mais de 600 MB no worker. Devolve
   * só o RGBA e a decoração, por transferência.
   */
  exportTerrain({ seed, size, params = DEFAULT_WORLD_PARAMS }: GenerateRequest): ExportTerrainResult {
    const start = performance.now()
    const field = generateField(seed, size, params)
    const workerMs = performance.now() - start
    const terrainStart = performance.now()
    const terrainRgba = terrainPixels(field, seed)
    const terrainMs = performance.now() - terrainStart
    const { decor } = field
    const buffers = [terrainRgba, decor.u, decor.v, decor.kind].map((a) => a.buffer as ArrayBuffer)
    return transfer({ size, terrainRgba, decor, workerMs, terrainMs, fieldBytes: fieldBytes(field) + terrainRgba.byteLength }, buffers)
  },

  /** `true` se os buffers do último resultado saíram do worker (transferidos, sem cópia). */
  lastResultTransferred(): boolean {
    return lastBuffers.length > 0 && lastBuffers.every((b) => b.byteLength === 0)
  },
}

export type GeneratorApi = typeof generatorApi
