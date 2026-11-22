import { useEffect } from 'react'
import { inDialog, isFieldTarget } from '../../render/camera'
import { pinAt, pinToScreen, screenToPin, screenToPinClamped } from '../../render/layers/pinMath'
import type { CameraStore } from '../../state/cameraStore'
import type { PinsStore } from '../../state/pinsStore'
import type { UiStore } from '../../state/uiStore'
import { CLICK_SLOP_PX } from '../map/MeasureTool'

/** O elemento da área do mapa sob o evento (`null` fora dela: painéis, barras, minimapa). */
function mapUnder(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof (target as Element).closest !== 'function') return null
  return (target as Element).closest<HTMLElement>('[data-testid="map"]')
}

/**
 * Os cliques nos pins (pins.md, AC-F3-01, AC-F3-03 a AC-F3-05), sem desenho: o mapa é do renderer. Um
 * clique (o ponteiro anda até `CLICK_SLOP_PX`; mais que isso é pan) num pin o seleciona, com Navegar
 * ou Adicionar pin. Com Adicionar pin, um clique no mapa fora dos pins cria um pin ali (`addPin`), que
 * já fica selecionado, e a ferramenta volta para Navegar. Com Medir distância, os cliques são da
 * medida. O mouse sobre um pin o marca em `hoveredId` (o renderer o aumenta e mostra o nome).
 *
 * Apertar num pin e andar mais que `CLICK_SLOP_PX` o arrasta (`dragTo`), com o ponto onde ele foi
 * pego preso ao ponteiro, e soltar o deixa ali (`endDrag`): a posição fica presa entre 0 e 1. O
 * aperto num pin não chega ao canvas (é ouvido na captura, antes dele), então a câmera não faz pan.
 * Esc, um segundo dedo ou o `pointercancel` devolvem o pin ao lugar. A seleção não muda no arrasto.
 *
 * Esc fecha o drawer (tira a seleção); sem pin selecionado, com Adicionar pin, volta para Navegar.
 * Delete exclui o pin selecionado (`onDelete`), sem confirmação. As teclas seguem as exceções dos
 * atalhos do mapa (foco num campo, dentro de um modal), e nada vale com `disabled` (painel sobreposto
 * aberto no celular).
 */
export function PinTool({
  ui,
  pins,
  camera,
  disabled,
  onDelete,
}: {
  ui: UiStore
  pins: PinsStore
  camera: CameraStore
  disabled: boolean
  /** Exclui o pin (Delete): quem o recebe mostra o toast "Pin excluído". */
  onDelete?: (id: string) => void
}) {
  useEffect(() => {
    if (disabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isFieldTarget(e.target) || inDialog(e.target)) return
      if (e.key === 'Delete') {
        const id = pins.getState().selectedId
        if (id === null || !onDelete || e.ctrlKey || e.altKey || e.metaKey || pins.getState().dragging) return
        e.preventDefault()
        onDelete(id)
        return
      }
      if (e.key !== 'Escape') return
      if (pins.getState().dragging) {
        e.preventDefault()
        pins.getState().endDrag(false)
      } else if (pins.getState().selectedId !== null) {
        e.preventDefault()
        pins.getState().select(null)
      } else if (ui.getState().tool === 'pin') {
        e.preventDefault()
        ui.getState().setTool('nav')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ui, pins, disabled, onDelete])

  useEffect(() => {
    if (disabled) return
    /** O aperto em curso: onde começou e, se foi num pin, qual e a distância do ponteiro à âncora dele. */
    let press: { id: number; x: number; y: number; pin: { id: string; dx: number; dy: number } | null; dragging: boolean } | null = null
    const down = new Set<number>()
    const local = (e: PointerEvent, map: HTMLElement) => {
      const rect = map.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const under = (x: number, y: number) => {
      const s = pins.getState()
      return pinAt(x, y, s.pins, camera.getState(), s.selectedId, s.hoveredId)
    }
    const cancelDrag = () => {
      if (press?.dragging) pins.getState().endDrag(false)
      press = null
    }
    const onDown = (e: PointerEvent) => {
      const map = mapUnder(e.target)
      if (!map) return
      down.add(e.pointerId)
      if (down.size > 1) {
        // Um segundo dedo (pinça): o pin volta, e a câmera fica com o gesto.
        cancelDrag()
        return
      }
      press = e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY, pin: null, dragging: false } : null
      if (!press || ui.getState().tool === 'measure' || !camera.getState().ready) return
      const at = local(e, map)
      const hit = under(at.x, at.y)
      if (!hit) return
      const anchor = pinToScreen(hit.pos, camera.getState())
      press.pin = { id: hit.id, dx: at.x - anchor.x, dy: at.y - anchor.y }
      // O aperto é do pin: o canvas (e a câmera) não o recebe.
      e.stopPropagation()
    }
    const onUp = (e: PointerEvent) => {
      down.delete(e.pointerId)
      const p = press
      if (!p || p.id !== e.pointerId) return
      press = null
      if (p.dragging) {
        pins.getState().endDrag(true)
        return
      }
      const map = mapUnder(e.target) ?? mapUnder(document.elementFromPoint?.(e.clientX, e.clientY) ?? null)
      const tool = ui.getState().tool
      if (!map || tool === 'measure' || Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_SLOP_PX || !camera.getState().ready) return
      const at = local(e, map)
      const hit = p.pin ? pins.getState().pins.find((x) => x.id === p.pin?.id) : under(at.x, at.y)
      if (hit) {
        pins.getState().select(hit.id)
        return
      }
      if (tool !== 'pin') return
      const pos = screenToPin(at.x, at.y, camera.getState())
      if (!pos) return
      pins.getState().addPin(pos)
      ui.getState().setTool('nav')
    }
    const onCancel = (e: PointerEvent) => {
      down.delete(e.pointerId)
      if (press?.id === e.pointerId) cancelDrag()
    }
    const onMove = (e: PointerEvent) => {
      const p = press
      if (p?.pin && p.id === e.pointerId) {
        if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) <= CLICK_SLOP_PX) return
        const map = document.querySelector<HTMLElement>('[data-testid="map"]')
        if (!map) return
        p.dragging = true
        const at = local(e, map)
        pins.getState().dragTo(p.pin.id, screenToPinClamped(at.x - p.pin.dx, at.y - p.pin.dy, camera.getState()))
        return
      }
      if (e.pointerType === 'touch' || pins.getState().dragging) return
      const map = mapUnder(e.target)
      const hit = map && camera.getState().ready && ui.getState().tool !== 'measure' ? under(local(e, map).x, local(e, map).y) : null
      pins.getState().setHovered(hit ? hit.id : null)
    }
    // Na captura: o aperto num pin para aqui, antes do canvas.
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('pointermove', onMove)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('pointermove', onMove)
      if (press?.dragging) pins.getState().endDrag(false)
      pins.getState().setHovered(null)
    }
  }, [ui, pins, camera, disabled])

  return null
}
