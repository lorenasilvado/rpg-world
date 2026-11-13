/**
 * Matemática da câmera do mapa (TS puro, sem Pixi), usada pelo `MapCamera`.
 *
 * O mundo é um quadrado de `WORLD_SIZE` unidades (o campo 1024² tem uma célula por unidade; a
 * prévia 256² é esticada no mesmo quadrado). A transformação da câmera é a do pixi-viewport:
 * ponto na tela = (x, y) + ponto no mundo × scale. O zoom exibido é relativo: 1× é o mapa inteiro
 * na área livre (a tela menos os painéis fixos), que é o enquadramento ao abrir e ao centralizar.
 */

export const WORLD_SIZE = 1024
export const MIN_ZOOM = 0.4
export const MAX_ZOOM = 4
/** Fator de zoom de cada toque em + e −. */
export const KEY_ZOOM_STEP = 1.25
/** Passo de pan de cada toque nas setas e no WASD, em fração do menor lado da área livre. */
export const KEY_PAN_STEP = 0.2
/** Duração do deslizamento da câmera (design-system.md → Movimento). */
export const CAMERA_TWEEN_MS = 350

export type Area = { x: number; y: number; width: number; height: number }
export type Transform = { x: number; y: number; scale: number }
/** Câmera pelo ponto do mundo no centro da área livre e pela escala. */
export type View = { cx: number; cy: number; scale: number }

/** Escala do zoom 1×: o mapa inteiro cabe na área livre. */
export function fitScale(area: Area, world = WORLD_SIZE): number {
  return Math.max(1e-6, Math.min(area.width, area.height) / world)
}

export function zoomLimits(area: Area, world = WORLD_SIZE): { min: number; max: number } {
  const fit = fitScale(area, world)
  return { min: MIN_ZOOM * fit, max: MAX_ZOOM * fit }
}

export function clampScale(scale: number, area: Area, world = WORLD_SIZE): number {
  const { min, max } = zoomLimits(area, world)
  return Math.min(max, Math.max(min, scale))
}

/** Zoom relativo (1 = mapa inteiro na área livre). */
export function relativeZoom(scale: number, area: Area, world = WORLD_SIZE): number {
  return scale / fitScale(area, world)
}

export function toTransform(view: View, area: Area): Transform {
  return {
    scale: view.scale,
    x: area.x + area.width / 2 - view.cx * view.scale,
    y: area.y + area.height / 2 - view.cy * view.scale,
  }
}

export function toView(t: Transform, area: Area): View {
  return {
    scale: t.scale,
    cx: (area.x + area.width / 2 - t.x) / t.scale,
    cy: (area.y + area.height / 2 - t.y) / t.scale,
  }
}

/** O mapa inteiro, centrado na área livre (zoom 1×). */
export function fitView(area: Area, world = WORLD_SIZE): View {
  return { cx: world / 2, cy: world / 2, scale: fitScale(area, world) }
}

/** Um eixo do limite de pan: `pos` é a borda do mapa na tela, `size` o tamanho dele. */
function clampAxis(pos: number, size: number, start: number, length: number): number {
  // Maior que a área livre: o mapa a cobre toda, sem mostrar o fundo além da borda. Menor: o
  // mapa fica inteiro dentro dela.
  const a = start
  const b = start + length - size
  return Math.min(Math.max(a, b), Math.max(Math.min(a, b), pos))
}

/** Limita o pan e o zoom: zoom de 0,4× a 4×, e o mapa não sai da área livre nem mostra o fundo além da borda quando a cobre. */
export function clampTransform(t: Transform, area: Area, world = WORLD_SIZE): Transform {
  const scale = clampScale(t.scale, area, world)
  const size = world * scale
  return {
    scale,
    x: clampAxis(t.x, size, area.x, area.width),
    y: clampAxis(t.y, size, area.y, area.height),
  }
}

/** Zoom por `factor` mantendo parado o ponto do mundo que está em `screen` (ex.: o cursor). */
export function zoomAt(t: Transform, factor: number, screen: { x: number; y: number }, area: Area, world = WORLD_SIZE): Transform {
  const scale = clampScale(t.scale * factor, area, world)
  const wx = (screen.x - t.x) / t.scale
  const wy = (screen.y - t.y) / t.scale
  return { scale, x: screen.x - wx * scale, y: screen.y - wy * scale }
}

/** Retângulo do mapa na tela (x, y, largura, altura), em px CSS. */
export function mapRect(t: Transform, world = WORLD_SIZE): Area {
  return { x: t.x, y: t.y, width: world * t.scale, height: world * t.scale }
}

/** Interpola duas câmeras: o centro em linha reta e a escala na escala logarítmica. */
export function lerpView(a: View, b: View, k: number): View {
  return {
    cx: a.cx + (b.cx - a.cx) * k,
    cy: a.cy + (b.cy - a.cy) * k,
    scale: a.scale * Math.exp(Math.log(b.scale / a.scale) * k),
  }
}

/** `cubic-bezier(.4, 0, .2, 1)`, a curva da câmera no design system. */
export function easeCamera(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const [x1, y1, x2, y2] = [0.4, 0, 0.2, 1]
  const bez = (u: number, p1: number, p2: number) => 3 * (1 - u) * (1 - u) * u * p1 + 3 * (1 - u) * u * u * p2 + u * u * u
  // Acha u com x(u) = t por bisseção (x é crescente nesta curva).
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (bez(mid, x1, x2) < t) lo = mid
    else hi = mid
  }
  return bez((lo + hi) / 2, y1, y2)
}

export type KeyAction = { type: 'pan'; dx: number; dy: number } | { type: 'zoom'; factor: number } | { type: 'center' }

const PAN_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
}

/**
 * Atalho de câmera de uma tecla: setas e WASD fazem pan (a direção é a da câmera: ↑ mostra o
 * norte), + e − fazem zoom e 0 centraliza. WASD vale pela posição da tecla (`code`), em qualquer
 * layout. Com Ctrl, Alt ou Meta não é atalho (Ctrl + 0 e Ctrl + − são o zoom do navegador).
 */
export function keyAction(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey'>): KeyAction | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null
  const pan = PAN_KEYS[e.key] ?? PAN_KEYS[e.code]
  if (pan) return { type: 'pan', dx: pan[0], dy: pan[1] }
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') return { type: 'zoom', factor: KEY_ZOOM_STEP }
  if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') return { type: 'zoom', factor: 1 / KEY_ZOOM_STEP }
  if (e.key === '0' || e.code === 'Numpad0') return { type: 'center' }
  return null
}

const FIELD_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'listbox', 'slider', 'spinbutton', 'menu', 'menuitem', 'option', 'radiogroup', 'tablist', 'tab'])

/** Se o foco está num campo (input, textarea, select, conteúdo editável, slider…): aí o teclado é dele. */
export function isFieldTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false
  const el = target as HTMLElement
  if (el.isContentEditable) return true
  if (el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true
  const role = el.closest('[role]')?.getAttribute('role')
  return role ? FIELD_ROLES.has(role) : false
}
