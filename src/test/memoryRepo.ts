import type { StoredImage, World } from '../persistence/types'
import { copyWorldRecord } from '../persistence/worldRecord'
import type { WorldsRepo } from '../persistence/worldsRepo'

/** Um repositório de mundos em memória, para os testes do jsdom (o mesmo contrato do Dexie). */
export function memoryRepo(
  initial: World[] = [],
): Pick<WorldsRepo, 'list' | 'save' | 'rename' | 'duplicate' | 'remove' | 'importWorld' | 'saveImage' | 'getImage' | 'pruneImages'> & { worlds: Map<string, World>; images: Map<string, StoredImage> } {
  const worlds = new Map(initial.map((w) => [w.id, structuredClone(w)]))
  const images = new Map<string, StoredImage>()
  return {
    worlds,
    images,
    async saveImage(image) {
      images.set(image.id, image)
    },
    async getImage(id) {
      return images.get(id)
    },
    async pruneImages(worldId, keep) {
      let n = 0
      for (const [id, image] of images) {
        if (image.worldId !== worldId || keep(id)) continue
        images.delete(id)
        n++
      }
      return n
    },
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
    async importWorld(world, list) {
      for (const image of list) images.set(image.id, image)
      worlds.set(world.id, structuredClone(world))
    },
    async list() {
      return [...worlds.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((w) => structuredClone(w))
    },
  }
}
