import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Pin, Road, RoadKind } from '../persistence/types'
import type { PinsStore } from './pinsStore'

/**
 * As estradas do mundo aberto (estradas.md, AC-F5-01, AC-F5-02): a lista que o mundo salva. É um
 * store "vanilla" do Zustand, como o `pinsStore`: o renderer desenha as estradas, o salvamento
 * automático grava a lista quando ela muda, e o desfazer é do histórico do mundo (`history.ts`).
 *
 * O store ouve os pins do mundo: excluir um pin exclui as estradas ligadas a ele (`from` ou `to`),
 * na mesma mudança dos pins, e o histórico guarda as duas num passo só (o Desfazer devolve tudo).
 * Ao abrir, um vínculo com um pin que não existe sai (a estrada fica, com a ponta no ponto dela).
 *
 * O drawer da estrada muda o nome e o tipo (`updateRoad`, AC-F5-07) e exclui (`removeRoad`, AC-F5-08).
 *
 * A estrada desenhada à mão entra pelo `addRoad` (AC-F5-04) e fica selecionada (`selectedId`). A
 * seleção não vai para o mundo salvo nem para o histórico: a estrada que sai da lista (desfeita, ou
 * do pin excluído) deixa de estar selecionada, e selecionar um pin tira a seleção da estrada.
 */
export type RoadsState = {
  roads: Road[]
  /** A estrada selecionada, ou `null`. */
  selectedId: string | null
  /**
   * Cria a estrada desenhada (AC-F5-04, AC-F5-05): "Nova estrada", tipo Estrada, pelos pontos (0..1
   * no mapa), com as pontas ligadas aos pins `from` e `to` (o vínculo com um pin que já não existe
   * sai); ela fica selecionada. Com menos de 2 pontos, nada muda (`null`).
   */
  addRoad(draft: { points: readonly { u: number; v: number }[]; from?: string; to?: string }): Road | null
  /** Seleciona a estrada (`null`: nenhuma). */
  select(id: string | null): void
  /**
   * Muda o nome ou o tipo de via da estrada (o drawer da estrada, AC-F5-07). Um nome vazio (só
   * espaços) não muda nada; o nome fica sem os espaços das pontas.
   */
  updateRoad(id: string, patch: { name?: string; kind?: RoadKind }): void
  /** Exclui a estrada (AC-F5-08); `false` se ela não existe. */
  removeRoad(id: string): boolean
  /**
   * Sobe quando a edição do nome termina (o campo perdeu o foco): as teclas seguidas no nome viram
   * um passo só no histórico, e depois disso é outro passo.
   */
  textEditEnds: number
  endTextEdit(): void
  /** Troca a lista inteira (o desfazer e o refazer do histórico). */
  replaceRoads(roads: readonly Road[]): void
  /** Para de ouvir os pins (o mundo fechou). */
  dispose(): void
}

export type RoadsStore = StoreApi<RoadsState>

/** O nome de uma estrada sem nome no arquivo (um JSON editado à mão). */
export const DEFAULT_ROAD_NAME = 'Estrada'

/** O nome da estrada desenhada à mão (estradas.md → Ações). */
export const NEW_ROAD_NAME = 'Nova estrada'

/** A estrada sem os vínculos com pins que não estão em `ids`; sem nenhum, o mesmo objeto. */
function withValidLinks(road: Road, ids: ReadonlySet<string>): Road {
  const from = road.from !== undefined && !ids.has(road.from)
  const to = road.to !== undefined && !ids.has(road.to)
  if (!from && !to) return road
  const { from: f, to: t, ...rest } = road
  return { ...rest, ...(from ? {} : { from: f }), ...(to ? {} : { to: t }) }
}

/** As estradas sem as ligadas a um pin que não está em `pins` (o pin foi excluído). */
export function roadsWithPins(roads: readonly Road[], pins: readonly Pin[]): readonly Road[] {
  const ids = new Set(pins.map((p) => p.id))
  const kept = roads.filter((r) => (r.from === undefined || ids.has(r.from)) && (r.to === undefined || ids.has(r.to)))
  return kept.length === roads.length ? roads : kept
}

/** A seleção, se a estrada ainda está na lista. */
function keepSelected(id: string | null, roads: readonly Road[]): string | null {
  return id !== null && roads.some((r) => r.id === id) ? id : null
}

export function createRoadsStore(
  initial: readonly Road[] = [],
  pins?: PinsStore,
  { newId = () => crypto.randomUUID() }: { newId?: () => string } = {},
): RoadsStore {
  const ids = new Set((pins?.getState().pins ?? []).map((p) => p.id))
  const store = createStore<RoadsState>()((set, get) => ({
    roads: pins ? initial.map((r) => withValidLinks(r, ids)) : [...initial],
    selectedId: null,
    addRoad({ points, from, to }) {
      if (points.length < 2) return null
      const drawn: Road = {
        id: newId(),
        name: NEW_ROAD_NAME,
        kind: 'road',
        points: points.map((p) => ({ u: p.u, v: p.v })),
        ...(from !== undefined ? { from } : {}),
        ...(to !== undefined ? { to } : {}),
      }
      // Um pin da ponta pode ter saído no meio do desenho (Delete, Desfazer): a ponta fica no ponto dela.
      const road = pins ? withValidLinks(drawn, new Set(pins.getState().pins.map((p) => p.id))) : drawn
      set({ roads: [...get().roads, road], selectedId: road.id })
      // Uma seleção só no mapa: o pin selecionado deixa de estar.
      pins?.getState().select(null)
      return road
    },
    select(id) {
      if (get().selectedId === id) return
      set({ selectedId: id })
      if (id !== null) pins?.getState().select(null)
    },
    updateRoad(id, patch) {
      const name = patch.name?.trim()
      if (patch.name !== undefined && !name) return
      let changed = false
      const list = get().roads.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...(name !== undefined ? { name } : {}), ...(patch.kind !== undefined ? { kind: patch.kind } : {}) }
        if (next.name === r.name && next.kind === r.kind) return r
        changed = true
        return next
      })
      if (changed) set({ roads: list })
    },
    removeRoad(id) {
      const { roads, selectedId } = get()
      const kept = roads.filter((r) => r.id !== id)
      if (kept.length === roads.length) return false
      set({ roads: kept, selectedId: selectedId === id ? null : selectedId })
      return true
    },
    textEditEnds: 0,
    endTextEdit() {
      set({ textEditEnds: get().textEditEnds + 1 })
    },
    replaceRoads(list) {
      set({ roads: list as Road[], selectedId: keepSelected(get().selectedId, list) })
    },
    dispose() {
      unsubscribe()
    },
  }))
  const unsubscribe =
    pins?.subscribe((state, prev) => {
      if (state.selectedId !== prev.selectedId && state.selectedId !== null && store.getState().selectedId !== null) {
        store.setState({ selectedId: null })
      }
      if (state.pins === prev.pins) return
      const { roads, selectedId } = store.getState()
      const kept = roadsWithPins(roads, state.pins)
      if (kept !== roads) store.setState({ roads: kept as Road[], selectedId: keepSelected(selectedId, kept) })
    }) ?? (() => {})
  return store
}
