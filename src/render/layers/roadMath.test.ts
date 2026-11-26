import { describe, expect, it } from 'vitest'
import { ROAD_STROKES, cssColor, curveSegments, dashPolyline, distanceToPolyline, polylineLength, roadLengthKm, roadPoints, sampleCurve, strokeOrder, type XY } from './roadMath'

const len = (line: readonly XY[]) => line.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - line[i].x, p.y - line[i].y), 0)

describe('estradas: curva e traços (AC-F5-01)', () => {
  it('os traços seguem o design system', () => {
    expect(ROAD_STROKES.road.map((s) => [cssColor(s.color), s.width, s.dash])).toEqual([
      ['#f5eacb', 7, undefined],
      ['#7a5230', 3.5, undefined],
    ])
    expect(ROAD_STROKES.trail.map((s) => [cssColor(s.color), s.width, s.dash])).toEqual([['#7a5230', 3.2, [1, 7]]])
    expect(ROAD_STROKES.sea.map((s) => [cssColor(s.color), s.width, s.dash])).toEqual([['#ffffff', 2.5, [10, 8]]])
  })

  it('a ponta ligada a um pin fica nele; o meio e a ponta sem pin não mudam', () => {
    const road = { points: [{ u: 0.1, v: 0.1 }, { u: 0.5, v: 0.5 }, { u: 0.9, v: 0.9 }], from: 'a', to: 'sumiu' }
    const pos = new Map([['a', { u: 0.2, v: 0.3 }]])
    expect(roadPoints(road, (id) => pos.get(id))).toEqual([
      { u: 0.2, v: 0.3 },
      { u: 0.5, v: 0.5 },
      { u: 0.9, v: 0.9 },
    ])
    // Não mexe nos pontos da estrada.
    expect(road.points[0]).toEqual({ u: 0.1, v: 0.1 })
  })

  it('a curva Catmull-Rom passa por todos os pontos, uma cúbica por par', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
    ]
    const segs = curveSegments(pts)
    expect(segs.map((s) => s.to)).toEqual(pts.slice(1))
    // Na ponta, o ponto que falta é a própria ponta: o controle sai na direção do vizinho.
    expect(segs[0].c1).toEqual({ x: 10 / 6, y: 0 })
    // No meio, a tangente é a do vizinho anterior ao seguinte (de (0,0) a (10,10)).
    expect(segs[0].c2).toEqual({ x: 10 - 10 / 6, y: -10 / 6 })
    expect(curveSegments([{ x: 1, y: 1 }])).toEqual([])
  })

  it('a curva amostrada começa e termina nas pontas, com trechos curtos', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    const line = sampleCurve(pts, 2)
    expect(line[0]).toEqual({ x: 0, y: 0 })
    expect(line.at(-1)).toEqual({ x: 100, y: 100 })
    for (let i = 1; i < line.length; i++) expect(Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y)).toBeLessThanOrEqual(2.5)
    // Suavizada: passa pelo canto (100, 0) sem fazer um bico.
    expect(line.some((p) => p.x === 100 && p.y === 0)).toBe(true)
  })

  it('o tracejado corta a linha em traços e vãos, seguindo pelas dobras', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 25, y: 0 },
      { x: 25, y: 11 },
    ]
    const dashes = dashPolyline(line, 10, 8)
    // 36 de linha: traço 0–10, vão, traço 18–28 (que dobra o canto em 25), vão, traço 36.
    expect(dashes.map(len).map((n) => Math.round(n * 1000) / 1000)).toEqual([10, 10])
    expect(dashes[1][0]).toEqual({ x: 18, y: 0 })
    expect(dashes[1]).toContainEqual({ x: 25, y: 0 })
    expect(dashes[1].at(-1)).toEqual({ x: 25, y: 3 })
    expect(dashPolyline([{ x: 0, y: 0 }], 1, 7)).toEqual([])
  })

  it('nos cruzamentos, os contornos de todas as estradas vão antes dos traços de cima', () => {
    const order = strokeOrder([{ kind: 'road' as const }, { kind: 'trail' as const }, { kind: 'road' as const }])
    expect(order.map(({ stroke }) => cssColor(stroke.color) + '/' + stroke.width)).toEqual(['#f5eacb/7', '#f5eacb/7', '#7a5230/3.5', '#7a5230/3.2', '#7a5230/3.5'])
  })


  it('o comprimento e a distância até a polilinha', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
    ]
    expect(polylineLength(line)).toBe(70)
    expect(distanceToPolyline({ x: 10, y: 5 }, line)).toBe(5)
    expect(distanceToPolyline({ x: 35, y: 20 }, line)).toBe(5)
    expect(distanceToPolyline({ x: -3, y: -4 }, line)).toBe(5)
    expect(distanceToPolyline({ x: 1, y: 1 }, [])).toBe(Infinity)
  })

  it('o comprimento da estrada em km segue a curva e as pontas nos pins (AC-F5-06)', () => {
    // Reta de 0,25 do mapa num mundo de 800 km: 200 km.
    const straight = { points: [{ u: 0.25, v: 0.5 }, { u: 0.5, v: 0.5 }] }
    expect(roadLengthKm(straight, () => undefined, 800)).toBeCloseTo(200, 6)
    // A ponta ligada ao pin fica na posição dele.
    const linked = { ...straight, to: 'p' }
    expect(roadLengthKm(linked, (id) => (id === 'p' ? { u: 0.75, v: 0.5 } : undefined), 800)).toBeCloseTo(400, 6)
    expect(roadLengthKm({ points: [{ u: 0.1, v: 0.1 }] }, () => undefined, 800)).toBe(0)
  })
})
