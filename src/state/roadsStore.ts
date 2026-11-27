import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Pin, Road, RoadKind } from '../persistence/types'
import type { UV } from '../render/layers/roadMath'
import type { PinsStore } from './pinsStore'

/**
 * As estradas do mundo aberto (estradas.md, AC-F5-01, AC-F5-02): a lista que o mundo salva. É um
 * store "vanilla" do Zustand, como o `pinsStore`: o renderer desenha as estradas, o salvamento
 * automático grava a lista quando ela muda, e o desfazer é do histórico do mundo (`history.ts`).
 *
 * O store ouve os pins do mundo: excluir um pin exclui as estradas ligadas a ele numa ponta (`from`
 * ou `to`), e a ligada a ele só no meio (o `pin` de um ponto, AC-F5-17) fica, com o ponto solto onde
 * o pin estava, na mesma mudança dos pins; o histórico guarda as duas num passo só (o Desfazer
 * devolve tudo). Ao abrir, um vínculo com um pin que não existe sai (a estrada fica, com o ponto
 * onde está).
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
   * no mapa; um do meio pode vir ligado a um pin, AC-F5-17), com as pontas ligadas aos pins `from` e
   * `to` (o vínculo com um pin que já não existe sai); ela fica selecionada. Com menos de 2 pontos, nada muda (`null`). A Rota automática
   * (AC-F5-12) passa o nome ("Rota de A a B") e `select: false`: a rota criada não fica selecionada;
   * a rota marítima (AC-F5-13) passa também o tipo (`kind: 'sea'`).
   */
  addRoad(
    draft: { points: readonly Road['points'][number][]; from?: string; to?: string; name?: string; kind?: RoadKind },
    options?: { select?: boolean },
  ): Road | null
  /**
   * Cria várias estradas numa mudança só, um passo no Desfazer ("Conectar cidades", AC-F5-14), como
   * o `addRoad` com `select: false`; as que têm menos de 2 pontos ficam de fora. Devolve as criadas.
   */
  addRoads(drafts: readonly { points: readonly Road['points'][number][]; from?: string; to?: string; name?: string; kind?: RoadKind }[]): Road[]
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

/**
 * Os pontos sem o vínculo com um pin do meio que não está em `ids`; o ponto fica em `lastPos` do pin
 * (onde ele estava), ou onde está. Sem nenhum, o mesmo array.
 */
function pointsWithValidPins(points: Road['points'], ids: ReadonlySet<string>, lastPos?: (id: string) => UV | undefined): Road['points'] {
  if (!points.some((p) => p.pin !== undefined && !ids.has(p.pin))) return points
  return points.map((p) => {
    if (p.pin === undefined || ids.has(p.pin)) return p
    const at = lastPos?.(p.pin) ?? p
    return { u: at.u, v: at.v }
  })
}

/** A estrada sem os vínculos com pins que não estão em `ids`; sem nenhum, o mesmo objeto. */
function withValidLinks(road: Road, ids: ReadonlySet<string>, lastPos?: (id: string) => UV | undefined): Road {
  const from = road.from !== undefined && !ids.has(road.from)
  const to = road.to !== undefined && !ids.has(road.to)
  const points = pointsWithValidPins(road.points, ids, lastPos)
  if (!from && !to && points === road.points) return road
  const { from: f, to: t, ...rest } = road
  return { ...rest, points, ...(from ? {} : { from: f }), ...(to ? {} : { to: t }) }
}

/**
 * As estradas depois que saem pins (excluídos): sai a estrada com uma ponta ligada a um pin que não
 * está em `pins`; a ligada a ele só no meio fica, com o ponto solto onde o pin estava (`prev`, os
 * pins de antes; AC-F5-17). Nada muda: a mesma lista.
 */
export function roadsWithPins(roads: readonly Road[], pins: readonly Pin[], prev: readonly Pin[] = []): readonly Road[] {
  const ids = new Set(pins.map((p) => p.id))
  const before = new Map(prev.map((p) => [p.id, p.pos]))
  let changed = false
  const kept: Road[] = []
  for (const r of roads) {
    if ((r.from !== undefined && !ids.has(r.from)) || (r.to !== undefined && !ids.has(r.to))) {
      changed = true
      continue
    }
    const next = withValidLinks(r, ids, (id) => before.get(id))
    if (next !== r) changed = true
    kept.push(next)
  }
  return changed ? kept : roads
}

/**
 * Os pins ligados à estrada, na ordem dela (o "Liga" do drawer, AC-F5-17): a ponta `from`, os pins
 * do meio e a ponta `to`, cada um uma vez.
 */
export function linkedPins(road: Pick<Road, 'points' | 'from' | 'to'>): string[] {
  const ids = [road.from, ...road.points.map((p) => p.pin), road.to].filter((id): id is string => id !== undefined)
  return [...new Set(ids)]
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
  /** A estrada nova do rascunho, ou `null` com menos de 2 pontos. */
  const draftRoad = ({ points, from, to, name, kind = 'road' }: Parameters<RoadsState['addRoad']>[0]): Road | null => {
    if (points.length < 2) return null
    const drawn: Road = {
      id: newId(),
      name: name?.trim() || NEW_ROAD_NAME,
      kind,
      points: points.map((p) => (p.pin !== undefined ? { u: p.u, v: p.v, pin: p.pin } : { u: p.u, v: p.v })),
      ...(from !== undefined ? { from } : {}),
      ...(to !== undefined ? { to } : {}),
    }
    // Um pin ligado pode ter saído no meio do desenho (Delete, Desfazer): a ponta fica no ponto dela.
    return pins ? withValidLinks(drawn, new Set(pins.getState().pins.map((p) => p.id))) : drawn
  }
  const store = createStore<RoadsState>()((set, get) => ({
    roads: pins ? initial.map((r) => withValidLinks(r, ids)) : [...initial],
    selectedId: null,
    addRoad(draft, { select = true } = {}) {
      const road = draftRoad(draft)
      if (!road) return null
      if (!select) {
        set({ roads: [...get().roads, road] })
        return road
      }
      set({ roads: [...get().roads, road], selectedId: road.id })
      // Uma seleção só no mapa: o pin selecionado deixa de estar.
      pins?.getState().select(null)
      return road
    },
    addRoads(drafts) {
      const created = drafts.map(draftRoad).filter((r): r is Road => r !== null)
      if (created.length > 0) set({ roads: [...get().roads, ...created] })
      return created
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
      const kept = roadsWithPins(roads, state.pins, prev.pins)
      if (kept !== roads) store.setState({ roads: kept as Road[], selectedId: keepSelected(selectedId, kept) })
    }) ?? (() => {})
  return store
}
