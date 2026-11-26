import { createPinGrouper, groupAt, type PinGroup } from '../../render/layers/pinGroups'
import { pinAt } from '../../render/layers/pinMath'
import type { Pin } from '../../persistence/types'
import type { CameraStore } from '../../state/cameraStore'
import type { PinsStore } from '../../state/pinsStore'
import type { UiStore } from '../../state/uiStore'

/**
 * O clique nos pins à vista, como o renderer os desenha (pins.md, AC-F3-14, AC-F3-15): os dos tipos
 * desligados em Camadas e os que estão num grupo não contam. `pinAt` e `groupAt` recebem o ponto em
 * px CSS da área do mapa. Serve ao `PinTool` e à ferramenta Desenhar estrada (começar num pin).
 */
export function createVisiblePins(ui: UiStore, pins: PinsStore, camera: CameraStore) {
  const grouper = createPinGrouper<Pin>()
  const visible = () => {
    const s = pins.getState()
    const cam = camera.getState()
    const g = grouper(s.pins, ui.getState().layers, cam.scale, cam.zoom, s.selectedId, s.dragging?.id ?? null)
    return { singles: g.grouped.size ? g.shown.filter((p) => !g.grouped.has(p.id)) : g.shown, groups: g.groups }
  }
  return {
    pinAt(x: number, y: number): Pin | null {
      const s = pins.getState()
      return pinAt(x, y, visible().singles, camera.getState(), s.selectedId, s.hoveredId)
    },
    groupAt(x: number, y: number): PinGroup | null {
      return groupAt(x, y, visible().groups, camera.getState())
    },
  }
}
