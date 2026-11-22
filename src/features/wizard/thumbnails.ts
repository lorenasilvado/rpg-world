import type { WorldParams } from '../../core'
import type { Generator } from '../../workers/generatorClient'

/**
 * Miniaturas dos presets do assistente (spec F1 → 04 · Assistente): o mapa de cada preset com a
 * seed do assistente, em baixa resolução, gerado no worker. As da Lista de mundos usam o mesmo
 * caminho, com a seed e os parâmetros de cada mundo. As miniaturas usam um worker só delas,
 * criado ao abrir o assistente (ou a lista) e encerrado ao fechá-lo: o worker do editor guarda o ruído só da seed
 * mais recente, e as miniaturas com outra seed o fariam refazer tudo.
 */
export const THUMBNAIL_SIZE = 128

/** As miniaturas dos cartões da Lista de mundos, maiores que as do assistente (cartão de até ~320 px). */
export const LIST_THUMBNAIL_SIZE = 256

/** Pausa depois da última mudança da seed antes de gerar as miniaturas de novo. */
export const THUMBNAIL_SEED_MS = 300

export type Thumbnails = {
  /** RGBA `size² × 4` (padrão: `THUMBNAIL_SIZE`) do terreno, ou `null` se o pedido foi substituído. */
  render(seed: string, params: Readonly<WorldParams>, size?: number): Promise<Uint8ClampedArray<ArrayBuffer> | null>
  dispose(): void
}

export type CreateThumbnails = () => Thumbnails

/**
 * Miniaturas com o gerador dado (`createGenerator()`, um worker novo). O gerador entrega só o pedido
 * mais novo de cada vez (`newerOnly.ts`), então quem pede as miniaturas pede uma depois da outra.
 */
export function createThumbnails(generator: Pick<Generator, 'request' | 'terminate'>): Thumbnails {
  return {
    async render(seed, params, size = THUMBNAIL_SIZE) {
      const delivered = await generator.request({ seed, size, params: { ...params } })
      return delivered?.result.terrainRgba ?? null
    },
    dispose: () => generator.terminate(),
  }
}

/**
 * Gera as miniaturas dos `presets` em ordem, uma por vez, e entrega cada uma a `onThumbnail`.
 * Devolve a função que cancela: o pedido em andamento termina, mas nada mais é entregue nem pedido.
 * Uma falha (o worker não carrega, por exemplo) só deixa as miniaturas que faltam sem imagem: o
 * assistente continua criando o mundo.
 */
export function loadThumbnails<Id extends string>(
  thumbnails: Thumbnails,
  seed: string,
  presets: readonly { id: Id; params: Readonly<WorldParams> }[],
  onThumbnail: (id: Id, rgba: Uint8ClampedArray<ArrayBuffer>) => void,
): () => void {
  let cancelled = false
  void (async () => {
    for (const preset of presets) {
      let rgba: Uint8ClampedArray<ArrayBuffer> | null
      try {
        rgba = await thumbnails.render(seed, preset.params)
      } catch {
        return
      }
      if (cancelled) return
      if (rgba) onThumbnail(preset.id, rgba)
    }
  })()
  return () => {
    cancelled = true
  }
}
