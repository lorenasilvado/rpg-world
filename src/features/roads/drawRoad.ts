import type { RoadPoint } from '../../persistence/types'
import { curveSegments, type XY } from '../../render/layers/roadMath'

/**
 * O estado da ferramenta Desenhar estrada (estradas.md, AC-F5-04, AC-F5-05), em TS puro: os pontos
 * marcados a cada clique (no mapa, ou num pin), a estrada que eles dão ao terminar, a dica e o duplo
 * clique (ou duplo toque) que termina o desenho.
 */

/** Um ponto do desenho, 0..1 no mapa; `pin`: o ponto é o de um pin clicado. */
export type DraftPoint = { u: number; v: number; pin?: string }

/** A estrada que o desenho dá: os pontos (os do meio com o pin ligado) e os pins ligados às pontas. */
export type RoadDraft = { points: RoadPoint[]; from?: string; to?: string }

/** Até quantos ms entre dois cliques eles são um duplo clique. */
export const DOUBLE_CLICK_MS = 400
/** Até quantos px entre os dois cliques de um duplo clique (com o mouse; o dedo é menos preciso). */
export const DOUBLE_CLICK_PX = 8
export const DOUBLE_TAP_PX = 24

/** Um clique ou toque: o instante (ms) e o ponto da página. */
export type Tap = { t: number; x: number; y: number; touch: boolean }

/** Se `tap` é o segundo clique de um duplo clique, depois de `prev`. */
export function isDoubleTap(prev: Tap | null, tap: Tap): boolean {
  if (!prev || prev.touch !== tap.touch) return false
  const slop = tap.touch ? DOUBLE_TAP_PX : DOUBLE_CLICK_PX
  return tap.t - prev.t <= DOUBLE_CLICK_MS && Math.hypot(tap.x - prev.x, tap.y - prev.y) <= slop
}

/** Os pontos depois de um clique; o mesmo pin (ou o mesmo lugar) duas vezes seguidas não repete o ponto. */
export function addDraftPoint(draft: readonly DraftPoint[], p: DraftPoint): DraftPoint[] {
  const last = draft[draft.length - 1]
  if (last && (p.pin !== undefined ? last.pin === p.pin : last.pin === undefined && last.u === p.u && last.v === p.v)) return [...draft]
  return [...draft, p]
}

/**
 * A estrada do desenho, com 2 pontos ou mais: a ponta num pin fica ligada a ele (`from`, `to`), e
 * um ponto do meio num pin também (`pin` do ponto, AC-F5-17). Menos: `null`.
 */
export function draftToRoad(draft: readonly DraftPoint[]): RoadDraft | null {
  if (draft.length < 2) return null
  const first = draft[0].pin
  const last = draft[draft.length - 1].pin
  return {
    points: draft.map((p, i) => (p.pin !== undefined && i > 0 && i < draft.length - 1 ? { u: p.u, v: p.v, pin: p.pin } : { u: p.u, v: p.v })),
    ...(first !== undefined ? { from: first } : {}),
    ...(last !== undefined ? { to: last } : {}),
  }
}

/** A dica da ferramenta, no topo do mapa. */
export function roadHint(draft: readonly DraftPoint[]): string {
  return draft.length === 0
    ? 'Clique no mapa ou num pin para começar a estrada'
    : 'Clique para adicionar pontos · Enter ou duplo clique termina · Esc cancela'
}

/** O caminho SVG (`d`) da curva suavizada pelos pontos, já em px da tela. */
export function curvePath(points: readonly XY[]): string {
  if (points.length < 2) return ''
  let d = `M${points[0].x} ${points[0].y}`
  for (const s of curveSegments(points)) d += ` C${s.c1.x} ${s.c1.y} ${s.c2.x} ${s.c2.y} ${s.to.x} ${s.to.y}`
  return d
}
