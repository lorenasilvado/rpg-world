import { createStore, type StoreApi } from 'zustand/vanilla'
import { DEFAULT_WORLD_PARAMS, type CoreField, type WorldParams } from '../core'
import type { GenerateRequest, GenerateResult } from '../workers/generatorApi'
import type { NewerOnly } from '../workers/newerOnly'
import { applyParamChange, type LandShareKey } from './params'
import { MAP_SIZE, PREVIEW_SIZE } from './sizes'

/**
 * Estado do mundo (ADR 0001): a seed, os parâmetros, o campo exibido e o status da geração. A UI
 * só escreve aqui; o renderer lê o `field`. É um store "vanilla" do Zustand, legível fora do React
 * (`useStore(worldStore, ...)` no React).
 *
 * Durante o arrasto de um slider (`dragParams`), cada mudança pede a prévia 256²; ao soltar
 * (`releaseParams`), o mapa final 1024². O `field` só é trocado por um resultado mais novo que o
 * exibido: um resultado velho nunca substitui um novo (AC-F1-10), e o mapa final pedido ao soltar
 * substitui a prévia (AC-F1-11). Desertos + Florestas nunca passa de 100%: o outro slider recua
 * (`applyParamChange`, AC-F1-14), e as duas ações devolvem qual recuou, para a sidebar piscá-lo.
 * Trocar a seed (`setSeed`) ou todos os parâmetros de uma vez (`setParams`: preset ou "Restaurar
 * padrão") pede o mapa final direto. O assistente de novo mundo (`createWorld`) troca o nome, a seed
 * e os parâmetros juntos e pede um mapa final só.
 */
export type GenerationStatus = 'idle' | 'generating' | 'error'

/** O que o store usa do gerador (`createGenerator`, ou um falso nos testes). */
export type WorldGenerator = Pick<NewerOnly<GenerateRequest, GenerateResult>, 'request' | 'latestVersion'>

export type WorldState = {
  /** Identidade do mundo salvo (`World.id`); o assistente dá um novo a cada mundo criado. */
  id: string
  /** Quando o mundo foi criado (ISO 8601). */
  createdAt: string
  /** Nome do mundo, na barra da sidebar. */
  name: string
  /**
   * Largura do mundo em km (a barra de escala é calculada a partir dela). Vem dos dados iniciais ou
   * do mundo novo, como o nome e a seed; sem valor válido, `DEFAULT_SIZE_KM`.
   */
  sizeKm: number
  seed: string
  params: WorldParams
  /** Campo exibido: o resultado mais novo entregue até agora (`null` antes do primeiro). */
  field: CoreField | null
  /** RGBA da textura do terreno do `field`, montado no worker (`null` sem campo). */
  terrainRgba: Uint8ClampedArray<ArrayBuffer> | null
  /** Versão do pedido que gerou o `field` (0 sem campo). */
  fieldVersion: number
  /**
   * Um slider está sendo arrastado (`dragParams`) e ainda não foi solto (`releaseParams`): os
   * parâmetros dessas prévias não entram no histórico de desfazer, só o valor ao soltar.
   */
  paramsDragging: boolean
  /** `generating` enquanto o pedido mais novo não chegou; `error` se ele falhou. */
  status: GenerationStatus
  error: unknown
  /** Troca a seed e gera o mapa final. */
  setSeed(seed: string): void
  /** Arrasto de um slider: muda os parâmetros e pede a prévia 256². Devolve o slider que recuou. */
  dragParams(change: Partial<WorldParams>): LandShareKey | null
  /** Soltou o slider: aplica a mudança (se houver) e pede o mapa final 1024². Devolve o que recuou. */
  releaseParams(change?: Partial<WorldParams>): LandShareKey | null
  /** Troca todos os parâmetros (um preset, ou o padrão) e pede o mapa final 1024². */
  setParams(params: Readonly<WorldParams>): void
  /** Gera o mapa final com a seed e os parâmetros atuais. */
  generate(): void
  /**
   * Mundo novo do assistente: um `id` e um `createdAt` novos; troca o nome, a largura em km (a
   * padrão, sem `sizeKm`), a seed e os 9 parâmetros e pede o mapa final 1024².
   */
  createWorld(world: { name: string; sizeKm?: number; seed: string; params: Readonly<WorldParams> }): void
}

