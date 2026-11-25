import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DECOR, DEFAULT_WORLD_PARAMS, type CoreField, type Decor } from '../../core'
import type { Pin } from '../../persistence/types'
import type { PinImages } from '../../state/pinImages'
import { createPinsStore } from '../../state/pinsStore'
import { createUiStore } from '../../state/uiStore'
import type { WorldStore } from '../../state/worldStore'
import { mapImageFileName, renderMapImage, type ImageCanvas, type RenderMapImageDeps } from './exportImage'

const decor = (n: number): Decor => ({ u: new Float32Array(n).fill(0.5), v: new Float32Array(n).fill(0.5), kind: new Uint8Array(n).fill(DECOR.tree) })

function world(state: { width?: number; status?: 'idle' | 'generating' } = {}) {
  const width = state.width ?? 1024
  const field = { width, height: width, decor: decor(3) } as unknown as CoreField
  const s = { name: 'Reino', seed: 'reino', params: { ...DEFAULT_WORLD_PARAMS, ocean: 70 }, field, terrainRgba: new Uint8ClampedArray(width * width * 4), status: state.status ?? 'idle' }
  return { getState: () => s } as unknown as WorldStore
}

const pin = (id: string, type: string, icon: Pin['icon'] = { kind: 'builtin', key: type }): Pin => ({
  id,
  type,
  name: id,
  pos: { u: 0.5, v: 0.5 },
  icon,
  description: '',
  tags: [],
  fields: {},
})

function setup(opts: { width?: number; status?: 'idle' | 'generating'; pins?: Pin[]; blobs?: Record<string, Blob>; toBlob?: Blob | null } = {}) {
  const pins = createPinsStore()
  pins.setState({ pins: opts.pins ?? [] })
  const images = { blob: (id: string) => opts.blobs?.[id] } as unknown as PinImages
  const ui = createUiStore()
  const calls: string[] = []
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : (...args: unknown[]) => calls.push(`${String(key)}${key === 'drawImage' ? `:${(args[0] as { id?: string }).id ?? ''}` : ''}`)),
    set: (target, key, value) => ((target[key] = value), true),
  })
  const canvases: ImageCanvas[] = []
  const closed: string[] = []
  const exportTerrain = vi.fn(async ({ size }: { size: number }) => ({ terrainRgba: new Uint8ClampedArray(size * size * 4), decor: decor(5) }))
  const deps: RenderMapImageDeps = {
    exportTerrain,
    createCanvas: (size) => {
      const canvas: ImageCanvas = {
        width: size,
        height: size,
        getContext: () => ctx,
        toBlob: (done) => done(opts.toBlob === undefined ? new Blob(['png'], { type: 'image/png' }) : opts.toBlob),
      }
      canvases.push(canvas)
      return canvas
    },
    sheet: () => ({ id: 'sheet' }) as unknown as CanvasImageSource,
    loadImage: async (blob) => {
      const id = await blob.text()
      if (id === 'quebrada') throw new Error('não abre')
      return { source: { id } as unknown as CanvasImageSource, width: 4, height: 4, close: () => closed.push(id) }
    },
    loadFont: vi.fn(async () => {}),
    makeImageData: (data, size) => ({ data, width: size, height: size }) as unknown as ImageData,
  }
  return { source: { world: world(opts), pins, images, ui }, deps, exportTerrain, calls, canvases, closed, ui }
}

beforeEach(() => vi.stubGlobal('Path2D', class {}))
afterEach(() => vi.unstubAllGlobals())

