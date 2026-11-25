import { z } from 'zod'
import { DEFAULT_WORLD_PARAMS, GENERATOR_VERSION, type WorldParams } from '../core'
import { pinImageIds } from '../state/pinImages'
import { DEFAULT_SIZE_KM } from '../state/worldStore'
import type { StoredImage, World } from './types'
import { copyWorldRecord } from './worldRecord'

/**
 * O arquivo do mundo (.json), para exportar e importar (mundos.md → Regras, AC-F4-09, AC-F4-10):
 * o único backup do app só local (ADR 0003).
 *
 * O arquivo leva o envelope (`format` e `version`, do arquivo), o mundo como ele é salvo (seed,
 * parâmetros, `sizeKm`, `generatorVersion`, pins e estradas; o terreno é regerado) e as imagens
 * que os pins usam, embutidas em base64. Importar valida tudo pelo schema (zod) e devolve o mundo
 * com as imagens, ou o motivo da recusa.
 */

/** O `format` do arquivo: diz que o JSON é um mundo do RPG World Builder. */
export const WORLD_FILE_FORMAT = 'rpg-world-builder/world'

/** A versão do formato do arquivo: muda quando o app passa a gravar o arquivo de outro jeito. */
export const WORLD_FILE_VERSION = 1

/** Por que um arquivo foi recusado na importação. */
export type ImportRefusal =
  /** O arquivo não é JSON. */
  | 'not-json'
  /** É JSON, mas não é um mundo do RPG World Builder (ou está fora do formato). */
  | 'not-world'
  /** Falta a parte do terreno: a seed, os parâmetros ou a versão do gerador. */
  | 'no-terrain'
  /** O mundo é de uma versão do gerador (ou do arquivo) mais nova que a do app. */
  | 'newer-version'

/** Uma imagem do arquivo, já como blob (o `id` é o do arquivo, que os pins citam). */
export type ImportedImage = { id: string; blob: Blob }

export type ParsedWorldFile = { ok: true; world: World; images: ImportedImage[] } | { ok: false; reason: ImportRefusal }

const finite = z.number().finite()
/** Uma posição no mapa: 0..1 nos dois eixos (fora disso, o ponto cai fora do mapa). */
const unit = finite.min(0).max(1)
const point = z.object({ u: unit, v: unit })
/** Um parâmetro de geração: 0 a 100, como os sliders (o gerador recusa o resto). */
const param = finite.min(0).max(100)

const paramsSchema = z.object(
  Object.fromEntries(Object.keys(DEFAULT_WORLD_PARAMS).map((key) => [key, param])) as Record<keyof WorldParams, typeof param>,
)

const pinSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string(),
  pos: point,
  icon: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('builtin'), key: z.string() }),
    z.object({ kind: z.literal('image'), blobId: z.string().min(1) }),
  ]),
  description: z.string(),
  tags: z.array(z.string()),
  fields: z.record(z.string()),
  parentId: z.string().optional(),
})

const roadSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['road', 'trail', 'sea']),
  points: z.array(point),
  from: z.string().optional(),
  to: z.string().optional(),
})

const envelopeSchema = z.object({
  format: z.literal(WORLD_FILE_FORMAT),
  version: z.number().int().positive(),
  world: z.record(z.unknown()),
})

const terrainSchema = z.object({
  seed: z.string().min(1),
  params: paramsSchema,
  generatorVersion: z.number().int().positive(),
})

