// @vitest-environment node
// O Blob do jsdom não passa pelo structuredClone do fake-indexeddb; o do Node passa, como o do navegador.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_PARAMS, GENERATOR_VERSION } from '../core'
import { openDb, type RpgWorldDb } from './db'
import { loadWorlds, newWorldRecord, worldStoreInitial } from './worldRecord'
import type { World } from './types'
import { createWorldsRepo } from './worldsRepo'

let count = 0
const dbs: RpgWorldDb[] = []
function freshDb() {
  const db = openDb(`rpg-world-test-${++count}`)
  dbs.push(db)
  return db
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete()
})

function world(over: Partial<World> = {}): World {
  return {
    id: 'w1',
    name: 'Terras de Valdora',
    seed: 'valdora-7f3a',
    generatorVersion: GENERATOR_VERSION,
    sizeKm: 800,
    params: { ...DEFAULT_WORLD_PARAMS, ocean: 60 },
    pins: [],
    roads: [],
    createdAt: '2026-11-21T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    ...over,
  }
}

describe('worldsRepo (IndexedDB, AC-F4-01)', () => {
  it('grava e lê o mundo igual', async () => {
    const repo = createWorldsRepo(freshDb())
    const w = world({
      pins: [
        {
          id: 'p1',
          type: 'Cidade',
          name: 'Valdora',
          pos: { u: 0.4, v: 0.6 },
          icon: { kind: 'builtin', key: 'castle' },
          description: '<p>Capital</p>',
          tags: ['capital'],
          fields: { Governante: 'Rainha' },
        },
      ],
    })
    await repo.save(w)
    expect(await repo.get('w1')).toEqual(w)
  })

  it('substitui o mundo pelo id', async () => {
    const repo = createWorldsRepo(freshDb())
    await repo.save(world())
    await repo.save(world({ name: 'Brumas', updatedAt: '2026-11-21T11:00:00.000Z' }))
    expect((await repo.get('w1'))?.name).toBe('Brumas')
  })

  it('latest devolve o salvo por último, e nada sem mundos', async () => {
    const repo = createWorldsRepo(freshDb())
    expect(await repo.latest()).toBeUndefined()
    await repo.save(world({ id: 'a', updatedAt: '2026-11-21T12:00:00.000Z' }))
    await repo.save(world({ id: 'b', updatedAt: '2026-11-21T13:00:00.000Z' }))
    await repo.save(world({ id: 'c', updatedAt: '2026-11-21T11:00:00.000Z' }))
    expect((await repo.latest())?.id).toBe('b')
  })

  it('list devolve todos, do editado por último ao mais antigo (AC-F4-04)', async () => {
    const repo = createWorldsRepo(freshDb())
    expect(await repo.list()).toEqual([])
    await repo.save(world({ id: 'a', updatedAt: '2026-11-21T12:00:00.000Z' }))
    await repo.save(world({ id: 'b', updatedAt: '2026-11-21T13:00:00.000Z' }))
    await repo.save(world({ id: 'c', updatedAt: '2026-11-21T11:00:00.000Z' }))
    expect((await repo.list()).map((w) => w.id)).toEqual(['b', 'a', 'c'])
  })

  it('guarda as imagens como blobs (AC-F4-03)', async () => {
    const repo = createWorldsRepo(freshDb())
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    await repo.saveImage({ id: 'img1', worldId: 'w1', blob })
    const stored = await repo.getImage('img1')
    expect(stored?.worldId).toBe('w1')
    expect(stored?.blob).toBeInstanceOf(Blob)
    expect(stored?.blob.type).toBe('image/png')
    expect(new Uint8Array(await stored!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })
})

describe('loadWorlds, worldStoreInitial e newWorldRecord', () => {
  it('devolve os mundos, ou a lista vazia se o banco falha', async () => {
    const repo = createWorldsRepo(freshDb())
    await repo.save(world())
    expect((await loadWorlds(repo)).map((w) => w.id)).toEqual(['w1'])
    expect(await loadWorlds({ list: () => Promise.reject(new Error('bloqueado')) })).toEqual([])
  })

  it('o mundo novo nasce sem pins nem estradas, na largura padrão, com as duas datas iguais', () => {
    const params = { ...DEFAULT_WORLD_PARAMS, desert: 40 }
    expect(newWorldRecord({ id: 'n', name: 'Brumas', seed: 'b', params }, new Date('2026-11-21T10:00:00.000Z'))).toEqual(
      world({ id: 'n', name: 'Brumas', seed: 'b', params }),
    )
  })

  it('completa os parâmetros que faltam com os padrão', () => {
    const w = world({ params: { ocean: 70 } as World['params'] })
    expect(worldStoreInitial(w)).toEqual({
      id: 'w1',
      createdAt: '2026-11-21T10:00:00.000Z',
      name: 'Terras de Valdora',
      sizeKm: 800,
      seed: 'valdora-7f3a',
      params: { ...DEFAULT_WORLD_PARAMS, ocean: 70 },
    })
  })
})
