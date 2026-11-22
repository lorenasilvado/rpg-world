import { WORLD_SIZE } from '../camera'
import { PIN_SIZE_PX, PIN_VIEWBOX } from '../style/pinShapes'

/**
 * Matemática dos pins no mapa (pins.md, AC-F3-01 a AC-F3-03), em TS puro: a conversão entre a tela,
 * o mundo e as coordenadas (u, v) de 0 a 1 que o pin guarda, o pin sob o ponteiro, a ordem de
 * desenho, quando o rótulo aparece e as animações do quique e da pulsação.
 */

/** Posição salva de um pin: de 0 a 1 nos dois eixos do mapa (RNF-9). */
export type PinPos = { u: number; v: number }

/** A câmera vista pela interface (`cameraStore`): escala, parte visível do mundo e origem da área livre. */
export type PinCamera = { scale: number; view: { x: number; y: number }; origin: { x: number; y: number } }

/** O que a matemática usa de um pin. */
export type PinLike = { id: string; pos: PinPos }

/** Zoom a partir do qual o rótulo com o nome aparece em todos os pins. */
export const LABEL_ZOOM = 1.5

/** Altura do pin na tela, em px CSS (a largura é `PIN_SIZE_PX`). */
export const PIN_HEIGHT_PX = (PIN_SIZE_PX * PIN_VIEWBOX.height) / PIN_VIEWBOX.width

/** Escala do pin em hover e selecionado. */
export const PIN_HOVER_SCALE = 1.1

/** Duração do quique do pin novo (design-system.md → Movimento: 420–460 ms). */
export const PIN_DROP_MS = 460

/** Período da pulsação do pin selecionado. */
export const PIN_PULSE_MS = 1600

/** Ponto do mundo (0–1024) de uma posição (u, v). */
export function pinToWorld(pos: PinPos, world = WORLD_SIZE): { x: number; y: number } {
  return { x: pos.u * world, y: pos.v * world }
}

/** Posição (u, v) do ponto do mundo. */
export function worldToPin(p: { x: number; y: number }, world = WORLD_SIZE): PinPos {
  return { u: p.x / world, v: p.y / world }
}

/** Ponto (px CSS) da área do mapa sobre a posição (u, v), pela câmera. */
export function pinToScreen(pos: PinPos, cam: PinCamera, world = WORLD_SIZE): { x: number; y: number } {
  const p = pinToWorld(pos, world)
  return { x: cam.origin.x + (p.x - cam.view.x) * cam.scale, y: cam.origin.y + (p.y - cam.view.y) * cam.scale }
}

/**
 * Posição (u, v) sob o ponto (px CSS) da área do mapa, pela câmera; `null` fora do mapa (no fundo
 * do canvas), onde não há pin.
 */
export function screenToPin(px: number, py: number, cam: PinCamera, world = WORLD_SIZE): PinPos | null {
  const pos = worldToPin({ x: cam.view.x + (px - cam.origin.x) / cam.scale, y: cam.view.y + (py - cam.origin.y) / cam.scale }, world)
  return pos.u < 0 || pos.u > 1 || pos.v < 0 || pos.v > 1 ? null : pos
}

/**
 * Ordem de desenho, de baixo para cima: os pins mais ao norte primeiro (o de baixo cobre o de cima,
 * como a decoração), depois o pin sob o mouse e, por último, o selecionado.
 */
export function drawOrder<T extends PinLike>(pins: readonly T[], selectedId: string | null, hoveredId: string | null): T[] {
  const rank = (p: T) => (p.id === selectedId ? 2 : p.id === hoveredId ? 1 : 0)
  return pins
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.p.pos.v - b.p.pos.v || a.i - b.i)
    .map(({ p }) => p)
}

/**
 * O pin sob o ponto (px CSS) da área do mapa: o desenho do pin (32 × 38,4 px, com a âncora na base
 * central) e, dos que se sobrepõem, o de cima na ordem de desenho. `null` sem pin ali.
 */