/** O resto do mundo: o que falta ganha o padrão (um arquivo editado à mão pode não ter tudo). */
const restSchema = z.object({
  name: z.string().default('Mundo importado'),
  sizeKm: finite.positive().default(DEFAULT_SIZE_KM),
  // Um id repetido faria dois pins virarem um só na seleção, na hierarquia e nas estradas.
  pins: z
    .array(pinSchema)
    .default([])
    .refine((pins) => new Set(pins.map((pin) => pin.id)).size === pins.length),
  roads: z.array(roadSchema).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

const imageSchema = z.object({ id: z.string().min(1), type: z.string(), data: z.string() })

/** O arquivo do mundo, como ele vai para o .json. */
export type WorldFile = {
  format: typeof WORLD_FILE_FORMAT
  version: number
  world: Omit<World, 'id'>
  images: { id: string; type: string; data: string }[]
}

/**
 * O arquivo do mundo: o mundo (sem o `id`, que é do banco deste navegador) e as imagens que os pins
 * usam, lidas por `getImage` (uma imagem que não existe mais fica de fora: o pin mostra o círculo
 * hachurado, como no app). Os parâmetros que faltem no mundo salvo vão com o padrão, como ele abre.
 */
export async function worldFile(world: World, getImage: (id: string) => Promise<Blob | undefined>): Promise<WorldFile> {
  const images: WorldFile['images'] = []
  for (const id of pinImageIds(world.pins)) {
    const blob = await getImage(id)
    if (blob) images.push({ id, type: blob.type, data: await toBase64(blob) })
  }
  const { id: _id, ...rest } = structuredClone(world)
  // Um mundo salvo antes de um parâmetro existir abre com o padrão dele: o arquivo leva todos.
  rest.params = { ...DEFAULT_WORLD_PARAMS, ...rest.params }
  return { format: WORLD_FILE_FORMAT, version: WORLD_FILE_VERSION, world: rest, images }
}

/** O texto do .json do mundo (indentado, para quem quiser ler ou editar à mão). */
export async function exportWorldJson(world: World, getImage: (id: string) => Promise<Blob | undefined>): Promise<string> {
  return JSON.stringify(await worldFile(world, getImage), null, 2)
}

/**
 * Lê o texto de um arquivo do mundo e o valida. O mundo devolvido tem o `id` vazio e as imagens
 * com os ids do arquivo: `importedWorldRecord` dá o id novo ao mundo e às imagens.
 */
export function parseWorldFile(text: string, generatorVersion = GENERATOR_VERSION): ParsedWorldFile {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'not-json' }
  }
  const envelope = envelopeSchema.safeParse(json)
  if (!envelope.success) return { ok: false, reason: 'not-world' }
  if (envelope.data.version > WORLD_FILE_VERSION) return { ok: false, reason: 'newer-version' }
  const raw = envelope.data.world
  if (typeof raw.generatorVersion === 'number' && raw.generatorVersion > generatorVersion) return { ok: false, reason: 'newer-version' }
  const terrain = terrainSchema.safeParse(raw)
  if (!terrain.success) return { ok: false, reason: 'no-terrain' }
  const rest = restSchema.safeParse(raw)
  const images = z.array(imageSchema).default([]).safeParse((json as { images?: unknown }).images)
  if (!rest.success || !images.success) return { ok: false, reason: 'not-world' }

  const decoded: ImportedImage[] = []
  for (const image of images.data) {
    const blob = fromBase64(image.data, image.type)
    if (!blob) return { ok: false, reason: 'not-world' }
    decoded.push({ id: image.id, blob })
  }
  const { name, sizeKm, pins, roads, createdAt, updatedAt } = rest.data
  const at = new Date(0).toISOString()
  const world: World = {
    id: '',
    name,
    seed: terrain.data.seed,
    generatorVersion: terrain.data.generatorVersion,
    sizeKm,
    params: terrain.data.params,
    pins,
    roads,
    createdAt: createdAt ?? at,
    updatedAt: updatedAt ?? at,
  }
  return { ok: true, world, images: decoded }
}

/**
 * O mundo importado, como ele é gravado: um mundo novo (`id`), com as duas datas em `now` (vai
 * para o topo da lista) e as imagens com ids novos (`newId`), como a cópia do Duplicar; assim,
 * importar o mesmo arquivo de novo, ou o de um mundo que ainda existe, não substitui nada. Um pin
 * cuja imagem não veio no arquivo também ganha um id novo, sem imagem (o círculo hachurado): o id
 * do arquivo poderia ser o de uma imagem de outro mundo deste navegador.
 */
export function importedWorldRecord(
  file: { world: World; images: readonly ImportedImage[] },
  { id, now, newId }: { id: string; now: Date; newId: () => string },
): { world: World; images: StoredImage[] } {
  const images = file.images.map((image) => ({ id: image.id, worldId: file.world.id, blob: image.blob }))
  const inFile = new Set(images.map((image) => image.id))
  /** O id novo de cada imagem que falta (o mesmo para os pins que dividem a imagem). */
  const missing = new Map<string, string>()
  const pins = file.world.pins.map((pin) => {
    if (pin.icon.kind !== 'image' || inFile.has(pin.icon.blobId)) return pin
    const blobId = missing.get(pin.icon.blobId) ?? newId()
    missing.set(pin.icon.blobId, blobId)
    return { ...pin, icon: { kind: 'image' as const, blobId } }
  })
  return copyWorldRecord({ ...file.world, pins }, images, { id, name: file.world.name, now, newId })
}

/** O nome do mundo num nome de arquivo: sem acento, em minúsculas e com hífens ("mundo" se não sobra nada). */
export function fileSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'mundo'
}

/** O nome do arquivo exportado: o nome do mundo, sem acento, em minúsculas e com hífens. */
export function worldFileName(name: string): string {
  return `${fileSlug(name)}.json`
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(binary)
}

function fromBase64(data: string, type: string): Blob | null {
  let binary: string
  try {
    binary = atob(data)
  } catch {
    return null
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}
