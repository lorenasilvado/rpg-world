import { temporal, type TemporalState } from 'zundo'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { WorldParams } from '../core'
import type { Pin, Road } from '../persistence/types'
import type { PinsStore } from './pinsStore'
import type { RoadsStore } from './roadsStore'
import type { WorldStore } from './worldStore'

/** O que o histórico guarda de cada passo: os pins, as estradas e os parâmetros de geração do mundo. */
export type HistoryDoc = { pins: readonly Pin[]; roads: readonly Road[]; params: WorldParams }

/** As estradas de um histórico sem `roadsStore` (a mesma lista: não vira mudança). */
const NO_ROADS: readonly Road[] = []

/** Quantos passos o histórico guarda (os mais antigos saem). */
export const HISTORY_LIMIT = 100

/**
 * O histórico de desfazer e refazer do mundo aberto (mundos.md → Regras, AC-F4-08): um só, para as
 * mudanças nos pins (`pinsStore`), nas estradas (`roadsStore`, estradas.md AC-F5-02) e nos parâmetros
 * de geração (`worldStore`). Ele usa o middleware `temporal` do zundo (ADR 0001) sobre um espelho
 * `{ pins, roads, params }`: cada mudança que vale um passo troca o espelho, e o zundo guarda o
 * estado anterior. Excluir um pin exclui as estradas ligadas a ele (o `roadsStore` ouve os pins) num
 * passo só: o espelho lê as duas listas a cada mudança de uma delas.
 *
 * - Arrastar um slider só entra ao soltar (`paramsDragging` do `worldStore`), um passo por arrasto;
 *   arrastar um pin, um passo ao soltar (a lista só muda no `endDrag`).
 * - As teclas seguidas no mesmo texto do mesmo pin (o nome, a descrição ou o valor de um campo
 *   livre) viram um passo só. A edição termina quando o campo perde o foco (`textEditEnds` do
 *   `pinsStore`) ou a seleção muda: depois disso, mais teclas no mesmo texto são outro passo.
 *   Trocar de texto (do nome para a descrição) também começa outro passo.
 * - Desfazer ou refazer devolve os pins ao `pinsStore` (a seleção de um pin que saiu é desfeita), as
 *   estradas ao `roadsStore` e,
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

/** Os textos do pin em que as teclas seguidas se juntam num passo só. */
const TEXT_FIELDS = ['name', 'description'] as const

/**
 * O valor do campo livre que mudou, como `fields:<chave>`, quando os dois têm as mesmas chaves, na
 * mesma ordem, e só um valor muda (`null` se a mudança é outra).
 */
function editedFieldValue(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): string | null {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return null
  const changed = ka.filter((k) => a[k] !== b[k])
  return changed.length === 1 ? `fields:${changed[0]}` : null
}

/**
 * O texto editado, como `<id do pin>:<campo>`, quando a única diferença entre as duas listas é o
 * nome, a descrição ou o valor de um campo livre de um pin (`<id>:fields:<chave>`; `null` se a
 * mudança é outra).
 */
export function editedText(before: readonly Pin[], after: readonly Pin[]): string | null {
  if (before.length !== after.length) return null
  let edited: string | null = null
  for (let i = 0; i < before.length; i++) {
    const a = before[i]
    const b = after[i]
    if (a === b) continue
    if (edited !== null || a.id !== b.id) return null
    const field = TEXT_FIELDS.find((f) => a[f] !== b[f]) ?? (a.fields !== b.fields ? 'fields' : null)
    if (!field) return null
    const { [field]: _a, ...restA } = a
    const { [field]: _b, ...restB } = b
    if (JSON.stringify(restA) !== JSON.stringify(restB)) return null
    const part = field === 'fields' ? editedFieldValue(a.fields, b.fields) : field
    if (part === null) return null
    edited = `${a.id}:${part}`
  }
  return edited
}

export function createWorldHistory({ world, pins, roads }: { world: WorldStore; pins: PinsStore; roads?: RoadsStore }): WorldHistory {
  const currentRoads = (): readonly Road[] => roads?.getState().roads ?? NO_ROADS
  const doc = createStore<HistoryDoc>()(
    temporal<HistoryDoc>(() => ({ pins: pins.getState().pins, roads: currentRoads(), params: world.getState().params }), {
      limit: HISTORY_LIMIT,
      equality: (a, b) => a.pins === b.pins && a.roads === b.roads && sameParams(a.params, b.params),
    }),
  )
  const version = createStore<{ value: number }>()(() => ({ value: 0 }))
  const bump = () => version.setState({ value: version.getState().value + 1 })
  /** O passo mais recente veio de teclas neste texto (`<pin>:<campo>`): elas se juntam num passo só. */
  let editing: string | null = null
  /** Desfazendo ou refazendo: as mudanças nos stores vêm do histórico e não viram passo. */
  let applying = false

  const record = (next: Partial<HistoryDoc>) => {
    const current = doc.getState()
    const merged = { ...current, ...next }
    if (merged.pins === current.pins && merged.roads === current.roads && sameParams(merged.params, current.params)) return
    const edited = next.pins && merged.roads === current.roads ? editedText(current.pins, next.pins) : null
    if (edited !== null && edited === editing && doc.temporal.getState().pastStates.length > 0) {
      // Mais uma tecla no mesmo texto: troca o espelho sem guardar outro passo.
      doc.temporal.getState().pause()
      doc.setState(merged)
      doc.temporal.getState().resume()
      return
    }
    editing = edited
    doc.setState(merged)
    bump()
  }

  const unsubscribePins = pins.subscribe((state, prev) => {
    if (state.textEditEnds !== prev.textEditEnds || state.selectedId !== prev.selectedId) editing = null
    if (applying || state.pins === prev.pins) return
    record({ pins: state.pins, roads: currentRoads() })
  })
  const unsubscribeRoads =
    roads?.subscribe((state, prev) => {
      if (applying || state.roads === prev.roads) return
      record({ roads: state.roads, pins: pins.getState().pins })
    }) ?? (() => {})
  const unsubscribeWorld = world.subscribe((state, prev) => {
    if (applying || state.params === prev.params || state.paramsDragging) return
    record({ params: state.params })
  })

  const apply = (move: () => void) => {
    const before = doc.getState()
    move()
    const after = doc.getState()
    if (after === before) return
    editing = null
    applying = true
    try {
      if (after.pins !== pins.getState().pins) pins.getState().replacePins(after.pins)
      // Os pins voltam antes: o `roadsStore` tira as estradas de um pin que saiu, e a lista do passo as troca.
      if (roads && after.roads !== roads.getState().roads) roads.getState().replaceRoads(after.roads)
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
      unsubscribeRoads()
      unsubscribeWorld()
    },
  }
}
