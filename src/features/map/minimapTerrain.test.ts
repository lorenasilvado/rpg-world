import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createTerrainPainter, minimapResolution, type PaintCanvas } from './minimapTerrain'

function fakeCanvas(width = 0, height = 0) {
  const ctx = {
    putImageData: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low' as ImageSmoothingQuality,
  }
  const canvas = { width, height, getContext: () => ctx }
  return { canvas: canvas as unknown as PaintCanvas, ctx }
}

const rgba = (size: number) => new Uint8ClampedArray(size * size * 4)

describe('createTerrainPainter', () => {
  // O jsdom não tem ImageData: um substituto que só guarda os dados.
  beforeAll(() => {
    vi.stubGlobal(
      'ImageData',
      class {
        data: Uint8ClampedArray
        width: number
        height: number
        constructor(data: Uint8ClampedArray, width: number, height: number) {
          this.data = data
          this.width = width
          this.height = height
        }
      },
    )
  })
  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('desenha o terreno no quadrado do mapa do minimapa (2×)', () => {
    const painter = createTerrainPainter(() => fakeCanvas().canvas)
    const target = fakeCanvas(320, 200)
    expect(painter.draw(target.canvas, 4, 4, rgba(4))).toBe(true)
    expect(target.ctx.clearRect).toHaveBeenCalledWith(0, 0, 320, 200)
    // O mapa quadrado de 100 px, centrado nos 160 × 100: x 30, em 2×.
    expect(target.ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 60, 0, 200, 200)
  })

  it('a escala do desenho sai da largura do canvas (3× numa tela de densidade 3)', () => {
    const painter = createTerrainPainter(() => fakeCanvas().canvas)
    const target = fakeCanvas(480, 300)
    painter.draw(target.canvas, 4, 4, rgba(4))
    expect(target.ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 90, 0, 300, 300)
  })

  it('reaproveita o canvas de origem de cada tamanho, em vez de criar um a cada campo', () => {
    const created: PaintCanvas[] = []
    const painter = createTerrainPainter(() => {
      const { canvas } = fakeCanvas()
      created.push(canvas)
      return canvas
    })
    const target = fakeCanvas(320, 200).canvas
    // Prévias seguidas durante o arrasto, depois o mapa final, depois mais prévias.
    for (const size of [8, 8, 8, 16, 8, 16]) painter.draw(target, size, size, rgba(size))
    expect(created).toHaveLength(2)
    expect(created.map((c) => [c.width, c.height])).toEqual([
      [8, 8],
      [16, 16],
    ])
  })

  it('sem canvas 2D (jsdom), não desenha', () => {
    const painter = createTerrainPainter(() => fakeCanvas().canvas)
    const target = { width: 320, height: 200, getContext: () => null } as unknown as PaintCanvas
    expect(painter.draw(target, 4, 4, rgba(4))).toBe(false)
  })
})

describe('minimapResolution', () => {
  it('é a densidade da tela arredondada para cima, de 1× a 3×', () => {
    expect(minimapResolution(1)).toBe(1)
    expect(minimapResolution(1.25)).toBe(2)
    expect(minimapResolution(2)).toBe(2)
    expect(minimapResolution(3)).toBe(3)
    expect(minimapResolution(4)).toBe(3)
    expect(minimapResolution(0)).toBe(1)
    expect(minimapResolution(Number.NaN)).toBe(1)
  })
})