describe('Exportar › Imagem (.png) (AC-F4-11)', () => {
  it('o nome do arquivo é o do mundo, como no .json, com a escala', () => {
    expect(mapImageFileName('Reino de Áldor!', 1)).toBe('reino-de-aldor-1x.png')
    expect(mapImageFileName('???', 4)).toBe('mundo-4x.png')
  })

  it('no 1×, usa o mapa 1024² já exibido, sem gerar de novo', async () => {
    const { source, deps, exportTerrain, canvases, calls } = setup()
    const blob = await renderMapImage(source, { scale: 1, pins: false }, deps)
    expect(blob.type).toBe('image/png')
    expect(exportTerrain).not.toHaveBeenCalled()
    expect(calls.filter((c) => c === 'drawImage:sheet')).toHaveLength(3)
    // O canvas é liberado no fim.
    expect(canvases.map((c) => [c.width, c.height])).toEqual([[0, 0]])
  })

  it('no 2× e no 4×, gera o terreno de novo nessa resolução, com a seed e os parâmetros do mundo', async () => {
    for (const scale of [2, 4] as const) {
      const { source, deps, exportTerrain, calls } = setup()
      await renderMapImage(source, { scale, pins: false }, deps)
      expect(exportTerrain).toHaveBeenCalledWith({ seed: 'reino', size: 1024 * scale, params: { ...DEFAULT_WORLD_PARAMS, ocean: 70 } })
      expect(calls.filter((c) => c === 'drawImage:sheet')).toHaveLength(5)
    }
  })

  it('no 1×, enquanto o mapa gera (ou com a prévia à vista), gera o 1024² de novo', async () => {
    for (const state of [{ status: 'generating' as const }, { width: 256 }]) {
      const { source, deps, exportTerrain } = setup(state)
      await renderMapImage(source, { scale: 1, pins: false }, deps)
      expect(exportTerrain).toHaveBeenCalledWith(expect.objectContaining({ size: 1024 }))
    }
  })

  it('a decoração desligada em Camadas fica de fora', async () => {
    const { source, deps, calls, ui } = setup()
    ui.getState().setLayer('decor', false)
    await renderMapImage(source, { scale: 1, pins: false }, deps)
    expect(calls.filter((c) => c === 'drawImage:sheet')).toHaveLength(0)
  })

  it('com os pins, carrega a fonte dos rótulos e as imagens enviadas (e as fecha no fim); sem eles, nada disso', async () => {
    const custom = pin('c', 'custom', { kind: 'image', blobId: 'img' })
    const broken = pin('q', 'custom', { kind: 'image', blobId: 'q' })
    const missing = pin('m', 'custom', { kind: 'image', blobId: 'sem-blob' })
    const blobs = { img: new Blob(['img']), q: new Blob(['quebrada']) }
    const off = setup({ pins: [pin('a', 'cidade'), custom], blobs })
    off.ui.getState().setLayer('decor', false)
    await renderMapImage(off.source, { scale: 1, pins: false }, off.deps)
    expect(off.deps.loadFont).not.toHaveBeenCalled()
    expect(off.calls.some((c) => c.startsWith('fillText'))).toBe(false)

    const on = setup({ pins: [pin('a', 'cidade'), custom, broken, missing], blobs })
    on.ui.getState().setLayer('decor', false)
    await renderMapImage(on.source, { scale: 2, pins: true }, on.deps)
    expect(on.deps.loadFont).toHaveBeenCalledWith('700 26px Cinzel, serif')
    expect(on.calls.filter((c) => c === 'fillText')).toHaveLength(4)
    expect(on.calls.filter((c) => c === 'drawImage:img')).toHaveLength(1)
    expect(on.closed).toEqual(['img'])
  })

  it('os tipos de pin desligados em Camadas ficam de fora', async () => {
    const { source, deps, calls, ui } = setup({ pins: [pin('a', 'cidade'), pin('b', 'vila')] })
    ui.getState().setLayer('decor', false)
    ui.getState().setLayer('vila', false)
    await renderMapImage(source, { scale: 1, pins: true }, deps)
    expect(calls.filter((c) => c === 'fillText')).toHaveLength(1)
  })

  it('se o navegador não gera o PNG, a promessa é rejeitada e o canvas é liberado', async () => {
    const { source, deps, canvases } = setup({ toBlob: null })
    await expect(renderMapImage(source, { scale: 1, pins: false }, deps)).rejects.toThrow('o navegador não gerou o PNG')
    expect(canvases[0].width).toBe(0)
  })

  it('se o terreno falha no worker, a promessa é rejeitada', async () => {
    const { source, deps } = setup()
    deps.exportTerrain = () => Promise.reject(new Error('sem memória'))
    await expect(renderMapImage(source, { scale: 4, pins: false }, deps)).rejects.toThrow('sem memória')
  })
})
