import { releaseProxy, wrap, type Remote } from 'comlink'
import type { GenerateRequest, GenerateResult, GeneratorApi } from './generatorApi'
import { createLatestOnly, type LatestOnly } from './latestOnly'

/**
 * Lado da thread principal: cria o worker de geração e entrega só o resultado mais novo
 * (`latestOnly.ts`). Quem pede recebe `null` quando um pedido mais novo tomou o lugar do seu.
 */
export type Generator = LatestOnly<GenerateRequest, GenerateResult> & {
  api: Remote<GeneratorApi>
  terminate(): void
}

export function createGenerator(): Generator {
  const worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module', name: 'generator' })
  const api = wrap<GeneratorApi>(worker)
  const latest = createLatestOnly((req: GenerateRequest) => api.generate(req))
  return {
    ...latest,
    api,
    terminate() {
      api[releaseProxy]()
      worker.terminate()
    },
  }
}
