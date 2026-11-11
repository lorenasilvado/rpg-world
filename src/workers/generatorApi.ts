import { transfer } from 'comlink'
import { DEFAULT_WORLD_PARAMS, generateField, type CoreField, type WorldParams } from '../core'

/**
 * API que o worker de geração expõe pelo Comlink (`generator.worker.ts`). Fica num módulo à parte
 * para o Vitest testá-la sem worker. O relógio (`performance`) é usado só aqui, para medir: o
 * núcleo (`src/core`) continua dependendo só da seed.
 */
export type GenerateRequest = { seed: string; size: number; params?: WorldParams }

export type GenerateResult = {
  seed: string
  field: CoreField
  /** Tempo da geração dentro do worker, em ms (sem a ida e a volta das mensagens). */
  workerMs: number
}

/** Buffers do último resultado enviado, para conferir que foram transferidos sem cópia. */
let lastBuffers: ArrayBuffer[] = []

export const generatorApi = {
  generate({ seed, size, params = DEFAULT_WORLD_PARAMS }: GenerateRequest): GenerateResult {
    const start = performance.now()
    const field = generateField(seed, size, params)
    const workerMs = performance.now() - start
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
    ].map((a) => a.buffer as ArrayBuffer)
    // Os arrays vão para a thread principal por transferência: o worker perde o acesso a eles
    // (o buffer fica com 0 bytes) e nada é copiado (AC-M0-13).
    return transfer({ seed, field, workerMs }, lastBuffers)
  },

  /** `true` se os buffers do último resultado saíram do worker (transferidos, sem cópia). */
  lastResultTransferred(): boolean {
    return lastBuffers.length > 0 && lastBuffers.every((b) => b.byteLength === 0)
  },
}

export type GeneratorApi = typeof generatorApi
