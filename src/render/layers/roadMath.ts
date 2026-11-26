import type { Road, RoadKind } from '../../persistence/types'

/**
 * A matemática das estradas (estradas.md, AC-F5-01), TS puro, sem Pixi: serve à `RoadLayer` do
 * editor e ao PNG (`mapImage.ts`). A estrada passa pelos pontos dela numa curva suavizada
 * (Catmull-Rom, em cúbicas de Bézier, como no protótipo do editor); a ponta ligada a um pin fica na
 * posição dele (`roadPoints`). Os traços de cada tipo de via são os do design system (`ROAD_STROKES`).
 */

export type UV = { u: number; v: number }
export type XY = { x: number; y: number }

/** Uma cúbica de Bézier da curva: os dois pontos de controle e o ponto final (o inicial é o anterior). */
export type CurveSegment = { c1: XY; c2: XY; to: XY }

/** Um traço do tipo de via: cor, largura e tracejado (traço / vão), em px na tela. */
export type RoadStroke = { color: number; width: number; dash?: readonly [number, number] }

/**
 * Os traços de cada tipo de via, de baixo para cima (design-system.md → Traços): estrada 3,5 px
 * `#7A5230` sobre 7 px `#F5EACB`, trilha 3,2 px `#7A5230` pontilhada (1 / 7) e rota marítima 2,5 px
 * `#FFFFFF` tracejada (10 / 8). As pontas e as junções são redondas.
 */
export const ROAD_STROKES: Record<RoadKind, readonly RoadStroke[]> = {
  road: [
    { color: 0xf5eacb, width: 7 },
    { color: 0x7a5230, width: 3.5 },
  ],
  trail: [{ color: 0x7a5230, width: 3.2, dash: [1, 7] }],
  sea: [{ color: 0xffffff, width: 2.5, dash: [10, 8] }],
}

/** A cor do traço como no CSS (`#7a5230`), para o canvas 2D. */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * Os pontos da estrada, com a ponta ligada a um pin (`from`, `to`) na posição dele (`pinPos`; o pin
 * arrastado dá a posição do arrasto). Uma ponta cujo pin não existe fica no ponto dela. O meio do
 * traçado não muda.
 */
export function roadPoints(road: Pick<Road, 'points' | 'from' | 'to'>, pinPos: (id: string) => UV | undefined): UV[] {
  const points = road.points.map((p) => ({ u: p.u, v: p.v }))
  if (points.length === 0) return points
  const a = road.from !== undefined ? pinPos(road.from) : undefined
  const b = road.to !== undefined ? pinPos(road.to) : undefined
  if (a) points[0] = { u: a.u, v: a.v }
  if (b) points[points.length - 1] = { u: b.u, v: b.v }
  return points
}

/**
 * A curva Catmull-Rom pelos pontos, em cúbicas de Bézier: uma por par de pontos seguidos, que passa
 * pelos dois. Nas pontas, o ponto que falta é a própria ponta. Menos de 2 pontos: nenhuma.
 */
export function curveSegments(points: readonly XY[]): CurveSegment[] {
  const out: CurveSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    out.push({
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      to: { x: p2.x, y: p2.y },
    })
  }
  return out
}

/**
 * A curva como polilinha: cada cúbica vira trechos retos de até `step` (nas unidades dos pontos),
 * contando pelo comprimento do polígono de controle (que nunca é menor que o da curva), de 1 a 64
 * trechos por cúbica. Começa no primeiro ponto e termina no último.
 */
export function sampleCurve(points: readonly XY[], step: number): XY[] {
  if (points.length === 0) return []
  const out: XY[] = [{ x: points[0].x, y: points[0].y }]
  let from = points[0]
  for (const seg of curveSegments(points)) {
    const hull = dist(from, seg.c1) + dist(seg.c1, seg.c2) + dist(seg.c2, seg.to)
    const n = Math.min(64, Math.max(1, Math.ceil(hull / step)))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const s = 1 - t
      const a = s * s * s
      const b = 3 * s * s * t
      const c = 3 * s * t * t
      const d = t * t * t
      out.push({ x: a * from.x + b * seg.c1.x + c * seg.c2.x + d * seg.to.x, y: a * from.y + b * seg.c1.y + c * seg.c2.y + d * seg.to.y })
    }
    from = seg.to
  }
  return out
}

function dist(a: XY, b: XY): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * A polilinha cortada em traços de `dash` com vãos de `gap` (as mesmas unidades), a partir do
 * começo: cada traço é uma polilinha própria. O padrão segue pelas dobras, como o `setLineDash` do
 * canvas.
 */
export function dashPolyline(line: readonly XY[], dash: number, gap: number): XY[][] {
  const out: XY[][] = []
  if (line.length < 2 || dash <= 0) return out
  const period = dash + gap
  /** Quanto do período já foi andado (0 a `period`). */
  let phase = 0
  let current: XY[] | null = [{ ...line[0] }]
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]
    const b = line[i]
    const len = dist(a, b)
    let at = 0
    while (at < len) {
      const inDash = phase < dash
      const left = (inDash ? dash : period) - phase
      const take = Math.min(left, len - at)
      at += take
      phase += take
      const p = { x: a.x + ((b.x - a.x) * at) / len, y: a.y + ((b.y - a.y) * at) / len }
      if (inDash) current?.push(p)
      if (phase >= period - 1e-9) phase = 0
      if (inDash && phase >= dash - 1e-9) {
        if (current && current.length > 1) out.push(current)
        current = null
      } else if (!inDash && phase === 0) {
        current = [p]
      }
    }
  }
  if (current && current.length > 1) out.push(current)
  return out
}
