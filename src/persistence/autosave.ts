import { createStore, type StoreApi } from 'zustand/vanilla'
import { GENERATOR_VERSION } from '../core'
import type { PinsStore } from '../state/pinsStore'
import type { WorldState, WorldStore } from '../state/worldStore'
import type { World } from './types'
import type { WorldsRepo } from './worldsRepo'

/**
 * Salvamento automático do mundo aberto (mundos.md → Regras, AC-F4-01 a AC-F4-03): não existe
 * botão "Salvar". Cada mudança no que o mundo salva (nome, seed, parâmetros, `sizeKm`, ou um mundo
 * novo do assistente) põe o indicador em "Salvando…" e grava o mundo depois de `delayMs` sem outra
 * mudança (o arrasto de um slider grava uma vez só, ao parar). Mudar os pins (`pins`: criar,
 * renomear) também grava. A gravação conclui em "Salvo"; se
 * falha, em "Erro ao salvar", e a próxima mudança tenta de novo (ou `retry`, já).
 *
 * O registro (`toWorldRecord`) leva só a seed, os parâmetros, `sizeKm`, `generatorVersion`, os pins
 * e as estradas, além do nome, do `id` e das datas: o terreno é regerado (RNF-5). Os pins vêm do
 * `pins` (sem ele, do mundo reaberto); as estradas ainda não existem no editor: vêm do mundo
 * reaberto (`loaded`), e um mundo novo nasce sem.
 *
 * As gravações vão uma de cada vez, na ordem: a última mudança é a que fica no banco.
 */
export type SaveStatus = 'saved' | 'saving' | 'error'

export type SaveState = {
  status: SaveStatus
  /** O erro da última gravação, se ela falhou. */
  error: unknown
  /** Grava já o mundo atual (o "Tentar de novo" do indicador). */
  retry(): void
}

export type SaveStore = StoreApi<SaveState>

export type Autosave = {
  store: SaveStore
  /** Grava já o que está esperando o debounce e resolve quando o banco terminar. */
  flush(): Promise<void>
  /** Grava já o mundo atual, mesmo sem mudança (o mundo novo do assistente), com o status no indicador. */
  saveNow(): Promise<void>
  /** O mundo atual, como ele é salvo (o Exportar do editor), com o `updatedAt` em agora. */
  record(): World
  /** Para de ouvir o mundo (o que esperava o debounce não é gravado). */
  dispose(): void
}

/** Pausa depois da última mudança antes de gravar. */
export const SAVE_DELAY_MS = 500

type Saved = Pick<WorldState, 'id' | 'createdAt' | 'name' | 'seed' | 'params' | 'sizeKm'>

/** O mundo como ele é salvo, a partir do estado do editor. */
export function toWorldRecord(state: Saved, extra: Pick<World, 'pins' | 'roads'>, updatedAt: Date): World {
  return {
    id: state.id,
    name: state.name,
    seed: state.seed,
    generatorVersion: GENERATOR_VERSION,
    sizeKm: state.sizeKm,
    params: { ...state.params },
    pins: extra.pins,
    roads: extra.roads,
    createdAt: state.createdAt,
    updatedAt: updatedAt.toISOString(),
  }
}

function savedChanged(a: Saved, b: Saved): boolean {
  return a.id !== b.id || a.createdAt !== b.createdAt || a.name !== b.name || a.seed !== b.seed || a.params !== b.params || a.sizeKm !== b.sizeKm
}

export function createAutosave({
  world,
  pins,
  repo,
  loaded,
  delayMs = SAVE_DELAY_MS,
  now = () => new Date(),
}: {
  world: WorldStore
  /** Os pins do mundo aberto. */
  pins?: PinsStore
  repo: Pick<WorldsRepo, 'save'>
  /** O mundo reaberto do banco, se houver: dá os pins e as estradas enquanto o `id` for o dele. */
  loaded?: World
  delayMs?: number
  now?: () => Date
}): Autosave {
  let timer: ReturnType<typeof setTimeout> | null = null
  let chain: Promise<void> = Promise.resolve()
  /** Número da gravação mais nova pedida: só ela decide o status final. */
  let latest = 0

  const current = (): World => {
    const state = world.getState()
    const saved = loaded && loaded.id === state.id ? loaded : { pins: [], roads: [] }
    const extra = { pins: pins ? pins.getState().pins : saved.pins, roads: saved.roads }
    return toWorldRecord(state, extra, now())
  }

  const write = (): Promise<void> => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    const seq = ++latest
    const record = current()
    store.setState({ status: 'saving' })
    chain = chain.then(() =>
      repo.save(record).then(
        () => {
          if (seq === latest && timer === null) store.setState({ status: 'saved', error: null })
        },
        (error: unknown) => {
          if (seq === latest && timer === null) store.setState({ status: 'error', error })
        },
      ),
    )
    return chain
  }

  const store = createStore<SaveState>()(() => ({
    status: 'saved',
    error: null,
    retry() {
      void write()
    },
  }))

  const schedule = () => {
    if (timer !== null) clearTimeout(timer)
    store.setState({ status: 'saving' })
    timer = setTimeout(() => void write(), delayMs)
  }
  const unsubscribeWorld = world.subscribe((state, prev) => {
    if (savedChanged(state, prev)) schedule()
  })
  const unsubscribePins = pins?.subscribe((state, prev) => {
    if (state.pins !== prev.pins) schedule()
  })
  const unsubscribe = () => {
    unsubscribeWorld()
    unsubscribePins?.()
  }

  return {
    store,
    flush() {
      return timer !== null ? write() : chain
    },
    saveNow: write,
    record: current,
    dispose() {
      unsubscribe()
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
  }
}