export type WorldStore = StoreApi<WorldState>

/**
 * Se o editor está gerando (AC-F1-18): o pedido mais novo ainda não chegou, ou o mapa exibido é
 * a prévia 256² (durante o arrasto, uma prévia pode chegar antes da próxima e deixar o status
 * `idle` por um instante; o mapa só fica nítido com o mapa final). Enquanto isso, o mapa fica
 * borrado e "Distribuição do mapa" mostra "Gerando".
 */
export function isGenerating(state: Pick<WorldState, 'status' | 'field'>): boolean {
  if (state.status === 'generating') return true
  return state.status === 'idle' && state.field !== null && state.field.width < MAP_SIZE
}

export const DEFAULT_SEED = 'rpg-world'
/** Nome do mundo padrão, o que fica atrás do assistente ao abrir o app (o do protótipo). */
export const DEFAULT_WORLD_NAME = 'Terras de Valdora'
/** Largura do mundo padrão, em km (navegacao.md → Regras: barra de escala). */
export const DEFAULT_SIZE_KM = 800

/** A largura do mundo em km, se for válida (finita e positiva); senão, a padrão. */
export function validSizeKm(sizeKm: number | undefined): number {
  return sizeKm !== undefined && Number.isFinite(sizeKm) && sizeKm > 0 ? sizeKm : DEFAULT_SIZE_KM
}

/** Um `id` novo de mundo. */
export function newWorldId(): string {
  return crypto.randomUUID()
}

export type WorldStoreOptions = {
  /** Gera o `id` de um mundo novo (padrão: `newWorldId`). */
  newId?: () => string
  /** A hora atual, para o `createdAt` (padrão: `new Date()`). */
  now?: () => Date
}

export function createWorldStore(
  generator: WorldGenerator,
  initial: { id?: string; createdAt?: string; name?: string; sizeKm?: number; seed?: string; params?: WorldParams } = {},
  { newId = newWorldId, now = () => new Date() }: WorldStoreOptions = {},
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
            terrainRgba: delivered.result.terrainRgba,
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
      id: initial.id ?? newId(),
      createdAt: initial.createdAt ?? now().toISOString(),
      name: initial.name ?? DEFAULT_WORLD_NAME,
      sizeKm: validSizeKm(initial.sizeKm),
      seed: initial.seed ?? DEFAULT_SEED,
      params: { ...(initial.params ?? DEFAULT_WORLD_PARAMS) },
      field: null,
      terrainRgba: null,
      fieldVersion: 0,
      paramsDragging: false,
      status: 'idle',
      error: null,
      setSeed(seed) {
        set({ seed })
        request(MAP_SIZE)
      },
      dragParams(change) {
        const { params, receded } = applyParamChange(get().params, change)
        set({ params, paramsDragging: true })
        request(PREVIEW_SIZE)
        return receded
      },
      releaseParams(change = {}) {
        const { params, receded } = applyParamChange(get().params, change)
        set({ params, paramsDragging: false })
        request(MAP_SIZE)
        return receded
      },
      setParams(params) {
        // Os presets e o padrão já respeitam Desertos + Florestas ≤ 100; o `applyParamChange` só
        // garante isso para qualquer valor.
        set({ params: applyParamChange(get().params, params).params, paramsDragging: false })
        request(MAP_SIZE)
      },
      generate() {
        request(MAP_SIZE)
      },
      createWorld({ name, sizeKm, seed, params }) {
        set({
          id: newId(),
          createdAt: now().toISOString(),
          name,
          sizeKm: validSizeKm(sizeKm),
          seed,
          params: applyParamChange(get().params, params).params,
        })
        request(MAP_SIZE)
      },
    }
  })
}
