import type { Decor } from '../core/types'
import type { Pin } from '../persistence/types'
import { pinType, type PinType } from '../state/pinTypes'
import { WORLD_SIZE } from './camera'
import { drawOrder } from './layers/pinMath'
import { DECOR_UNIT, INK_BOXES, INK_PX, INK_SHEET, decorVariant, drawDecorSheet, inkAnchor, inkFrame, type Ink } from './style/decorInk'
import { PIN_SIZE_PX, PIN_VIEWBOX, drawPin, type PinImage, type PinInk } from './style/pinShapes'

/**
 * O mapa exportado em PNG (mundos.md → Exportar › Imagem (.png), AC-F4-11), desenhado num canvas 2D,
 * sem o Pixi: o terreno (o RGBA do `terrainPixels`, gerado na resolução da imagem), os ícones da
 * decoração (os quadros do mesmo spritesheet do editor) e, se pedidos, os pins e os rótulos, na
 * ordem de desenho do mapa. Tudo é o mapa inteiro, sem a câmera: o 1× é o mapa 1024², e o 2× e o 4×
 * são a mesma imagem com mais detalhe (os pins, os rótulos e os ícones crescem junto).
 *
 * Diferente do editor, a imagem mostra todos os ícones (sem o nível de detalhe do zoom), os pins
 * soltos (sem os grupos) e o rótulo de todos os pins, desenhados depois de todos os pins (nenhum pin
 * cobre um rótulo). Os tipos de pin e a decoração desligados em
 * Camadas ficam de fora, como no mapa.
 */

/** Escalas do PNG: 1× é o mapa 1024², uma célula por pixel. */
export const EXPORT_SCALES = [1, 2, 4] as const
export type ExportScale = (typeof EXPORT_SCALES)[number]

/** Lado da imagem (e do terreno regerado), em px, na escala. */
export function exportImageSize(scale: ExportScale): number {
  return WORLD_SIZE * scale
}

/** O que o PNG leva além do terreno. */
export type MapImageOptions = { scale: ExportScale; pins: boolean }

/** O contexto 2D que o desenho usa (o do `<canvas>` e o do `OffscreenCanvas`). */
export type MapImageInk = PinInk &
  Ink &
  Pick<CanvasRenderingContext2D, 'putImageData' | 'strokeText' | 'fillText'> & {
    font: string
    textAlign: CanvasTextAlign
    textBaseline: CanvasTextBaseline
  }

export type MapImageInput = {
  scale: ExportScale
  /** O RGBA do terreno em `exportImageSize(scale)`², do `terrainPixels`. */
  terrainRgba: Uint8ClampedArray<ArrayBuffer>
  /** Os ícones e o spritesheet deles (`drawDecorSheet`); sem eles, a imagem fica sem decoração. */
  decor: { icons: Decor; sheet: CanvasImageSource } | null
  /** Os pins a desenhar (sem eles, a imagem fica sem pins), com as imagens enviadas por id. */
  pins: { list: readonly Pin[]; hidden: ReadonlySet<PinType>; images: ReadonlyMap<string, PinImage> } | null
}

/** O rótulo do pin, como o do mapa: Cinzel 700 13 px, com contorno claro de 2 px, 5 px abaixo da âncora. */
export const LABEL_STYLE = { font: 'Cinzel, serif', weight: 700, size: 13, gap: 5, fill: '#2B2420', stroke: '#F7F1E3', strokeWidth: 4 } as const

/** Fonte do rótulo na escala, no formato do `ctx.font`. */
export function labelFont(scale: number): string {
  return `${LABEL_STYLE.weight} ${LABEL_STYLE.size * scale}px ${LABEL_STYLE.font}`
}

/** Desenha o PNG no `ctx`, de `exportImageSize(scale)` px de lado. */
export function drawMapImage(ctx: MapImageInk, input: MapImageInput, makeImageData = (rgba: Uint8ClampedArray<ArrayBuffer>, size: number) => new ImageData(rgba, size, size)) {
  const { scale } = input
  const size = exportImageSize(scale)
  if (input.terrainRgba.length !== size * size * 4) throw new Error(`drawMapImage: o terreno não tem ${size}² px`)
  ctx.putImageData(makeImageData(input.terrainRgba, size), 0, 0)
  if (input.decor) drawDecor(ctx, input.decor.icons, input.decor.sheet, scale)
  if (input.pins) drawPins(ctx, input.pins, scale)
}

/** Os ícones, de cima para baixo (a ordem do núcleo), com o pé na posição deles. */
function drawDecor(ctx: MapImageInk, icons: Decor, sheet: CanvasImageSource, scale: number) {
  const size = WORLD_SIZE * scale
  // Px do spritesheet → px da imagem: a mesma conta da `DecorLayer` (unidades do mundo × escala).
  const k = (DECOR_UNIT / INK_PX) * scale
  for (let i = 0; i < icons.kind.length; i++) {
    const kind = icons.kind[i]
    if (!INK_BOXES.has(kind)) continue // tipo sem desenho no spritesheet: o editor também não o mostra
    const f = inkFrame(kind, decorVariant(icons.u[i], icons.v[i]))
    const a = inkAnchor(kind)
    const w = f.width * k
    const h = f.height * k
    ctx.drawImage(sheet, f.x, f.y, f.width, f.height, icons.u[i] * size - a.x * w, icons.v[i] * size - a.y * h, w, h)
  }
}

function drawPins(ctx: MapImageInk, pins: NonNullable<MapImageInput['pins']>, scale: number) {
  const size = WORLD_SIZE * scale
  const width = PIN_SIZE_PX * scale
  const height = (width * PIN_VIEWBOX.height) / PIN_VIEWBOX.width
  const shown = drawOrder(
    pins.list.filter((p) => !pins.hidden.has(pinType(p.type))),
    null,
    null,
  )
  for (const pin of shown) {
    const type = pinType(pin.type)
    const image = type === 'custom' && pin.icon.kind === 'image' ? pins.images.get(pin.icon.blobId) : undefined
    ctx.save()
    ctx.translate(pin.pos.u * size - width / 2, pin.pos.v * size - height)
    drawPin(ctx, type, width, undefined, image)
    ctx.restore()
  }
  // Os rótulos vão depois de todos os pins: na imagem, todos estão à vista, e um pin mais abaixo
  // cobriria o rótulo do pin de cima.
  ctx.save()
  ctx.font = labelFont(scale)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'
  ctx.lineWidth = LABEL_STYLE.strokeWidth * scale
  ctx.strokeStyle = LABEL_STYLE.stroke
  ctx.fillStyle = LABEL_STYLE.fill
  for (const pin of shown) {
    if (!pin.name) continue
    const x = pin.pos.u * size
    const y = pin.pos.v * size + LABEL_STYLE.gap * scale
    ctx.strokeText(pin.name, x, y)
    ctx.fillText(pin.name, x, y)
  }
  ctx.restore()
}

/** O spritesheet dos ícones num canvas (o mesmo desenho do editor), ou `null` sem o contexto 2D. */
export function decorSheet(): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = INK_SHEET.width
  canvas.height = INK_SHEET.height
  const ctx = canvas.getContext('2d') as Ink | null
  if (!ctx) return null
  drawDecorSheet(ctx)
  return canvas
}
