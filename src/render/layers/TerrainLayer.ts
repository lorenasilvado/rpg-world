import { BufferImageSource, Sprite, Texture } from 'pixi.js'
import type { CoreField } from '../../core/types'

/**
 * Terreno numa textura única na GPU (ADR 0001): um sprite com o RGBA do campo, uma célula por
 * pixel. A textura é trocada a cada campo novo, e a anterior é destruída. Aproximar mostra as
 * células nítidas (como no mockup); afastar suaviza, com mipmaps. O RGBA (`terrainPixels`) vem
 * pronto do worker de geração (#90): aqui só é enviado para a GPU.
 */
export class TerrainLayer {
  readonly view = new Sprite()
  private texture: Texture | null = null

  /** Tamanho do campo exibido, em células (0 sem campo). */
  get size(): number {
    return this.texture ? this.texture.width : 0
  }

  /** `rgba`: o RGBA do campo (`terrainPixels`), `width × height × 4` bytes. */
  setField(field: Pick<CoreField, 'width' | 'height'>, rgba: Uint8ClampedArray<ArrayBuffer>) {
    const texture = new Texture({
      source: new BufferImageSource({
        resource: rgba,
        width: field.width,
        height: field.height,
        format: 'rgba8unorm',
        autoGenerateMipmaps: true,
        magFilter: 'nearest',
        minFilter: 'linear',
        mipmapFilter: 'linear',
      }),
    })
    this.view.texture = texture
    this.texture?.destroy(true)
    this.texture = texture
  }

  destroy() {
    this.view.destroy()
    this.texture?.destroy(true)
    this.texture = null
  }
}
