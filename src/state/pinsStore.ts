import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Pin } from '../persistence/types'
import { DEFAULT_PIN_TYPE, NEW_PIN_NAME, pinType, type PinType } from './pinTypes'

/**
 * Os pins do mundo aberto (pins.md, AC-F3-01 a AC-F3-03): a lista que o mundo salva (`pins`) e o
 * estado da interface sobre eles, que não é salvo: o pin selecionado (com o drawer aberto), o pin
 * sob o mouse e o pin recém-criado (`newPinId`: ele quica ao aparecer, e o drawer abre com o nome
 * em edição). É um store "vanilla" do Zustand, como o `worldStore`: o renderer lê os pins e a
 * seleção, e o salvamento automático grava a lista quando ela muda.
 */
export type PinsState = {
  pins: Pin[]
  /** O pin com o drawer aberto (`null`: nenhum). */
  selectedId: string | null
  /** O pin sob o mouse. */
  hoveredId: string | null
  /** O último pin criado, enquanto continua selecionado. */
  newPinId: string | null
  /**
   * Cria um pin na posição (u, v), do último tipo usado no mundo (Cidade no primeiro), com o nome
   * "Novo pin", e o seleciona.
   */
  addPin(pos: { u: number; v: number }): Pin
  /** Seleciona o pin (abre o drawer) ou, com `null`, fecha. */
  select(id: string | null): void
  setHovered(id: string | null): void
  rename(id: string, name: string): void
}

export type PinsStore = StoreApi<PinsState>

/** O tipo de um pin novo: o do último pin do mundo, ou Cidade no primeiro. */
export function nextPinType(pins: readonly Pin[]): PinType {
  const last = pins.at(-1)
  return last ? pinType(last.type) : DEFAULT_PIN_TYPE
}

export function createPinsStore(initial: readonly Pin[] = [], { newId = () => crypto.randomUUID() }: { newId?: () => string } = {}): PinsStore {
  return createStore<PinsState>()((set, get) => ({
    pins: [...initial],
    selectedId: null,
    hoveredId: null,
    newPinId: null,
    addPin(pos) {
      const type = nextPinType(get().pins)
      const pin: Pin = {
        id: newId(),
        type,
        name: NEW_PIN_NAME,
        pos: { u: pos.u, v: pos.v },
        icon: { kind: 'builtin', key: type },
        description: '',
        tags: [],
        fields: {},
      }
      set({ pins: [...get().pins, pin], selectedId: pin.id, newPinId: pin.id })
      return pin
    },
    select(id) {
      const s = get()
      if (id !== null && !s.pins.some((p) => p.id === id)) return
      if (s.selectedId === id) return
      set({ selectedId: id, newPinId: id !== null && id === s.newPinId ? id : null })
    },
    setHovered(id) {
      if (get().hoveredId === id) return
      set({ hoveredId: id })
    },
    rename(id, name) {
      const pins = get().pins
      const i = pins.findIndex((p) => p.id === id)
      if (i < 0 || pins[i].name === name) return
      const next = [...pins]
      next[i] = { ...pins[i], name }
      set({ pins: next })
    },
  }))
}
