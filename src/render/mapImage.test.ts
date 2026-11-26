import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DECOR, type Decor } from '../core/types'
import type { Pin, Road } from '../persistence/types'
import { EXPORT_SCALES, drawMapImage, exportImageSize, labelFont, type MapImageInk } from './mapImage'
import { DECOR_UNIT, INK_PX, decorVariant, inkAnchor, inkFrame } from './style/decorInk'

/** Contexto 2D falso: guarda as chamadas, com o estado da fonte no momento de cada texto. */
function fakeCtx() {
  const calls: { name: string; args: unknown[]; font?: string; strokeStyle?: string; lineWidth?: number }[] = []
  const ctx: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 0, lineJoin: 'miter', lineCap: 'butt', globalAlpha: 1, font: '', textAlign: 'start', textBaseline: 'alphabetic' }
  const methods = ['save', 'restore', 'translate', 'scale', 'rotate', 'clip', 'beginPath', 'ellipse', 'fillRect', 'stroke', 'fill', 'drawImage', 'putImageData', 'strokeText', 'fillText', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'closePath', 'setTransform', 'setLineDash']
  for (const m of methods) ctx[m] = vi.fn((...args: unknown[]) => calls.push({ name: m, args, font: ctx.font as string, strokeStyle: ctx.strokeStyle as string, lineWidth: ctx.lineWidth as number }))
  return { ctx: ctx as unknown as MapImageInk, calls, of: (name: string) => calls.filter((c) => c.name === name) }
}

const decor = (items: { u: number; v: number; kind: number }[]): Decor => ({
  u: Float32Array.from(items.map((i) => i.u)),
  v: Float32Array.from(items.map((i) => i.v)),
  kind: Uint8Array.from(items.map((i) => i.kind)),
})

const pin = (id: string, type: string, u: number, v: number, name = id): Pin => ({
  id,
  type,
  name,
  pos: { u, v },
  icon: { kind: 'builtin', key: type },
  description: '',
  tags: [],
  fields: {},
})

const rgba = (size: number) => new Uint8ClampedArray(size * size * 4)
const imageData = (data: Uint8ClampedArray<ArrayBuffer>, size: number) => ({ data, width: size, height: size }) as unknown as ImageData

beforeEach(() => {
  vi.stubGlobal('Path2D', class {})
})
afterEach(() => vi.unstubAllGlobals())

