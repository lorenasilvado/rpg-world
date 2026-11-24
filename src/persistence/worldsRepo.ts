import type { RpgWorldDb } from './db'
import type { StoredImage, World } from './types'
import { copyWorldRecord } from './worldRecord'

/** O que o app usa do banco: salvar e ler mundos e imagens (`createWorldsRepo`, ou um falso). */
export type WorldsRepo = {
  /** Grava o mundo inteiro (cria ou substitui pelo `id`). */
  save(world: World): Promise<void>
  get(id: string): Promise<World | undefined>
  /** O mundo salvo por último (o maior `updatedAt`), ou `undefined` sem mundos. */
  latest(): Promise<World | undefined>
  /** Todos os mundos, do editado por último ao mais antigo (a Lista de mundos). */
  list(): Promise<World[]>
  /** Troca o nome do mundo e grava (o `updatedAt` vira `now`); sem o mundo, não faz nada. */
  rename(id: string, name: string, now: Date): Promise<void>
  /**
   * Grava uma cópia do mundo, com os pins, as estradas e as imagens dele (cada imagem ganha um id
   * novo de `newId`), com o id `id` e o nome `name`; devolve a cópia (`undefined` sem o mundo).
   */
  duplicate(sourceId: string, copy: { id: string; name: string; now: Date; newId: () => string }): Promise<World | undefined>
  /** Exclui o mundo e as imagens dele, de vez. */
  remove(id: string): Promise<void>
  saveImage(image: StoredImage): Promise<void>
  getImage(id: string): Promise<StoredImage | undefined>
  /**
   * Apaga as imagens do mundo que `keep` não guarda (as que nenhum pin usa mais: trocadas,
   * removidas ou de um pin excluído); devolve quantas apagou.
   */
  pruneImages(worldId: string, keep: (id: string) => boolean): Promise<number>
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
    list() {
      return db.worlds.orderBy('updatedAt').reverse().toArray()
    },
    async rename(id, name, now) {
      await db.worlds.update(id, { name, updatedAt: now.toISOString() })
    },
    duplicate(sourceId, { id, name, now, newId }) {
      return db.transaction('rw', db.worlds, db.images, async () => {
        const source = await db.worlds.get(sourceId)
        if (!source) return undefined
        const images = await db.images.where('worldId').equals(sourceId).toArray()
        const copy = copyWorldRecord(source, images, { id, name, now, newId })
        await db.images.bulkPut(copy.images)
        await db.worlds.put(copy.world)
        return copy.world
      })
    },
    async remove(id) {
      await db.transaction('rw', db.worlds, db.images, async () => {
        await db.images.where('worldId').equals(id).delete()
        await db.worlds.delete(id)
      })
    },
    async saveImage(image) {
      await db.images.put(image)
    },
    getImage(id) {
      return db.images.get(id)
    },
    pruneImages(worldId, keep) {
      return db.images
        .where('worldId')
        .equals(worldId)
        .filter((image) => !keep(image.id))
        .delete()
    },
  }
}
