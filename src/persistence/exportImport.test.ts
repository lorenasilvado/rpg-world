// @vitest-environment node
// O Blob do jsdom não passa pelo structuredClone do fake-indexeddb; o do Node passa, como o do navegador.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_PARAMS, GENERATOR_VERSION } from '../core'
import { openDb, type RpgWorldDb } from './db'
import {
  WORLD_FILE_FORMAT,
  WORLD_FILE_VERSION,
  exportWorldJson,
  importedWorldRecord,
  parseWorldFile,
  worldFileName,
  type ImportRefusal,
} from './exportImport'
import type { Pin, World } from './types'
import { createWorldsRepo } from './worldsRepo'

let count = 0
const dbs: RpgWorldDb[] = []
function freshRepo() {
  const db = openDb(`rpg-world-export-${++count}`)
  dbs.push(db)
  return createWorldsRepo(db)
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete()
})

const pin = (over: Partial<Pin>): Pin => ({
  id: 'p',
  type: 'city',
  name: 'Vila',
  pos: { u: 0.25, v: 0.75 },
  icon: { kind: 'builtin', key: 'castle' },
  description: '<p>Uma <strong>vila</strong></p>',
  tags: ['porto', 'norte'],
  fields: { Governante: 'Rainha Ilsa' },
  ...over,
})

const VALDORA: World = {
  id: 'valdora',
  name: 'Terras de Valdora',
  seed: 'valdora-7f3a',
  generatorVersion: GENERATOR_VERSION,
  sizeKm: 1200,
  params: { ...DEFAULT_WORLD_PARAMS, ocean: 61, coastRoughness: 30 },
  pins: [
    pin({ id: 'capital' }),
    pin({ id: 'torre', name: 'Torre', type: 'custom', icon: { kind: 'image', blobId: 'img-1' }, parentId: 'capital' }),
  ],
  roads: [{ id: 'r1', kind: 'road', points: [{ u: 0.1, v: 0.2 }, { u: 0.3, v: 0.4 }], from: 'capital', to: 'torre' }],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z',
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 128, 7, 42])

async function exportValdora() {
  const repo = freshRepo()
  await repo.save(VALDORA)
  await repo.saveImage({ id: 'img-1', worldId: VALDORA.id, blob: new Blob([PNG], { type: 'image/png' }) })
  // Uma imagem que nenhum pin usa não vai para o arquivo.
  await repo.saveImage({ id: 'solta', worldId: VALDORA.id, blob: new Blob([PNG], { type: 'image/png' }) })
  return exportWorldJson(VALDORA, async (id) => (await repo.getImage(id))?.blob)
}

const raw = (over: Record<string, unknown> = {}, worldOver: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: WORLD_FILE_FORMAT,
    version: WORLD_FILE_VERSION,
    world: { name: 'Mundo', seed: 's', generatorVersion: GENERATOR_VERSION, params: DEFAULT_WORLD_PARAMS, ...worldOver },
    ...over,
  })

