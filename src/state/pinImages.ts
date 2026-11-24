import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Pin } from '../persistence/types'
import type { WorldsRepo } from '../persistence/worldsRepo'

/**
 * As imagens enviadas do mundo aberto (pins.md → Tipos de pin, AC-F3-11): o ícone de um pin
 * Personalizado pode ser uma imagem, guardada como blob no banco (`images`, fora do mundo), e o pin
 * guarda só o id dela (`icon: { kind: 'image', blobId }`).
 *
 * - `add` grava a imagem no banco, com o mundo como dono, e devolve o id novo.
 * - `load` lê do banco as imagens com esses ids que ainda não estão aqui (as dos pins do mundo
 *   reaberto). Uma imagem que não está no banco fica de fora: o pin mostra o círculo hachurado.
 * - O `store` guarda, por id, o endereço (`URL.createObjectURL`) para a interface (`PinIcon`); o
 *   renderer do mapa lê o blob (`blob`) e o desenha no círculo do pin.
 * - `prune` apaga do banco as imagens do mundo que nenhum pin usa (`used`) e que não foram enviadas
 *   nesta sessão (o desfazer pode trazê-las de volta). Roda ao abrir o mundo: o histórico de
 *   desfazer é da sessão, então uma imagem que só ele usava já não volta.
 *
 * Sem `repo` (os testes do jsdom), as imagens ficam só na memória. `dispose` libera os endereços.
 */
export type PinImages = {
  store: StoreApi<PinImagesState>
  add(blob: Blob): Promise<string>
  load(ids: Iterable<string>): Promise<void>
  blob(id: string): Blob | undefined
  prune(used: Iterable<string>): Promise<void>
  dispose(): void
}

export type PinImagesState = {
  /** O endereço de cada imagem carregada, pelo id. */
  urls: Readonly<Record<string, string>>
}

/** Os ids das imagens que os pins usam como ícone. */
export function pinImageIds(pins: readonly Pin[]): string[] {
  const ids = new Set<string>()
  for (const pin of pins) if (pin.icon.kind === 'image') ids.add(pin.icon.blobId)
  return [...ids]
}

/** O id da imagem que o pin mostra no círculo do Personalizado (`null`: o ícone embutido). */
export function pinImageId(pin: Pick<Pin, 'type' | 'icon'>): string | null {
  return pin.type === 'custom' && pin.icon.kind === 'image' ? pin.icon.blobId : null
}

function objectUrl(blob: Blob): string {
  // O jsdom não tem `createObjectURL`: sem ele, a imagem não aparece, mas o resto funciona.
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : ''
}

export function createPinImages({
  worldId,
  repo,
  newId = () => crypto.randomUUID(),
}: {
  worldId: string
  repo?: Pick<WorldsRepo, 'saveImage' | 'getImage' | 'pruneImages'>
  newId?: () => string
}): PinImages {
  const store = createStore<PinImagesState>()(() => ({ urls: {} }))
  const blobs = new Map<string, Blob>()
  const loading = new Set<string>()
  /** As imagens enviadas nesta sessão, desde antes de gravar (o `prune` não as apaga). */
  const sent = new Set<string>()
  let disposed = false

  const put = (id: string, blob: Blob) => {
    if (disposed || blobs.has(id)) return
    blobs.set(id, blob)
    store.setState({ urls: { ...store.getState().urls, [id]: objectUrl(blob) } })
  }

  return {
    store,
    async add(blob) {
      const id = newId()
      sent.add(id)
      await repo?.saveImage({ id, worldId, blob })
      put(id, blob)
      return id
    },
    async load(ids) {
      if (!repo) return
      const missing = [...ids].filter((id) => !blobs.has(id) && !loading.has(id))
      for (const id of missing) loading.add(id)
      await Promise.all(
        missing.map(async (id) => {
          try {
            const image = await repo.getImage(id)
            if (image) put(id, image.blob)
          } catch {
            // Sem o banco, o pin mostra o círculo hachurado.
          } finally {
            loading.delete(id)
          }
        }),
      )
    },
    blob(id) {
      return blobs.get(id)
    },
    async prune(used) {
      if (!repo) return
      const keep = new Set(used)
      try {
        await repo.pruneImages(worldId, (id) => keep.has(id) || sent.has(id))
      } catch {
        // Sem o banco, as imagens sem uso ficam para a próxima vez.
      }
    },
    dispose() {
      disposed = true
      if (typeof URL.revokeObjectURL === 'function') for (const url of Object.values(store.getState().urls)) if (url) URL.revokeObjectURL(url)
      blobs.clear()
      store.setState({ urls: {} })
    },
  }
}
