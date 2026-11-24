import { describe, expect, it, vi } from 'vitest'
import { IMAGE_HARD_MAX_BYTES, IMAGE_MAX_BYTES, checkImageFile, fitSize, formatBytes, resizeImage, unsizedSvgSize, type ResizeCanvas } from './uploadImage'

const file = (name: string, type: string, size: number) => ({ name, type, size })

describe('imagem enviada: formato e tamanho (AC-F3-11)', () => {
  it('aceita PNG, JPG e SVG de até 1 MB', () => {
    expect(checkImageFile(file('a.png', 'image/png', 10))).toBe('ok')
    expect(checkImageFile(file('a.jpg', 'image/jpeg', 10))).toBe('ok')
    expect(checkImageFile(file('a.svg', 'image/svg+xml', 10))).toBe('ok')
    expect(checkImageFile(file('a.png', 'image/png', IMAGE_MAX_BYTES))).toBe('ok')
  })

  it('acima de 1 MB, pergunta', () => {
    expect(checkImageFile(file('a.png', 'image/png', IMAGE_MAX_BYTES + 1))).toBe('large')
    expect(checkImageFile(file('a.jpg', 'image/jpeg', 2 * IMAGE_MAX_BYTES))).toBe('large')
  })

  it('acima de 20 MB, recusa sem perguntar', () => {
    expect(checkImageFile(file('a.png', 'image/png', IMAGE_HARD_MAX_BYTES))).toBe('large')
    expect(checkImageFile(file('a.png', 'image/png', IMAGE_HARD_MAX_BYTES + 1))).toBe('tooLarge')
    expect(checkImageFile(file('a.svg', 'image/svg+xml', 300 * IMAGE_MAX_BYTES))).toBe('tooLarge')
  })

  it('outro formato é recusado, de qualquer tamanho', () => {
    expect(checkImageFile(file('a.gif', 'image/gif', 10))).toBe('format')
    expect(checkImageFile(file('a.webp', 'image/webp', 10))).toBe('format')
    expect(checkImageFile(file('a.txt', 'text/plain', 5 * IMAGE_MAX_BYTES))).toBe('format')
    // O tipo informado vale mais que o nome.
    expect(checkImageFile(file('a.png', 'image/gif', 10))).toBe('format')
  })

  it('sem o tipo informado, vale a extensão do nome', () => {
    expect(checkImageFile(file('Brasão.JPEG', '', 10))).toBe('ok')
    expect(checkImageFile(file('mapa.svg', '', 10))).toBe('ok')
    expect(checkImageFile(file('mapa.gif', '', 10))).toBe('format')
    expect(checkImageFile(file('mapa', '', 10))).toBe('format')
  })

  it('o tamanho aparece em MB (ou KB abaixo de 1 MB)', () => {
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2,4 MB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(850 * 1024)).toBe('850 KB')
  })
})

describe('imagem enviada: redução para 256 px (AC-F3-11)', () => {
  it('cabe em 256 × 256 com a mesma proporção', () => {
    expect(fitSize(1024, 1024)).toEqual({ width: 256, height: 256 })
    expect(fitSize(2000, 1000)).toEqual({ width: 256, height: 128 })
    expect(fitSize(300, 1200)).toEqual({ width: 64, height: 256 })
  })

  it('não aumenta uma imagem menor', () => {
    expect(fitSize(100, 80)).toEqual({ width: 100, height: 80 })
    expect(fitSize(256, 10)).toEqual({ width: 256, height: 10 })
  })

  it('sem tamanho (um SVG sem width nem height), o quadrado de 256', () => {
    expect(fitSize(0, 0)).toEqual({ width: 256, height: 256 })
    expect(fitSize(Number.NaN, 50)).toEqual({ width: 256, height: 256 })
  })

  it('desenha no tamanho reduzido e devolve um PNG', async () => {
    const drawImage = vi.fn()
    const release = vi.fn()
    const png = new Blob(['png'], { type: 'image/png' })
    let size: [number, number] = [0, 0]
    const toBlob = vi.fn((done: BlobCallback, type?: string) => done(type === 'image/png' ? png : null))
    const canvas = (w: number, h: number): ResizeCanvas => {
      size = [w, h]
      return { toBlob, getContext: () => ({ drawImage, imageSmoothingQuality: 'low' }) } as unknown as ResizeCanvas
    }
    const source = {} as CanvasImageSource
    const result = await resizeImage(new Blob(['x']), { decode: async () => ({ source, width: 1200, height: 800, release }), canvas })
    expect(result).toBe(png)
    expect(size).toEqual([256, 171])
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0, 256, 171)
    expect(release).toHaveBeenCalled()
  })

  it('uma imagem que não decodifica é recusada', async () => {
    await expect(resizeImage(new Blob(['x']), { decode: () => Promise.reject(new Error('corrompida')) })).rejects.toThrow('corrompida')
  })
})

describe('SVG sem width e height: desenhado em 256 px', () => {
  const svg = (attrs: string) => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}><rect width="10" height="10"/></svg>`

  it('só com viewBox: o lado maior com 256 px, na proporção do viewBox', () => {
    expect(unsizedSvgSize(svg('viewBox="0 0 10 10"'))).toEqual({ width: 256, height: 256 })
    expect(unsizedSvgSize(svg('viewBox="0,0,20,10"'))).toEqual({ width: 256, height: 128 })
    expect(unsizedSvgSize(svg('viewBox="0 0 30 120"'))).toEqual({ width: 64, height: 256 })
  })

  it('sem viewBox, ou com só um dos dois, ou em %: o tamanho que falta não vale', () => {
    expect(unsizedSvgSize(svg(''))).toEqual({ width: 256, height: 256 })
    expect(unsizedSvgSize(svg('width="40" viewBox="0 0 20 10"'))).toEqual({ width: 256, height: 128 })
    expect(unsizedSvgSize(svg('width="100%" height="100%" viewBox="0 0 10 10"'))).toEqual({ width: 256, height: 256 })
  })

  it('com width e height, vale o tamanho do próprio SVG', () => {
    expect(unsizedSvgSize(svg('width="1000" height="500"'))).toBeNull()
    expect(unsizedSvgSize(svg('width="24px" height="24px" viewBox="0 0 10 10"'))).toBeNull()
  })

  it('o que não é SVG não tem tamanho a calcular', () => {
    expect(unsizedSvgSize('<html></html>')).toBeNull()
  })
})
