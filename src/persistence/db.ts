import { Dexie, type EntityTable } from 'dexie'
import type { StoredImage, World } from './types'

/**
 * O banco do app no IndexedDB (ADR 0001, ADR 0003): os mundos e as imagens enviadas (blobs). Os
 * mundos são indexados por `updatedAt`, para achar o último salvo; as imagens, pelo mundo dono.
 */
export type RpgWorldDb = Dexie & {
  worlds: EntityTable<World, 'id'>
  images: EntityTable<StoredImage, 'id'>
}

export const DB_NAME = 'rpg-world'

export function openDb(name = DB_NAME): RpgWorldDb {
  const db = new Dexie(name) as RpgWorldDb
  db.version(1).stores({
    worlds: 'id, updatedAt',
    images: 'id, worldId',
  })
  return db
}
