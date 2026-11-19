import { minimapMapBox } from './mapControls'

/** Resolução do canvas do minimapa: 2× o tamanho na tela, nítido em telas de alta densidade. */
export const MINIMAP_RES = 2

/** O que o pintor usa de um canvas (o `HTMLCanvasElement`, ou um falso nos testes). */
export type PaintCanvas = Pick<HTMLCanvasElement, 'width' | 'height'> & {
  getContext(type: '2d'): Pick<
    CanvasRenderingContext2D,
    'putImageData' | 'clearRect' | 'drawImage' | 'imageSmoothingEnabled' | 'imageSmoothingQuality'
  > | null
}

export type TerrainPainter = {
  /**
   * Desenha o RGBA do terreno (`width` × `height`) reduzido no quadrado do mapa do minimapa. Devolve
   * se desenhou (sem canvas 2D, como no jsdom, não desenha).
   */
  draw(target: PaintCanvas, width: number, height: number, rgba: Uint8ClampedArray<ArrayBuffer>): boolean
}

/**
 * Pintor do terreno do minimapa. O RGBA passa por um canvas de origem do tamanho do campo, que é
 * reaproveitado: um por tamanho (a prévia 256² e o mapa 1024²), criado na primeira vez. Assim,
 * durante o arrasto de um slider, cada prévia não aloca um canvas novo.
 */
export function createTerrainPainter(
  createCanvas: () => PaintCanvas = () => document.createElement('canvas'),
): TerrainPainter {
  const sources = new Map<string, PaintCanvas>()
  const source = (width: number, height: number) => {
    const key = `${width}x${height}`
    let canvas = sources.get(key)
    if (!canvas) {
      canvas = createCanvas()
      canvas.width = width
      canvas.height = height
      sources.set(key, canvas)
    }
    return canvas
  }
  return {
    draw(target, width, height, rgba) {
      const ctx = target.getContext('2d')
      if (!ctx) return false
      const src = source(width, height)
      const srcCtx = src.getContext('2d')
      if (!srcCtx) return false
      srcCtx.putImageData(new ImageData(rgba, width, height), 0, 0)
      const box = minimapMapBox()
      ctx.clearRect(0, 0, target.width, target.height)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(src as CanvasImageSource, box.x * MINIMAP_RES, box.y * MINIMAP_RES, box.size * MINIMAP_RES, box.size * MINIMAP_RES)
      return true
    },
  }
}
