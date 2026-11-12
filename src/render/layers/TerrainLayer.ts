import { BufferImageSource, Sprite, Texture } from 'pixi.js'
import type { CoreField } from '../../core/types'
import { terrainPixels } from './terrainPixels'

/**
 * Terreno numa textura única na GPU (ADR 0001): um sprite com o RGBA do campo, uma célula por
 * pixel. A textura é trocada a cada campo novo, e a anterior é destruída. Aproximar mostra as
 * células nítidas (como no mockup); afastar suaviza, com mipmaps.
 */
export class TerrainLayer {
  readonly view = new Sprite()
  private texture: Texture | null = null

  /** Tamanho do campo exibido, em células (0 sem campo). */
  get size(): number {
    return this.texture ? this.texture.width : 0
  }

  setField(field: CoreField, patchSeed: string) {
    const texture = new Texture({
      source: new BufferImageSource({
        resource: terrainPixels(field, patchSeed),
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
