import type { Pin } from '../persistence/types'

/**
 * A hierarquia dos pins (pins.md → Regras, AC-F3-12 e AC-F3-13): um pin pode pertencer a outro pelo
 * `parentId`, sem limite de níveis e sem ciclo. As funções aqui não mudam a lista; o `pinsStore`
 * as usa para trocar o pai, excluir um pin e carregar o mundo.
 */

/** Os filhos do pin (os que o têm como pai), na ordem da lista. */
export function childrenOf(pins: readonly Pin[], id: string): Pin[] {
  return pins.filter((p) => p.parentId === id)
}

/** O pin e todos os descendentes dele (filhos, netos…), como ids. */
function withDescendants(pins: readonly Pin[], id: string): Set<string> {
  const out = new Set([id])
  // Cada passo acha os filhos dos pins já achados; o conjunto evita voltar num ciclo.
  for (let grew = true; grew; ) {
    grew = false
    for (const p of pins) {
      if (p.parentId !== undefined && out.has(p.parentId) && !out.has(p.id)) {
        out.add(p.id)
        grew = true
      }
    }
  }
  return out
}

/** Os pins que podem ser o pai do pin: todos, menos ele e os descendentes dele (sem ciclo). */
export function parentOptions(pins: readonly Pin[], id: string): Pin[] {
  const blocked = withDescendants(pins, id)
  return pins.filter((p) => !blocked.has(p.id))
}

/** `parentId` pode ser o pai do pin `id` (`null`, sem pai, sempre pode). */
export function canBeParent(pins: readonly Pin[], id: string, parentId: string | null): boolean {
  if (parentId === null) return true
  return pins.some((p) => p.id === parentId) && !withDescendants(pins, id).has(parentId)
}

/** O pin sem o `parentId` (o campo sai do objeto, como num pin que nunca teve pai). */
export function withoutParent(pin: Pin): Pin {
  const { parentId: _, ...rest } = pin
  return rest
}

/**
 * A lista sem pais que não valem, como um mundo salvo ou importado pode trazer: um pai que não
 * existe, o próprio pin, ou um ciclo (o pin que fecha o ciclo, na ordem da lista, fica sem pai).
 * Sem nada a corrigir, a mesma lista (a mesma referência).
 */
export function validParents(pins: readonly Pin[]): readonly Pin[] {
  const byId = new Map(pins.map((p) => [p.id, p]))
  /** O pai de cada pin, já sem os que saíram. */
  const parent = new Map<string, string | undefined>(pins.map((p) => [p.id, p.parentId]))
  let changed = false
  for (const p of pins) {
    const start = parent.get(p.id)
    if (start === undefined) continue
    let ok = byId.has(start)
    // Sobe pelos pais: voltar ao próprio pin é um ciclo. Um ciclo acima dele, que não passa por
    // ele, é desfeito quando chega a vez de um pin desse ciclo.
    const seen = new Set<string>()
    for (let cur: string | undefined = start; ok && cur !== undefined && !seen.has(cur); cur = parent.get(cur)) {
      if (cur === p.id) ok = false
      seen.add(cur)
    }
    if (!ok) {
      parent.set(p.id, undefined)
      changed = true
    }
  }
  if (!changed) return pins
  return pins.map((p) => (p.parentId !== undefined && parent.get(p.id) === undefined ? withoutParent(p) : p))
}
