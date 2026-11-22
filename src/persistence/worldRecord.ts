import { DEFAULT_WORLD_PARAMS, GENERATOR_VERSION, type WorldParams } from '../core'
import { DEFAULT_SIZE_KM } from '../state/worldStore'
import type { World } from './types'
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
