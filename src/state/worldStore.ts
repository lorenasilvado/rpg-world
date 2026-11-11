import { createStore, type StoreApi } from 'zustand/vanilla'
import { DEFAULT_WORLD_PARAMS, type CoreField, type WorldParams } from '../core'
import type { GenerateRequest, GenerateResult } from '../workers/generatorApi'
import type { NewerOnly } from '../workers/newerOnly'
import { MAP_SIZE, PREVIEW_SIZE } from './sizes'

/**
 * Estado do mundo (ADR 0001): a seed, os parâmetros, o campo exibido e o status da geração. A UI
 * só escreve aqui; o renderer lê o `field`. É um store "vanilla" do Zustand, legível fora do React
 * (`useStore(worldStore, ...)` no React).
 *
 * Durante o arrasto de um slider (`dragParams`), cada mudança pede a prévia 256²; ao soltar
 * (`releaseParams`), o mapa final 1024². O `field` só é trocado por um resultado mais novo que o
 * exibido: um resultado velho nunca substitui um novo (AC-F1-10), e o mapa final pedido ao soltar
 * substitui a prévia (AC-F1-11).
 */
export type GenerationStatus = 'idle' | 'generating' | 'error'

/** O que o store usa do gerador (`createGenerator`, ou um falso nos testes). */
export type WorldGenerator = Pick<NewerOnly<GenerateRequest, GenerateResult>, 'request' | 'latestVersion'>

export type WorldState = {
  seed: string
  params: WorldParams
  /** Campo exibido: o resultado mais novo entregue até agora (`null` antes do primeiro). */
  field: CoreField | null
  /** Versão do pedido que gerou o `field` (0 sem campo). */
  fieldVersion: number
  /** `generating` enquanto o pedido mais novo não chegou; `error` se ele falhou. */
  status: GenerationStatus
  error: unknown
  /** Troca a seed e gera o mapa final. */
  setSeed(seed: string): void
  /** Arrasto de um slider: muda os parâmetros e pede a prévia 256². */
  dragParams(change: Partial<WorldParams>): void
  /** Soltou o slider: aplica a mudança (se houver) e pede o mapa final 1024². */
  releaseParams(change?: Partial<WorldParams>): void
  /** Gera o mapa final com a seed e os parâmetros atuais. */
  generate(): void
}

export type WorldStore = StoreApi<WorldState>

export const DEFAULT_SEED = 'rpg-world'

export function createWorldStore(
  generator: WorldGenerator,
  initial: { seed?: string; params?: WorldParams } = {},
): WorldStore {
  return createStore<WorldState>()((set, get) => {
    const request = (size: number) => {
      const { seed, params } = get()
      const pending = generator.request({ seed, size, params })
      const version = generator.latestVersion()
      set({ status: 'generating' })
      pending.then(
        (delivered) => {
          if (!delivered || delivered.version <= get().fieldVersion) return
          set({
            field: delivered.result.field,
            fieldVersion: delivered.version,
            status: delivered.version === generator.latestVersion() ? 'idle' : 'generating',
            error: null,
          })
        },
        // A falha (da geração ou do worker) do pedido mais novo vira `error`, e o editor mostra o
        // toast de erro (AC-F1-12).
        (error) => {
          if (version === generator.latestVersion()) set({ status: 'error', error })
        },
      )
    }

    return {
      seed: initial.seed ?? DEFAULT_SEED,
      params: { ...(initial.params ?? DEFAULT_WORLD_PARAMS) },
      field: null,
      fieldVersion: 0,
      status: 'idle',
      error: null,
      setSeed(seed) {
        set({ seed })
        request(MAP_SIZE)
      },
      dragParams(change) {
        set({ params: { ...get().params, ...change } })
        request(PREVIEW_SIZE)
      },
      releaseParams(change = {}) {
        set({ params: { ...get().params, ...change } })
        request(MAP_SIZE)
      },
      generate() {
        request(MAP_SIZE)
      },
    }
  })
}
