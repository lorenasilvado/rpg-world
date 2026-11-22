import type { World } from '../persistence/types'
import { copyWorldRecord } from '../persistence/worldRecord'
import type { WorldsRepo } from '../persistence/worldsRepo'

/** Um repositório de mundos em memória, para os testes do jsdom (o mesmo contrato do Dexie). */
export function memoryRepo(initial: World[] = []): Pick<WorldsRepo, 'list' | 'save' | 'rename' | 'duplicate' | 'remove'> & { worlds: Map<string, World> } {
  const worlds = new Map(initial.map((w) => [w.id, structuredClone(w)]))
  return {
    worlds,
    async save(world) {
      worlds.set(world.id, structuredClone(world))
    },
    async rename(id, name, now) {
      const world = worlds.get(id)
      if (world) worlds.set(id, { ...world, name, updatedAt: now.toISOString() })
    },
    async duplicate(sourceId, { id, name, now, newId }) {
      const source = worlds.get(sourceId)
      if (!source) return undefined
      const { world } = copyWorldRecord(source, [], { id, name, now, newId })
      worlds.set(id, structuredClone(world))
      return world
    },
    async remove(id) {
      worlds.delete(id)
    },
    async list() {
      return [...worlds.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((w) => structuredClone(w))
    },
  }
}
