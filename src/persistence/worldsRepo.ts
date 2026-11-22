import type { RpgWorldDb } from './db'
import type { StoredImage, World } from './types'

/** O que o app usa do banco: salvar e ler mundos e imagens (`createWorldsRepo`, ou um falso). */
export type WorldsRepo = {
  /** Grava o mundo inteiro (cria ou substitui pelo `id`). */
  save(world: World): Promise<void>
  get(id: string): Promise<World | undefined>
  /** O mundo salvo por último (o maior `updatedAt`), ou `undefined` sem mundos. */
  latest(): Promise<World | undefined>
  saveImage(image: StoredImage): Promise<void>
  getImage(id: string): Promise<StoredImage | undefined>
}

export function createWorldsRepo(db: RpgWorldDb): WorldsRepo {
  return {
    async save(world) {
      await db.worlds.put(world)
    },
    get(id) {
      return db.worlds.get(id)
    },
    latest() {
      return db.worlds.orderBy('updatedAt').last()
    },
    async saveImage(image) {
      await db.images.put(image)
    },
    getImage(id) {
      return db.images.get(id)
    },
  }
}
