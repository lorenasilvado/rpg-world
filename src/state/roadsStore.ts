import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Pin, Road } from '../persistence/types'
import type { PinsStore } from './pinsStore'

/**
 * As estradas do mundo aberto (estradas.md, AC-F5-01, AC-F5-02): a lista que o mundo salva. É um
 * store "vanilla" do Zustand, como o `pinsStore`: o renderer desenha as estradas, o salvamento
 * automático grava a lista quando ela muda, e o desfazer é do histórico do mundo (`history.ts`).
 *
 * O store ouve os pins do mundo: excluir um pin exclui as estradas ligadas a ele (`from` ou `to`),
 * na mesma mudança dos pins, e o histórico guarda as duas num passo só (o Desfazer devolve tudo).
 * Ao abrir, um vínculo com um pin que não existe sai (a estrada fica, com a ponta no ponto dela).
 */
export type RoadsState = {
  roads: Road[]
  /** Troca a lista inteira (o desfazer e o refazer do histórico). */
  replaceRoads(roads: readonly Road[]): void
  /** Para de ouvir os pins (o mundo fechou). */
  dispose(): void
}

export type RoadsStore = StoreApi<RoadsState>

/** O nome de uma estrada sem nome no arquivo (um JSON editado à mão). */
export const DEFAULT_ROAD_NAME = 'Estrada'

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

export function createRoadsStore(initial: readonly Road[] = [], pins?: PinsStore): RoadsStore {
  const ids = new Set((pins?.getState().pins ?? []).map((p) => p.id))
  const store = createStore<RoadsState>()((set) => ({
    roads: pins ? initial.map((r) => withValidLinks(r, ids)) : [...initial],
    replaceRoads(list) {
      set({ roads: list as Road[] })
    },
    dispose() {
      unsubscribe()
    },
  }))
  const unsubscribe =
    pins?.subscribe((state, prev) => {
      if (state.pins === prev.pins) return
      const roads = store.getState().roads
      const kept = roadsWithPins(roads, state.pins)
      if (kept !== roads) store.setState({ roads: kept as Road[] })
    }) ?? (() => {})
  return store
}
