import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Pin } from '../persistence/types'
import { canBeParent, validParents, withoutParent } from './pinHierarchy'
import { uniqueTags } from './pinTags'
import { DEFAULT_PIN_TYPE, NEW_PIN_NAME, pinType, type PinType } from './pinTypes'

/**
 * Os pins do mundo aberto (pins.md, AC-F3-01 a AC-F3-03): a lista que o mundo salva (`pins`) e o
 * estado da interface sobre eles, que não é salvo: o pin selecionado (com o drawer aberto), o pin
 * sob o mouse e o pin recém-criado (`newPinId`: ele quica ao aparecer, e o drawer abre com o nome
 * em edição). É um store "vanilla" do Zustand, como o `worldStore`: o renderer lê os pins e a
 * seleção, e o salvamento automático grava a lista quando ela muda. O arrasto (`dragging`) e a
 * exclusão (AC-F3-04, AC-F3-05) também ficam aqui; o desfazer é do histórico do mundo (`history.ts`).
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
   * O pin sendo arrastado e a posição dele sob o ponteiro (`null`: nenhum). A lista só muda ao
   * soltar (`endDrag`), numa mudança só: o histórico guarda o arrasto como um passo.
   */
  dragging: { id: string; pos: { u: number; v: number } } | null
  /**
   * Sobe a cada vez que a edição de um texto do pin (o nome ou a descrição) termina (o campo perde
   * o foco): o histórico começa um passo novo na próxima tecla, mesmo que seja no mesmo pin.
   */
  textEditEnds: number
  /**
   * Cria um pin na posição (u, v), do último tipo usado no mundo (Cidade no primeiro), com o nome
   * "Novo pin", e o seleciona.
   */
  addPin(pos: { u: number; v: number }): Pin
  /** Seleciona o pin (abre o drawer) ou, com `null`, fecha. */
  select(id: string | null): void
  setHovered(id: string | null): void
  rename(id: string, name: string): void
  /**
   * Troca a ficha do pin: a descrição e as tags (AC-F3-07, AC-F3-08), o tipo, o ícone e os campos
   * livres (a aba Detalhes, AC-F3-10).
   */
  updatePin(id: string, patch: PinPatch): void
  /**
   * Troca o pai do pin (AC-F3-12; `null`: sem pai). Um pai que não pode (o próprio pin, um
   * descendente dele ou um pin que não existe) não entra.
   */
  setParent(id: string, parentId: string | null): void
  /** A edição de um texto do pin (nome ou descrição) terminou (o campo perdeu o foco). */
  endTextEdit(): void
  /**
   * Duplica o pin (AC-F3-09): a cópia, "<nome> (cópia)", fica deslocada por `offset` (em u e v,
   * presa no mapa), com a mesma ficha (tipo, ícone, descrição, tags, campos e o mesmo pai) e sem os
   * filhos, e fica selecionada. Devolve a cópia, ou `null` se o pin não existe.
   */
  duplicatePin(id: string, offset: { u: number; v: number }): Pin | null
  /** Arrasta o pin até (u, v), presa entre 0 e 1 (AC-F3-04). */
  dragTo(id: string, pos: { u: number; v: number }): void
  /** Solta o pin arrastado: com `commit`, ele fica na posição do arrasto; sem, volta. */
  endDrag(commit: boolean): void
  /**
   * Exclui o pin (AC-F3-05); os filhos dele ficam sem pai, na mesma mudança (o Desfazer devolve o
   * pin e os vínculos, AC-F3-12). Devolve o pin excluído, ou `null` se ele não existe.
   */
  removePin(id: string): Pin | null
  /**
   * Troca a lista inteira (o desfazer e o refazer do histórico): a seleção, o hover, o pin novo e o
   * arrasto de um pin que saiu da lista são desfeitos.
   */
  replacePins(pins: readonly Pin[]): void
}

export type PinsStore = StoreApi<PinsState>

/** O que o drawer edita na ficha do pin, além do nome. */
export type PinPatch = Partial<Pick<Pin, 'description' | 'tags' | 'type' | 'icon' | 'fields'>>

function sameIcon(a: Pin['icon'], b: Pin['icon']): boolean {
  return a.kind === 'builtin' ? b.kind === 'builtin' && a.key === b.key : b.kind === 'image' && a.blobId === b.blobId
}

/** Os mesmos campos, na mesma ordem. */
function sameFields(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k])
}

/** O fim do nome de uma cópia: " (cópia)" ou " (cópia N)". */
const COPY_SUFFIX = / \(cópia(?: (\d+))?\)$/

/**
 * O nome da cópia (AC-F3-09): "<nome> (cópia)"; a cópia de uma cópia conta: "(cópia 2)",
 * "(cópia 3)"… Cortado para caber nos 80 caracteres do nome.
 */
export function copyName(name: string, max = 80): string {
  const match = COPY_SUFFIX.exec(name)
  const base = match ? name.slice(0, match.index) : name
  const n = match ? (match[1] ? Number(match[1]) : 1) + 1 : 1
  const suffix = n === 1 ? ' (cópia)' : ` (cópia ${n})`
  return base.slice(0, max - suffix.length).trimEnd() + suffix
}

