import { WORLD_SIZE } from '../../render/camera'
import type { WorldRect } from '../../state/cameraStore'
import { MINIMAP_HEIGHT, MINIMAP_WIDTH, ZOOM_FULL_FROM } from './bottomBarLayout'
import { formatKm } from './measure'

/**
 * Matemática do minimapa e do controle de zoom (TS puro, sem React): escala, porcentagem e a
 * correspondência entre o minimapa e o mundo.
 */

/** Largura da barra de escala, em px. */
export const SCALE_BAR_PX = 32
/**
 * Abaixo desta largura da área livre (450 px), o controle de zoom esconde a escala e a
 * porcentagem: o zoom completo não cabe ao lado do minimapa (`ZOOM_FULL_FROM`).
 */
export const COMPACT_ZOOM_BELOW_PX = ZOOM_FULL_FROM
/** Tamanho do minimapa (160 × 100): mora com as outras medidas da linha inferior. */
export { MINIMAP_HEIGHT, MINIMAP_WIDTH }

/**
 * Texto da barra de escala: quantos km cabem em `SCALE_BAR_PX` px no zoom atual. `scale` é px por
 * unidade do mundo, e o mundo tem `sizeKm` de largura. De 10 km para cima, inteiro; abaixo, uma
 * casa decimal (com vírgula).
 */
export function scaleLabel(scale: number, sizeKm: number, world = WORLD_SIZE): string {
  return formatKm((SCALE_BAR_PX * sizeKm) / (world * scale))
}

/** Porcentagem do zoom relativo (1 = 100% = mapa inteiro na área livre). */
export function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}

/** Se o controle de zoom mostra a escala e a porcentagem (área livre de 450 px ou mais). */
export function showsZoomDetails(areaWidth: number): boolean {
  return areaWidth >= COMPACT_ZOOM_BELOW_PX
}

/** Onde o mapa (quadrado) fica no minimapa: inteiro e centrado, com o fundo do oceano dos lados. */
export function minimapMapBox(world = WORLD_SIZE) {
  const size = Math.min(MINIMAP_WIDTH, MINIMAP_HEIGHT)
  return { x: (MINIMAP_WIDTH - size) / 2, y: (MINIMAP_HEIGHT - size) / 2, size, k: size / world }
}

/** O retângulo da área visível no minimapa (px), cortado no quadrado do mapa. */
export function minimapViewRect(view: WorldRect, world = WORLD_SIZE): WorldRect {
  const box = minimapMapBox(world)
  const x0 = Math.max(0, view.x)
  const y0 = Math.max(0, view.y)
  const x1 = Math.min(world, view.x + view.width)
  const y1 = Math.min(world, view.y + view.height)
  return {
    x: box.x + x0 * box.k,
    y: box.y + y0 * box.k,
    width: Math.max(0, x1 - x0) * box.k,
    height: Math.max(0, y1 - y0) * box.k,
  }
}

/** Centro da área visível no minimapa (px), sem corte. */
export function minimapViewCenter(view: WorldRect, world = WORLD_SIZE): { x: number; y: number } {
  const box = minimapMapBox(world)
  return { x: box.x + (view.x + view.width / 2) * box.k, y: box.y + (view.y + view.height / 2) * box.k }
}

/** Ponto do mundo sob o ponto (px) do minimapa. */
export function minimapToWorld(px: number, py: number, world = WORLD_SIZE): { x: number; y: number } {
  const box = minimapMapBox(world)
  return { x: (px - box.x) / box.k, y: (py - box.y) / box.k }
}

/** Passo das setas com o foco no minimapa, em px do minimapa. */
export const MINIMAP_KEY_STEP_PX = 10

/** O passo das setas no minimapa, em unidades do mundo (10 px do minimapa = 1/10 do mapa). */
export function minimapKeyStep(world = WORLD_SIZE): number {
  return MINIMAP_KEY_STEP_PX / minimapMapBox(world).k
}

/** Se o ponto (px) do minimapa está dentro do retângulo. */
export function inRect(px: number, py: number, r: WorldRect): boolean {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height
}
