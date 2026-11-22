import type { World } from '../persistence/types'
import type { WorldsRepo } from '../persistence/worldsRepo'

/** Um repositório de mundos em memória, para os testes do jsdom (o mesmo contrato do Dexie). */
export function memoryRepo(initial: World[] = []): Pick<WorldsRepo, 'list' | 'save'> & { worlds: Map<string, World> } {
  const worlds = new Map(initial.map((w) => [w.id, structuredClone(w)]))
  return {
    worlds,
    async save(world) {
      worlds.set(world.id, structuredClone(world))
    },
    async list() {
      return [...worlds.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((w) => structuredClone(w))
    },
  }
}
