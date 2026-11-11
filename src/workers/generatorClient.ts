import { releaseProxy, wrap, type Remote } from 'comlink'
import type { GenerateRequest, GenerateResult, GeneratorApi } from './generatorApi'
import { createNewerOnly, type NewerOnly } from './newerOnly'

/**
 * Lado da thread principal: cria o worker de geração e entrega todo resultado mais novo que o
 * último entregue (`newerOnly.ts`). Quem pede recebe `null` quando o pedido foi substituído na
 * espera por um mais novo.
 */
export type Generator = NewerOnly<GenerateRequest, GenerateResult> & {
  api: Remote<GeneratorApi>
  terminate(): void
}

export function createGenerator(): Generator {
  const worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module', name: 'generator' })
  const api = wrap<GeneratorApi>(worker)
  const newer = createNewerOnly((req: GenerateRequest) => api.generate(req))
  return {
    ...newer,
    api,
    terminate() {
      api[releaseProxy]()
      worker.terminate()
    },
  }
}
