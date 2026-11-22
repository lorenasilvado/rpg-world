import { DEFAULT_WORLD_PARAMS, GENERATOR_VERSION, type WorldParams } from '../core'
import { DEFAULT_SIZE_KM } from '../state/worldStore'
import type { StoredImage, World } from './types'
import type { WorldsRepo } from './worldsRepo'

/**
 * Os mundos salvos, para a Lista de mundos. Se o banco não abre (IndexedDB bloqueado, por exemplo),
 * a lista fica vazia, como no primeiro acesso; o indicador do editor mostra o erro na primeira
 * gravação.
 */
export async function loadWorlds(repo: Pick<WorldsRepo, 'list'>): Promise<World[]> {
  try {
    return await repo.list()
  } catch {
    return []
  }
}

/** Os dados iniciais do `worldStore` a partir do mundo salvo (parâmetros que faltem: os padrão). */
export function worldStoreInitial(world: World): {
  id: string
  createdAt: string
  name: string
  sizeKm: number
  seed: string
  params: WorldParams
} {
  return {
    id: world.id,
    createdAt: world.createdAt,
    name: world.name,
    sizeKm: world.sizeKm,
    seed: world.seed,
    params: { ...DEFAULT_WORLD_PARAMS, ...world.params },
  }
}

/** O mundo novo do assistente, como ele é salvo: sem pins nem estradas, na largura padrão. */
export function newWorldRecord(
  { id, name, seed, params }: { id: string; name: string; seed: string; params: Readonly<WorldParams> },
  now: Date,
): World {
  const at = now.toISOString()
  return {
    id,
    name,
    seed,
    generatorVersion: GENERATOR_VERSION,
    sizeKm: DEFAULT_SIZE_KM,
    params: { ...params },
    pins: [],
    roads: [],
    createdAt: at,
    updatedAt: at,
  }
}

/** O nome da cópia de um mundo (Duplicar, na Lista de mundos). */
export function copyName(name: string): string {
  return `${name} (cópia)`
}

/**
 * A cópia de um mundo (Duplicar): os mesmos seed, parâmetros, pins e estradas, com o id e o nome
 * novos e as duas datas em `now`. As imagens do mundo ganham ids novos (`newId`) e a cópia como
 * dona, e os pins da cópia apontam para elas.
 */
export function copyWorldRecord(
  world: World,
  images: readonly StoredImage[],
  { id, name, now, newId }: { id: string; name: string; now: Date; newId: () => string },
): { world: World; images: StoredImage[] } {
  const imageIds = new Map(images.map((image) => [image.id, newId()]))
  const at = now.toISOString()
  const copy: World = {
    ...structuredClone(world),
    id,
    name,
    createdAt: at,
    updatedAt: at,
  }
  copy.pins = copy.pins.map((pin) =>
    pin.icon.kind === 'image' && imageIds.has(pin.icon.blobId) ? { ...pin, icon: { kind: 'image', blobId: imageIds.get(pin.icon.blobId)! } } : pin,
  )
  return {
    world: copy,
    images: images.map((image) => ({ id: imageIds.get(image.id)!, worldId: id, blob: image.blob })),
  }
}
