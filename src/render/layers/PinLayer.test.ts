import { Texture } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../../persistence/types'
import { createPinImages } from '../../state/pinImages'
import { PIN_TYPES, type PinType } from '../../state/pinTypes'
import { LABELS_PER_FRAME, PinLayer, type PinLayerState } from './PinLayer'

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

describe('PinLayer: tipos escondidos e grupos (AC-F3-14, AC-F3-15)', () => {
  const at = (id: string, u: number, v: number, type: PinType = 'cidade'): Pin => ({
    id,
    type,
    name: id,
    pos: { u, v },
    icon: { kind: 'builtin', key: type },
    description: '',
    tags: [],
    fields: {},
  })
  const layerWith = () => new PinLayer(new Map<PinType, Texture>(PIN_TYPES.map((t) => [t.id, Texture.EMPTY])))
  const all = Object.fromEntries(PIN_TYPES.map((t) => [t.id, true])) as Record<PinType, boolean>

  it('esconde os pins dos tipos desligados, menos o selecionado', () => {
    const layer = layerWith()
    const pins = [at('a', 0.1, 0.1), at('b', 0.5, 0.5, 'npc')]
    layer.sync(state(pins), 0)
    layer.frame(1, 1, 0, true)
    expect(layer.shownCount).toBe(2)
    layer.setLayers({ ...all, cidade: false })
    layer.frame(1, 1, 1, true)
    expect(layer.shownCount).toBe(1)
    layer.sync({ ...state(pins), selectedId: 'a' }, 2)
    layer.frame(1, 1, 3, true)
    expect(layer.shownCount).toBe(2)
    layer.destroy()
  })

  it('abaixo de 0,8×, os pins próximos somem num grupo com o contador; acima, voltam', () => {
    const layer = layerWith()
    // A 0,01 de distância (10 unidades): 5 px na escala 0,5.
    const pins = [at('a', 0.5, 0.5), at('b', 0.51, 0.5), at('c', 0.52, 0.5), at('d', 0.9, 0.9)]
    layer.sync(state(pins), 0)
    layer.frame(0.5, 0.6, 0, true)
    expect(layer.groups.map((g) => g.ids)).toEqual([['a', 'b', 'c']])
    expect(layer.shownCount).toBe(1)
    layer.frame(1, 1.2, 1, true)
    expect(layer.groups).toEqual([])
    expect(layer.shownCount).toBe(4)
    layer.destroy()
  })
})

describe('PinLayer: rótulos com muitos pins (AC-F3-17)', () => {
  const at = (id: string, u: number, v: number): Pin => ({
    id,
    type: 'cidade',
    name: id,
    pos: { u, v },
    icon: { kind: 'builtin', key: 'cidade' },
    description: '',
    tags: [],
    fields: {},
  })
  // 100 pins numa grade de 10 × 10, de 0,05 a 0,95 (de 51 a 973 no mundo de 1024).
  const grid = () => Array.from({ length: 100 }, (_, i) => at(`p${i}`, 0.05 + (i % 10) * 0.1, 0.05 + Math.floor(i / 10) * 0.1))
  const layerWith = () => new PinLayer(new Map<PinType, Texture>(PIN_TYPES.map((t) => [t.id, Texture.EMPTY])))
  const whole = { x: 0, y: 0, width: 1024, height: 1024 }

  it(`a partir de 1,5×, cria no máximo ${LABELS_PER_FRAME} rótulos novos por quadro, e os outros nos quadros seguintes`, () => {
    const layer = layerWith()
    layer.sync(state(grid()), 0)
    layer.frame(2, 2, 0, true, whole)
    expect(layer.labelCount).toBe(LABELS_PER_FRAME)
    layer.frame(2, 2, 16, true, whole)
    expect(layer.labelCount).toBe(2 * LABELS_PER_FRAME)
    for (let i = 2; i < 5; i++) layer.frame(2, 2, i * 16, true, whole)
    expect(layer.labelCount).toBe(100)
    layer.destroy()
  })

  it('só os pins na vista (com a folga do nome) mostram o rótulo; o do hover entra na hora, fora do limite', () => {
    const layer = layerWith()
    const pins = grid()
    layer.sync(state(pins), 0)
    // A vista cobre só a coluna u = 0,05 (x = 51), com a folga de 160 px na escala 2 (80 no mundo).
    const view = { x: 0, y: 0, width: 10, height: 1024 }
    for (let i = 0; i < 3; i++) layer.frame(2, 2, i * 16, true, view)
    expect(layer.labelCount).toBe(10)
    // Sem vista, todos contam como à vista: o limite vale no quadro, e o pin do hover passa na frente.
    layer.sync(state(pins, 'p99'), 48)
    layer.frame(2, 2, 64, true)
    expect(layer.labelCount).toBe(10 + LABELS_PER_FRAME + 1)
    layer.destroy()
  })
})