describe('PNG do mapa (AC-F4-11)', () => {
  it('o lado da imagem é o mapa 1024² vezes a escala', () => {
    expect(EXPORT_SCALES.map(exportImageSize)).toEqual([1024, 2048, 4096])
  })

  it('o terreno precisa ter o tamanho da escala', () => {
    const { ctx } = fakeCtx()
    expect(() => drawMapImage(ctx, { scale: 2, terrainRgba: rgba(1024), decor: null, pins: null }, imageData)).toThrow(/2048/)
  })

  it('desenha o terreno, depois os ícones com o pé na posição, na escala', () => {
    const { ctx, calls, of } = fakeCtx()
    const sheet = {} as CanvasImageSource
    const icons = decor([
      { u: 0.25, v: 0.5, kind: DECOR.peak },
      { u: 0.5, v: 0.5, kind: 250 }, // sem desenho: fica de fora, como no editor
      { u: 0.75, v: 0.25, kind: DECOR.tree },
    ])
    const terrain = rgba(2048)
    drawMapImage(ctx, { scale: 2, terrainRgba: terrain, decor: { icons, sheet }, pins: null }, imageData)
    expect(calls[0].name).toBe('putImageData')
    expect((calls[0].args[0] as ImageData).data).toBe(terrain)
    const drawn = of('drawImage')
    expect(drawn).toHaveLength(2)
    const k = (DECOR_UNIT / INK_PX) * 2
    const f = inkFrame(DECOR.peak, decorVariant(0.25, 0.5))
    const a = inkAnchor(DECOR.peak)
    expect(drawn[0].args[0]).toBe(sheet)
    expect(drawn[0].args.slice(1, 5)).toEqual([f.x, f.y, f.width, f.height])
    const [x, y, w, h] = drawn[0].args.slice(5) as number[]
    expect(w).toBeCloseTo(f.width * k)
    expect(h).toBeCloseTo(f.height * k)
    // O pé do ícone cai no ponto (u, v) da imagem de 2048 px.
    expect(x + a.x * w).toBeCloseTo(0.25 * 2048)
    expect(y + a.y * h).toBeCloseTo(0.5 * 2048)
  })

  it('sem decoração nem pins, só o terreno', () => {
    const { ctx, calls } = fakeCtx()
    drawMapImage(ctx, { scale: 1, terrainRgba: rgba(1024), decor: null, pins: null }, imageData)
    expect(calls.map((c) => c.name)).toEqual(['putImageData'])
  })

  it('os pins vão na ordem do mapa (de cima para baixo), sem os tipos escondidos, com o rótulo de cada um na escala', () => {
    const { ctx, of } = fakeCtx()
    const list = [pin('sul', 'cidade', 0.5, 0.8, 'Porto Sul'), pin('norte', 'vila', 0.25, 0.2, 'Vila Norte'), pin('npc', 'npc', 0.1, 0.1), pin('sem-nome', 'poi', 0.9, 0.9, '')]
    drawMapImage(ctx, { scale: 4, terrainRgba: rgba(4096), decor: null, pins: { list, hidden: new Set(['npc']), images: new Map() } }, imageData)
    // O pin tem 32 px × a escala de largura (e 1,2× de altura), com a âncora na base central.
    const width = 32 * 4
    const height = width * 1.2
    const moves = of('translate').filter((c) => (c.args[0] as number) > 0 || (c.args[1] as number) > 0)
    expect(moves.slice(0, 3).map((c) => c.args)).toEqual([
      [0.25 * 4096 - width / 2, 0.2 * 4096 - height],
      [0.5 * 4096 - width / 2, 0.8 * 4096 - height],
      [0.9 * 4096 - width / 2, 0.9 * 4096 - height],
    ])
    expect(of('fillText').map((c) => [c.args[0], c.args[1], c.args[2], c.font])).toEqual([
      ['Vila Norte', 0.25 * 4096, 0.2 * 4096 + 5 * 4, labelFont(4)],
      ['Porto Sul', 0.5 * 4096, 0.8 * 4096 + 5 * 4, labelFont(4)],
    ])
    expect(of('strokeText')).toHaveLength(2)
    expect(labelFont(4)).toBe('700 52px Cinzel, serif')
  })

  it('o Personalizado com imagem enviada a desenha no círculo', () => {
    const { ctx, of } = fakeCtx()
    const source = {} as CanvasImageSource
    const custom: Pin = { ...pin('c', 'custom', 0.5, 0.5), icon: { kind: 'image', blobId: 'img' } }
    drawMapImage(ctx, { scale: 1, terrainRgba: rgba(1024), decor: null, pins: { list: [custom], hidden: new Set(), images: new Map([['img', { source, width: 10, height: 20 }]]) } }, imageData)
    expect(of('drawImage').map((c) => c.args[0])).toEqual([source])
  })

  it('os rótulos vão depois de todos os pins: nenhum pin cobre um rótulo', () => {
    const { ctx, calls } = fakeCtx()
    const list = [pin('cima', 'cidade', 0.5, 0.5, 'De Cima'), pin('baixo', 'vila', 0.51, 0.52, 'De Baixo')]
    drawMapImage(ctx, { scale: 2, terrainRgba: rgba(2048), decor: null, pins: { list, hidden: new Set(), images: new Map() } }, imageData)
    const lastPin = calls.map((c) => c.name).lastIndexOf('fill')
    const firstLabel = calls.findIndex((c) => c.name === 'strokeText')
    expect(firstLabel).toBeGreaterThan(lastPin)
    expect(calls.filter((c) => c.name === 'fillText').map((c) => c.args[0])).toEqual(['De Cima', 'De Baixo'])
  })

  it('as estradas vão entre a decoração e os pins, com os traços de cada tipo na escala (AC-F5-03)', () => {
    const { ctx, calls, of } = fakeCtx()
    const a = pin('a', 'cidade', 0.5, 0.5)
    const road = (id: string, kind: Road['kind']): Road => ({ id, name: id, kind, points: [{ u: 0.1, v: 0.1 }, { u: 0.2, v: 0.3 }, { u: 0.4, v: 0.4 }], from: 'a' })
    const list = [road('r', 'road'), road('t', 'trail'), road('s', 'sea')]
    drawMapImage(ctx, { scale: 2, terrainRgba: rgba(2048), decor: null, pins: { list: [a], hidden: new Set(), images: new Map() }, roads: { list, pins: [a] } }, imageData)
    const strokes = of('stroke')
      .slice(0, 4)
      .map((c) => [c.strokeStyle, c.lineWidth])
    expect(strokes).toEqual([
      ['#f5eacb', 14],
      ['#7a5230', 7],
      ['#7a5230', 6.4],
      ['#ffffff', 5],
    ])
    expect(of('setLineDash').map((c) => c.args[0])).toEqual([[], [], [2, 14], [20, 16]])
    // A ponta ligada fica no pin: a curva começa em (0,5; 0,5) × 2048.
    expect(of('moveTo')[0].args).toEqual([1024, 1024])
    // Duas cúbicas por estrada (3 pontos), e os pins depois de todas.
    expect(of('bezierCurveTo')).toHaveLength(8)
    const lastRoad = calls.map((c) => c.name).lastIndexOf('bezierCurveTo')
    expect(calls.findIndex((c) => c.name === 'translate')).toBeGreaterThan(lastRoad)
  })

  it('sem as estradas, nada de traço de estrada', () => {
    const { ctx, of } = fakeCtx()
    drawMapImage(ctx, { scale: 1, terrainRgba: rgba(1024), decor: null, pins: null, roads: null }, imageData)
    expect(of('bezierCurveTo')).toHaveLength(0)
  })
})