describe('exportar e importar o mundo (AC-F4-09)', () => {
  it('o arquivo tem o envelope, o mundo sem o id e só as imagens que os pins usam', async () => {
    const file = JSON.parse(await exportValdora())
    expect(file.format).toBe(WORLD_FILE_FORMAT)
    expect(file.version).toBe(WORLD_FILE_VERSION)
    expect(file.world.id).toBeUndefined()
    expect(file.world.seed).toBe('valdora-7f3a')
    expect(file.images.map((i: { id: string }) => i.id)).toEqual(['img-1'])
    expect(file.images[0].type).toBe('image/png')
  })

  it('exportar → importar dá o mesmo mundo (terreno, pins, fichas, estradas e imagens), com id novo', async () => {
    const parsed = parseWorldFile(await exportValdora())
    if (!parsed.ok) throw new Error(parsed.reason)
    const ids = ['img-novo']
    const now = new Date('2026-11-25T12:00:00.000Z')
    const { world, images } = importedWorldRecord(parsed, { id: 'importado', now, newId: () => ids.shift()! })

    const target = freshRepo()
    await target.importWorld(world, images)
    const saved = (await target.get('importado'))!
    expect(saved).toEqual({
      ...VALDORA,
      id: 'importado',
      pins: [VALDORA.pins[0], { ...VALDORA.pins[1], icon: { kind: 'image', blobId: 'img-novo' } }],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    const image = (await target.getImage('img-novo'))!
    expect(image.worldId).toBe('importado')
    expect(image.blob.type).toBe('image/png')
    expect(new Uint8Array(await image.blob.arrayBuffer())).toEqual(PNG)
  })

  it('o arquivo exportado de novo é igual ao primeiro (fora as datas)', async () => {
    const first = await exportValdora()
    const parsed = parseWorldFile(first)
    if (!parsed.ok) throw new Error(parsed.reason)
    const again = await exportWorldJson({ ...parsed.world, id: 'x' }, async (id) => parsed.images.find((i) => i.id === id)?.blob)
    expect(JSON.parse(again)).toEqual(JSON.parse(first))
  })

  it('um mundo salvo sem algum parâmetro vai com o padrão dele, como abre no app', async () => {
    const partial = { ...VALDORA, params: { ocean: 70 } as World['params'] }
    const parsed = parseWorldFile(await exportWorldJson(partial, async () => undefined))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(parsed.world.params).toEqual({ ...DEFAULT_WORLD_PARAMS, ocean: 70 })
  })

  it('um arquivo editado à mão sem nome, pins nem estradas ganha os padrões', () => {
    const parsed = parseWorldFile(raw({}, { name: undefined, sizeKm: undefined }))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(parsed.world).toMatchObject({ name: 'Mundo importado', sizeKm: 800, pins: [], roads: [] })
    expect(parsed.images).toEqual([])
  })

  it('o nome do arquivo vem do nome do mundo', () => {
    expect(worldFileName('Terras de Valdora')).toBe('terras-de-valdora.json')
    expect(worldFileName('Ilhas do Corvo (cópia)')).toBe('ilhas-do-corvo-copia.json')
    expect(worldFileName('Ébano & Âmbar!')).toBe('ebano-ambar.json')
    expect(worldFileName('🐉')).toBe('mundo.json')
  })
})

describe('arquivos recusados (AC-F4-10)', () => {
  const cases: [string, string, ImportRefusal][] = [
    ['não é JSON', 'isto não é json', 'not-json'],
    ['JSON vazio', '', 'not-json'],
    ['JSON que não é objeto', '[1, 2]', 'not-world'],
    ['JSON de outro app', JSON.stringify({ seed: 's', params: DEFAULT_WORLD_PARAMS }), 'not-world'],
    ['sem o mundo', JSON.stringify({ format: WORLD_FILE_FORMAT, version: 1 }), 'not-world'],
    ['sem a seed', raw({}, { seed: undefined }), 'no-terrain'],
    ['seed vazia', raw({}, { seed: '' }), 'no-terrain'],
    ['sem os parâmetros', raw({}, { params: undefined }), 'no-terrain'],
    ['parâmetro faltando', raw({}, { params: { ...DEFAULT_WORLD_PARAMS, ocean: undefined } }), 'no-terrain'],
    ['parâmetro que não é número', raw({}, { params: { ...DEFAULT_WORLD_PARAMS, ocean: '60' } }), 'no-terrain'],
    ['sem a versão do gerador', raw({}, { generatorVersion: undefined }), 'no-terrain'],
    ['gerador mais novo', raw({}, { generatorVersion: GENERATOR_VERSION + 1 }), 'newer-version'],
    ['arquivo de formato mais novo', raw({ version: WORLD_FILE_VERSION + 1 }), 'newer-version'],
    ['pin fora do formato', raw({}, { pins: [{ id: 'p', name: 'x' }] }), 'not-world'],
    ['estrada de tipo desconhecido', raw({}, { roads: [{ id: 'r', kind: 'rio', points: [] }] }), 'not-world'],
    ['imagem fora do base64', raw({ images: [{ id: 'i', type: 'image/png', data: '%%%' }] }), 'not-world'],
  ]
  it.each(cases)('%s', (_name, text, reason) => {
    expect(parseWorldFile(text)).toEqual({ ok: false, reason })
  })

  it('um mundo de um gerador mais velho é aceito', () => {
    expect(parseWorldFile(raw({}, { generatorVersion: 1 })).ok).toBe(true)
  })
})
