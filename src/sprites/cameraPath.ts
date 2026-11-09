/** Limites de zoom do spike: o exemplo da spec de navegação (o valor final é do M1). */
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 8

/** Zoom do roteiro: do mapa inteiro à vista (todos os sprites na tela) até perto do terreno. */
export const PATH_MIN_ZOOM = 0.5
export const PATH_MAX_ZOOM = 3

const ZOOM_PERIOD_MS = 10_000
const PAN_X_PERIOD_MS = 7_000
const PAN_Y_PERIOD_MS = 4_600
/** Fração do mapa que o centro da câmera percorre para cada lado. */
const PAN_REACH = 0.3

export type CameraState = { x: number; y: number; scale: number }

/**
 * Câmera roteirizada da medição automática: pan e zoom contínuos o tempo todo, iguais em toda
 * máquina. Em t = 0 o zoom é o menor; o zoom é interpolado na escala logarítmica, para a
 * velocidade aparente ser a mesma perto e longe.
 */
export function cameraAt(timeMs: number, world: { width: number; height: number }): CameraState {
  const cycle = 0.5 - 0.5 * Math.cos((2 * Math.PI * timeMs) / ZOOM_PERIOD_MS)
  return {
    x: world.width * (0.5 + PAN_REACH * Math.sin((2 * Math.PI * timeMs) / PAN_X_PERIOD_MS)),
    y: world.height * (0.5 + PAN_REACH * Math.sin((2 * Math.PI * timeMs) / PAN_Y_PERIOD_MS)),
    scale: PATH_MIN_ZOOM * (PATH_MAX_ZOOM / PATH_MIN_ZOOM) ** cycle,
  }
}