export function pinAt<T extends PinLike>(
  px: number,
  py: number,
  pins: readonly T[],
  cam: PinCamera,
  selectedId: string | null = null,
  hoveredId: string | null = null,
): T | null {
  const order = drawOrder(pins, selectedId, hoveredId)
  for (let i = order.length - 1; i >= 0; i--) {
    const p = order[i]
    const s = pinToScreen(p.pos, cam)
    const k = p.id === selectedId || p.id === hoveredId ? PIN_HOVER_SCALE : 1
    const half = (PIN_SIZE_PX / 2) * k
    if (px >= s.x - half && px <= s.x + half && py >= s.y - PIN_HEIGHT_PX * k && py <= s.y) return p
  }
  return null
}

/** O rótulo com o nome aparece a partir do zoom 1,5×, no hover e na seleção. */
export function showLabel(zoom: number, hovered: boolean, selected: boolean): boolean {
  return hovered || selected || zoom >= LABEL_ZOOM - 1e-9
}

/** Curva `cubic-bezier(x1, y1, x2, y2)` do CSS (com x crescente, como as do design system). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bez = (u: number, p1: number, p2: number) => 3 * (1 - u) * (1 - u) * u * p1 + 3 * (1 - u) * u * u * p2 + u * u * u
  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let lo = 0
    let hi = 1
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (bez(mid, x1, x2) < t) lo = mid
      else hi = mid
    }
    return bez((lo + hi) / 2, y1, y2)
  }
}

/** Quadro de uma animação do pin: deslocamento vertical em px, escala em x e em y e opacidade. */
export type PinFrame = { dy: number; sx: number; sy: number; alpha: number }

const REST: PinFrame = { dy: 0, sx: 1, sy: 1, alpha: 1 }

/** Os quadros-chave do quique do pin novo (o `pinDrop` do protótipo): cai, amassa, sobe um pouco e assenta. */
const DROP_KEYS: readonly (PinFrame & { at: number })[] = [
  { at: 0, dy: -36, sx: 0.9, sy: 0.9, alpha: 0 },
  { at: 0.55, dy: 0, sx: 1.06, sy: 0.9, alpha: 1 },
  { at: 0.75, dy: -6, sx: 0.98, sy: 1.03, alpha: 1 },
  { at: 1, ...REST },
]

/** `cubic-bezier(.3, 1.6, .5, 1)`, a curva do quique (design-system.md → Movimento), em cada trecho. */
const dropEase = cubicBezier(0.3, 1.6, 0.5, 1)

/** O quique do pin novo `ms` depois de criado (a partir de `PIN_DROP_MS`, parado). */
export function dropFrame(ms: number): PinFrame {
  const t = ms / PIN_DROP_MS
  if (t >= 1) return REST
  if (t <= 0) return { ...DROP_KEYS[0] }
  let i = 0
  while (DROP_KEYS[i + 1].at < t) i++
  const a = DROP_KEYS[i]
  const b = DROP_KEYS[i + 1]
  const k = dropEase((t - a.at) / (b.at - a.at))
  const mix = (x: number, y: number) => x + (y - x) * k
  return { dy: mix(a.dy, b.dy), sx: mix(a.sx, b.sx), sy: mix(a.sy, b.sy), alpha: Math.min(1, Math.max(0, mix(a.alpha, b.alpha))) }
}

/** `ease-out` do CSS. */
const pulseEase = cubicBezier(0, 0, 0.58, 1)

/** A onda da pulsação do selecionado `ms` depois de selecionado: cresce de 0,7 a 1,8× e some, em laço de 1,6 s. */
export function pulseFrame(ms: number): { scale: number; alpha: number } {
  const k = pulseEase((((ms % PIN_PULSE_MS) + PIN_PULSE_MS) % PIN_PULSE_MS) / PIN_PULSE_MS)
  return { scale: 0.7 + 1.1 * k, alpha: 0.9 * (1 - k) }
}
