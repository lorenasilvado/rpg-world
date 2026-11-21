import { WORLD_SIZE } from '../../render/camera'

/**
 * Matemática da ferramenta Medir distância (navegacao.md, AC-F2-13), em TS puro: a distância em km
 * entre dois pontos do mundo, o texto dela, os pontos marcados a cada clique e a dica da ferramenta.
 */

/** Ponto em unidades do mundo (0–1024 nos dois eixos). */
export type WorldPoint = { x: number; y: number }

/**
 * Km com o mesmo arredondamento da barra de escala: de 10 km para cima, inteiro; abaixo, uma casa
 * decimal, com vírgula.
 */
export function formatKm(km: number): string {
  const value = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10
  return `${String(value).replace('.', ',')} km`
}

/** Distância em km entre dois pontos do mundo, que tem `sizeKm` de largura. */
export function distanceKm(a: WorldPoint, b: WorldPoint, sizeKm: number, world = WORLD_SIZE): number {
  return (Math.hypot(b.x - a.x, b.y - a.y) * sizeKm) / world
}

/** O ponto dentro do mapa: um clique fora dele (no fundo) marca a borda mais próxima. */
export function clampToWorld(p: WorldPoint, world = WORLD_SIZE): WorldPoint {
  return { x: Math.min(world, Math.max(0, p.x)), y: Math.min(world, Math.max(0, p.y)) }
}

/** Os pontos depois de um clique: o 1º e o 2º marcam as pontas; com os dois marcados, recomeça. */
export function addMeasurePoint(points: readonly WorldPoint[], p: WorldPoint): WorldPoint[] {
  return points.length >= 2 ? [p] : [...points, p]
}

/** A dica da ferramenta, no topo do mapa. */
export function measureHint(points: readonly WorldPoint[]): string {
  return points.length === 1 ? 'Clique no ponto final' : 'Clique em dois pontos para medir'
}

/** Ponto do mundo sob o ponto (px CSS) da área do mapa, pela câmera. */
export function screenToWorld(
  px: number,
  py: number,
  cam: { scale: number; view: { x: number; y: number }; origin: { x: number; y: number } },
): WorldPoint {
  return { x: cam.view.x + (px - cam.origin.x) / cam.scale, y: cam.view.y + (py - cam.origin.y) / cam.scale }
}

/** Ponto (px CSS) da área do mapa sobre o ponto do mundo, pela câmera. */
export function worldToScreen(
  p: WorldPoint,
  cam: { scale: number; view: { x: number; y: number }; origin: { x: number; y: number } },
): { x: number; y: number } {
  return { x: cam.origin.x + (p.x - cam.view.x) * cam.scale, y: cam.origin.y + (p.y - cam.view.y) * cam.scale }
}
