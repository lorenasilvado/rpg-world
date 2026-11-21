import { DEFAULT_WORLD_PARAMS, type WorldParams } from '../core'
import type { World } from './types'
import type { WorldsRepo } from './worldsRepo'

/**
 * O mundo salvo por último, para reabrir ao recarregar (até a Lista de mundos existir). Se o banco
 * não abre (IndexedDB bloqueado, por exemplo), o app abre como se não houvesse mundo salvo; o
 * indicador mostra o erro na primeira gravação.
 */
export async function loadLastWorld(repo: Pick<WorldsRepo, 'latest'>): Promise<World | undefined> {
  try {
    return await repo.latest()
  } catch {
    return undefined
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
