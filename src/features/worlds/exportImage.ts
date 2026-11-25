import type { Decor } from '../../core/types'
import { fileSlug } from '../../persistence/exportImport'
import { decorSheet, drawMapImage, exportImageSize, labelFont, type MapImageInk, type MapImageOptions, type ExportScale } from '../../render/mapImage'
import type { PinImage } from '../../render/style/pinShapes'
import { pinImageId, type PinImages } from '../../state/pinImages'
import type { PinsStore } from '../../state/pinsStore'
import { PIN_TYPES, type PinType } from '../../state/pinTypes'
import type { UiStore } from '../../state/uiStore'
import type { WorldStore } from '../../state/worldStore'
import type { GenerateRequest } from '../../workers/generatorApi'

/**
 * Exportar › Imagem (.png) (AC-F4-11): monta o PNG do mapa aberto (`drawMapImage`) e o devolve como
 * blob. O terreno vem na resolução da imagem: no 1×, o mapa 1024² que o editor já mostra (se ele
 * terminou bem: sem estar gerando nem com a última geração em erro); senão, `exportTerrain` o gera de novo, no worker, com a seed e os parâmetros do
 * mundo. A decoração e os tipos de pin seguem Camadas (`ui`); os pins e os rótulos só vão com
 * `options.pins`, com as imagens enviadas do Personalizado.
 */
export type ExportTerrain = (req: GenerateRequest) => Promise<{ terrainRgba: Uint8ClampedArray<ArrayBuffer>; decor: Decor }>

export type MapImageSource = { world: WorldStore; pins: PinsStore; images: PinImages; ui: UiStore }

/** O canvas do PNG (os testes do jsdom, sem canvas, passam um falso). */
export type ImageCanvas = {
  width: number
  height: number
  getContext(type: '2d'): unknown
  toBlob(callback: (blob: Blob | null) => void, type?: string): void
}

export type RenderMapImageDeps = {
  exportTerrain: ExportTerrain
  createCanvas?: (size: number) => ImageCanvas
  /** O spritesheet da decoração (`decorSheet`); `null` sem o contexto 2D. */
  sheet?: () => CanvasImageSource | null
  /** Lê a imagem enviada de um pin; sem ela, o pin fica com o círculo hachurado. */
  loadImage?: (blob: Blob) => Promise<PinImage & { close?: () => void }>
  /** Espera a fonte dos rótulos carregar. */
  loadFont?: (font: string) => Promise<unknown>
  /** Monta o `ImageData` do terreno (no jsdom não existe). */
  makeImageData?: (rgba: Uint8ClampedArray<ArrayBuffer>, size: number) => ImageData
}

/** O nome do PNG: o nome do mundo como no .json, com a escala (`reino-de-aldor-2x.png`). */
export function mapImageFileName(worldName: string, scale: ExportScale): string {
  return `${fileSlug(worldName)}-${scale}x.png`
}

const htmlCanvas = (size: number): ImageCanvas => Object.assign(document.createElement('canvas'), { width: size, height: size })

const bitmap = async (blob: Blob) => {
  const b = await createImageBitmap(blob)
  return { source: b, width: b.width, height: b.height, close: () => b.close() }
}

export async function renderMapImage(source: MapImageSource, options: MapImageOptions, deps: RenderMapImageDeps): Promise<Blob> {
  const { createCanvas = htmlCanvas, sheet = decorSheet, loadImage = bitmap, loadFont = (font) => document.fonts.load(font) } = deps
  const state = source.world.getState()
  const size = exportImageSize(options.scale)
  // Só o mapa final que terminou bem corresponde à seed e aos parâmetros atuais: gerando, com a
  // prévia ou depois de uma falha (`error`), o que está na tela é de outro pedido.
  const shown = state.status === 'idle' && state.field && state.terrainRgba && state.field.width === size
  const terrain = shown
    ? { terrainRgba: state.terrainRgba!, decor: state.field!.decor }
    : await deps.exportTerrain({ seed: state.seed, size, params: { ...state.params } })

  const { layers } = source.ui.getState()
  const decorSprites = layers.decor ? sheet() : null
  const opened: { close?: () => void }[] = []
  try {
    let pins = null
    if (options.pins) {
      const list = source.pins.getState().pins
      const hidden = new Set<PinType>(PIN_TYPES.map((t) => t.id).filter((t) => !layers[t]))
      const images = new Map<string, PinImage>()
      for (const id of new Set(list.map(pinImageId).filter((id): id is string => id !== null))) {
        const blob = source.images.blob(id)
        if (!blob) continue
        try {
          const image = await loadImage(blob)
          opened.push(image)
          images.set(id, image)
        } catch {
          // A imagem não abriu: o pin sai com o círculo hachurado, como no mapa.
        }
      }
      if (list.some((p) => p.name)) await loadFont(labelFont(options.scale)).catch(() => {})
      pins = { list, hidden, images }
    }

    const canvas = createCanvas(size)
    const ctx = canvas.getContext('2d') as MapImageInk | null
    if (!ctx) throw new Error('sem o contexto 2D para desenhar o PNG')
    try {
      drawMapImage(
        ctx,
        { scale: options.scale, terrainRgba: terrain.terrainRgba, decor: decorSprites ? { icons: terrain.decor, sheet: decorSprites } : null, pins },
        deps.makeImageData,
      )
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('o navegador não gerou o PNG'))), 'image/png'),
      )
    } finally {
      // Libera já os 64 MB do canvas de 4096².
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    for (const image of opened) image.close?.()
  }
}
