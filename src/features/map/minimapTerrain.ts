import { MINIMAP_WIDTH } from './bottomBarLayout'
import { minimapMapBox } from './mapControls'

/**
 * Resolução do canvas do minimapa (pixels do canvas por px CSS): a densidade da tela arredondada
 * para cima, de 1× a 3×, para ficar nítido sem gastar à toa.
 */
export function minimapResolution(devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  return Math.min(3, Math.max(1, Math.ceil(dpr)))
}

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
      // A escala sai do próprio canvas (largura em pixels do canvas sobre a do minimapa em px CSS).
      const res = target.width / MINIMAP_WIDTH
      ctx.drawImage(src as CanvasImageSource, box.x * res, box.y * res, box.size * res, box.size * res)
      return true
    },
  }
}