/** O pin sem tags repetidas (`uniqueTags`); sem repetidas, o mesmo objeto. */
function withUniqueTags(pin: Pin): Pin {
  const tags = uniqueTags(pin.tags)
  return tags === pin.tags ? pin : { ...pin, tags: [...tags] }
}

/** O tipo de um pin novo: o do último pin do mundo, ou Cidade no primeiro. */
export function nextPinType(pins: readonly Pin[]): PinType {
  const last = pins.at(-1)
  return last ? pinType(last.type) : DEFAULT_PIN_TYPE
}

/** A posição presa no mapa: u e v de 0 a 1 (RNF-9). */
export function clampPos(pos: { u: number; v: number }): { u: number; v: number } {
  const clamp = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5)
  return { u: clamp(pos.u), v: clamp(pos.v) }
}

export function createPinsStore(initial: readonly Pin[] = [], { newId = () => crypto.randomUUID() }: { newId?: () => string } = {}): PinsStore {
  return createStore<PinsState>()((set, get) => ({
    // Um mundo salvo ou importado pode trazer tags repetidas e pais que não valem (um pai que não
    // existe ou um ciclo): eles saem ao carregar.
    pins: [...validParents(initial.map(withUniqueTags))],
    selectedId: null,
    hoveredId: null,
    newPinId: null,
    dragging: null,
    textEditEnds: 0,
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
    updatePin(id, edit) {
      const pins = get().pins
      const i = pins.findIndex((p) => p.id === id)
      if (i < 0) return
      const pin = pins[i]
      // Uma tag repetida (sem diferenciar maiúsculas) não entra.
      const patch: PinPatch = edit.tags ? { ...edit, tags: [...uniqueTags(edit.tags)] } : edit
      const same =
        (patch.description === undefined || patch.description === pin.description) &&
        (patch.tags === undefined || (patch.tags.length === pin.tags.length && patch.tags.every((t, k) => t === pin.tags[k]))) &&
        (patch.type === undefined || patch.type === pin.type) &&
        (patch.icon === undefined || sameIcon(patch.icon, pin.icon)) &&
        (patch.fields === undefined || sameFields(patch.fields, pin.fields))
      if (same) return
      const next = [...pins]
      next[i] = {
        ...pin,
        ...patch,
        ...(patch.tags ? { tags: [...patch.tags] } : {}),
        ...(patch.icon ? { icon: { ...patch.icon } } : {}),
        ...(patch.fields ? { fields: { ...patch.fields } } : {}),
      }
      set({ pins: next })
    },
    setParent(id, parentId) {
      const pins = get().pins
      const i = pins.findIndex((p) => p.id === id)
      if (i < 0 || (pins[i].parentId ?? null) === parentId || !canBeParent(pins, id, parentId)) return
      const next = [...pins]
      next[i] = parentId === null ? withoutParent(pins[i]) : { ...pins[i], parentId }
      set({ pins: next })
    },
    endTextEdit() {
      set({ textEditEnds: get().textEditEnds + 1 })
    },
    duplicatePin(id, offset) {
      const pin = get().pins.find((p) => p.id === id)
      if (!pin) return null
      const copy: Pin = {
        ...pin,
        id: newId(),
        name: copyName(pin.name),
        pos: clampPos({ u: pin.pos.u + offset.u, v: pin.pos.v + offset.v }),
        icon: { ...pin.icon },
        tags: [...pin.tags],
        fields: { ...pin.fields },
      }
      set({ pins: [...get().pins, copy], selectedId: copy.id, newPinId: null })
      return copy
    },
    dragTo(id, pos) {
      if (!get().pins.some((p) => p.id === id)) return
      set({ dragging: { id, pos: clampPos(pos) }, hoveredId: null })
    },
    endDrag(commit) {
      const { dragging, pins } = get()
      if (!dragging) return
      const i = pins.findIndex((p) => p.id === dragging.id)
      const moved = commit && i >= 0 && (pins[i].pos.u !== dragging.pos.u || pins[i].pos.v !== dragging.pos.v)
      if (!moved) {
        set({ dragging: null })
        return
      }
      const next = [...pins]
      next[i] = { ...pins[i], pos: { ...dragging.pos } }
      set({ pins: next, dragging: null })
    },
    removePin(id) {
      const pin = get().pins.find((p) => p.id === id)
      if (!pin) return null
      get().replacePins(get().pins.filter((p) => p.id !== id).map((p) => (p.parentId === id ? withoutParent(p) : p)))
      return pin
    },
    replacePins(list) {
      const s = get()
      const ids = new Set(list.map((p) => p.id))
      const keep = (id: string | null) => (id !== null && ids.has(id) ? id : null)
      set({
        pins: list as Pin[],
        selectedId: keep(s.selectedId),
        hoveredId: keep(s.hoveredId),
        newPinId: keep(s.newPinId),
        dragging: s.dragging && ids.has(s.dragging.id) ? s.dragging : null,
      })
    },
  }))
}
