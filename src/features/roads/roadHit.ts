import type { Road } from '../../persistence/types'
import { distanceToPolyline, roadLine, type UV, type XY } from '../../render/layers/roadMath'
import type { CameraStore } from '../../state/cameraStore'
import type { PinsStore } from '../../state/pinsStore'
import type { RoadsStore } from '../../state/roadsStore'
import type { UiStore } from '../../state/uiStore'
import { screenToWorld } from '../map/measure'

/**
 * Quantos px na tela, da linha do meio da estrada, o clique ainda acerta (AC-F5-06): mais que a
 * metade do traço mais largo (a estrada, 7 px), para a estrada fina não exigir pontaria.
 */
export const ROAD_HIT_PX = 10

/** Px na tela entre dois pontos da curva amostrada para o clique. */
const HIT_SAMPLE_PX = 3

/**
 * A estrada sob o ponto (px CSS da área do mapa), como a `RoadLayer` a desenha: a curva suavizada,
 * com as pontas nos pins ligados. A mais próxima da linha do meio, até `ROAD_HIT_PX`; empate, a de
 * cima (a última da lista). Com "Estradas" desligada em Camadas, nenhuma.
 */
export function roadAt(
  x: number,
  y: number,
  roads: readonly Road[],
  pinPos: (id: string) => UV | undefined,
  cam: { scale: number; view: { x: number; y: number }; origin: { x: number; y: number } },
): Road | null {
  if (cam.scale <= 0) return null
  const p: XY = screenToWorld(x, y, cam)
  const reach = ROAD_HIT_PX / cam.scale
  let best: Road | null = null
  let bestDist = Infinity
  for (const road of roads) {
    const line = roadLine(road, pinPos, HIT_SAMPLE_PX / cam.scale)
    if (line.length < 2) continue
    const d = distanceToPolyline(p, line)
    if (d <= reach && d <= bestDist) {
      best = road
      bestDist = d
    }
  }
  return best
}

/** O `roadAt` sobre os stores do editor (o `PinTool` o usa no clique em Navegar). */
export function createRoadHit(ui: UiStore, pins: PinsStore, roads: RoadsStore, camera: CameraStore) {
  return (x: number, y: number): Road | null => {
    if (!ui.getState().layers.roads || !camera.getState().ready) return null
    const byId = new Map(pins.getState().pins.map((p) => [p.id, p.pos]))
    return roadAt(x, y, roads.getState().roads, (id) => byId.get(id), camera.getState())
  }
}
