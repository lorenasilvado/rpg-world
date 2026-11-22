import { temporal, type TemporalState } from 'zundo'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { WorldParams } from '../core'
import type { Pin } from '../persistence/types'
import type { PinsStore } from './pinsStore'
import type { WorldStore } from './worldStore'

/** O que o histórico guarda de cada passo: os pins e os parâmetros de geração do mundo. */
export type HistoryDoc = { pins: readonly Pin[]; params: WorldParams }

/** Quantos passos o histórico guarda (os mais antigos saem). */
export const HISTORY_LIMIT = 100

/**
 * O histórico de desfazer e refazer do mundo aberto (mundos.md → Regras, AC-F4-08): um só, para as
 * mudanças nos pins (`pinsStore`) e nos parâmetros de geração (`worldStore`). Ele usa o middleware
 * `temporal` do zundo (ADR 0001) sobre um espelho `{ pins, params }`: cada mudança que vale um passo
 * troca o espelho, e o zundo guarda o estado anterior.
 *
 * - Arrastar um slider só entra ao soltar (`paramsDragging` do `worldStore`), um passo por arrasto;
 *   arrastar um pin, um passo ao soltar (a lista só muda no `endDrag`).
 * - As teclas seguidas no nome do mesmo pin viram um passo só.
 * - Desfazer ou refazer devolve os pins ao `pinsStore` (a seleção de um pin que saiu é desfeita) e,
 *   se os parâmetros mudaram, os troca no `worldStore` pelo `setParams`, que pede só o mapa final
 *   1024², sem prévia.
 *
 * O `version` sobe a cada passo novo, desfeito ou refeito: o toast de "Pin excluído" fecha quando
 * outra coisa muda no histórico.
 */
export type WorldHistory = {
  /** O estado do zundo (`pastStates`, `futureStates`): os botões da barra leem por ele. */
  temporal: StoreApi<TemporalState<HistoryDoc>>
  /** Sobe a cada passo novo, desfeito ou refeito. */
  version: StoreApi<{ value: number }>
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
  /** Para de ouvir os stores (o mundo fechou). */
  dispose(): void
}

function sameParams(a: WorldParams, b: WorldParams): boolean {
  if (a === b) return true
  const keys = Object.keys(a) as (keyof WorldParams)[]
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

/** O id do pin cujo nome é a única diferença entre as duas listas (`null` se a mudança é outra). */
function renamedPin(before: readonly Pin[], after: readonly Pin[]): string | null {
  if (before.length !== after.length) return null
  let id: string | null = null
  for (let i = 0; i < before.length; i++) {
    const a = before[i]
    const b = after[i]
    if (a === b) continue
    if (id !== null || a.id !== b.id) return null
    const { name: _a, ...restA } = a
    const { name: _b, ...restB } = b
    if (JSON.stringify(restA) !== JSON.stringify(restB)) return null
    id = a.id
  }
  return id
}

export function createWorldHistory({ world, pins }: { world: WorldStore; pins: PinsStore }): WorldHistory {
  const doc = createStore<HistoryDoc>()(
    temporal<HistoryDoc>(() => ({ pins: pins.getState().pins, params: world.getState().params }), {
      limit: HISTORY_LIMIT,
      equality: (a, b) => a.pins === b.pins && sameParams(a.params, b.params),
    }),
  )
  const version = createStore<{ value: number }>()(() => ({ value: 0 }))
  const bump = () => version.setState({ value: version.getState().value + 1 })
  /** O passo mais recente veio de teclas no nome deste pin (elas se juntam num passo só). */
  let renaming: string | null = null
  /** Desfazendo ou refazendo: as mudanças nos stores vêm do histórico e não viram passo. */
  let applying = false

  const record = (next: Partial<HistoryDoc>) => {
    const current = doc.getState()
    const merged = { ...current, ...next }
    if (merged.pins === current.pins && sameParams(merged.params, current.params)) return
    const renamed = next.pins ? renamedPin(current.pins, next.pins) : null
    if (renamed !== null && renamed === renaming && doc.temporal.getState().pastStates.length > 0) {
      // Mais uma tecla no mesmo nome: troca o espelho sem guardar outro passo.
      doc.temporal.getState().pause()
      doc.setState(merged)
      doc.temporal.getState().resume()
      return
    }
    renaming = renamed
    doc.setState(merged)
    bump()
  }

  const unsubscribePins = pins.subscribe((state, prev) => {
    if (applying || state.pins === prev.pins) return
    record({ pins: state.pins })
  })
  const unsubscribeWorld = world.subscribe((state, prev) => {
    if (applying || state.params === prev.params || state.paramsDragging) return
    record({ params: state.params })
  })

  const apply = (move: () => void) => {
    const before = doc.getState()
    move()
    const after = doc.getState()
    if (after === before) return
    renaming = null
    applying = true
    try {
      if (after.pins !== pins.getState().pins) pins.getState().replacePins(after.pins)
      if (!sameParams(after.params, world.getState().params)) world.getState().setParams(after.params)
    } finally {
      applying = false
    }
    bump()
  }

  return {
    temporal: doc.temporal,
    version,
    undo: () => apply(() => doc.temporal.getState().undo()),
    redo: () => apply(() => doc.temporal.getState().redo()),
    canUndo: () => doc.temporal.getState().pastStates.length > 0,
    canRedo: () => doc.temporal.getState().futureStates.length > 0,
    dispose() {
      unsubscribePins()
      unsubscribeWorld()
    },
  }
}
