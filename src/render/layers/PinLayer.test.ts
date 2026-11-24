import { Texture } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../../persistence/types'
import { createPinImages } from '../../state/pinImages'
import { PIN_TYPES, type PinType } from '../../state/pinTypes'
import { PinLayer, type PinLayerState } from './PinLayer'

const pin = (id: string, blobId: string): Pin => ({
  id,
  type: 'custom',
  name: id,
  pos: { u: 0.5, v: 0.5 },
  icon: { kind: 'image', blobId },
  description: '',
  tags: [],
  fields: {},
})

const state = (pins: Pin[], hoveredId: string | null = null): PinLayerState => ({ pins, selectedId: null, hoveredId, newPinId: null, dragging: null })

afterEach(() => vi.unstubAllGlobals())

describe('PinLayer: imagem enviada que não desenha (AC-F3-11)', () => {
  it('fica com o círculo hachurado e não é decodificada de novo a cada mudança', async () => {
    const createImageBitmap = vi.fn(() => Promise.reject(new Error('corrompida')))
    vi.stubGlobal('createImageBitmap', createImageBitmap)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const images = createPinImages({ worldId: 'w1', newId: () => 'img' })
    await images.add(new Blob(['x'], { type: 'image/png' }))
    const textures = new Map<PinType, Texture>(PIN_TYPES.map((t) => [t.id, Texture.EMPTY]))
    const layer = new PinLayer(textures, images)

    const pins = [pin('a', 'img')]
    layer.sync(state(pins), 0)
    await Promise.resolve()
    await Promise.resolve()
    // Hover, seleção e uma lista nova com o mesmo pin: nada de decodificar outra vez.
    layer.sync(state(pins, 'a'), 1)
    layer.sync(state([...pins]), 2)
    layer.imagesChanged()
    await Promise.resolve()

    expect(createImageBitmap).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(layer.imageTextureCount).toBe(0)
    warn.mockRestore()
  })
})
