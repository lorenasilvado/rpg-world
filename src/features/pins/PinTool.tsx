import { useEffect } from 'react'
import { inDialog, isFieldTarget } from '../../render/camera'
import { pinAt, screenToPin } from '../../render/layers/pinMath'
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
 * Os cliques nos pins (pins.md, AC-F3-01 e AC-F3-03), sem desenho: o mapa é do renderer. Um clique
 * (o ponteiro anda até `CLICK_SLOP_PX`; mais que isso é pan) num pin o seleciona, com Navegar ou
 * Adicionar pin. Com Adicionar pin, um clique no mapa fora dos pins cria um pin ali (`addPin`), que
 * já fica selecionado, e a ferramenta volta para Navegar. Com Medir distância, os cliques são da
 * medida. O mouse sobre um pin o marca em `hoveredId` (o renderer o aumenta e mostra o nome).
 *
 * Esc fecha o drawer (tira a seleção); sem pin selecionado, com Adicionar pin, volta para Navegar.
 * As teclas seguem as exceções dos atalhos do mapa (foco num campo, dentro de um modal), e nada
 * vale com `disabled` (painel sobreposto aberto no celular).
 */
export function PinTool({ ui, pins, camera, disabled }: { ui: UiStore; pins: PinsStore; camera: CameraStore; disabled: boolean }) {
  useEffect(() => {
    if (disabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isFieldTarget(e.target) || inDialog(e.target)) return
      if (pins.getState().selectedId !== null) {
        e.preventDefault()
        pins.getState().select(null)
      } else if (ui.getState().tool === 'pin') {
        e.preventDefault()
        ui.getState().setTool('nav')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ui, pins, disabled])

  useEffect(() => {
    if (disabled) return
    let press: { id: number; x: number; y: number } | null = null
    const down = new Set<number>()
    const local = (e: PointerEvent, map: HTMLElement) => {
      const rect = map.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const under = (x: number, y: number) => {
      const s = pins.getState()
      return pinAt(x, y, s.pins, camera.getState(), s.selectedId, s.hoveredId)
    }
    const onDown = (e: PointerEvent) => {
      if (!mapUnder(e.target)) return
      down.add(e.pointerId)
      press = down.size === 1 && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      down.delete(e.pointerId)
      const p = press
      if (!p || p.id !== e.pointerId) return
      press = null
      const map = mapUnder(e.target) ?? mapUnder(document.elementFromPoint?.(e.clientX, e.clientY) ?? null)
      const tool = ui.getState().tool
      if (!map || tool === 'measure' || Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_SLOP_PX || !camera.getState().ready) return
      const at = local(e, map)
      const hit = under(at.x, at.y)
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
      if (press?.id === e.pointerId) press = null
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const map = mapUnder(e.target)
      const hit = map && camera.getState().ready && ui.getState().tool !== 'measure' ? under(local(e, map).x, local(e, map).y) : null
      pins.getState().setHovered(hit ? hit.id : null)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('pointermove', onMove)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('pointermove', onMove)
      pins.getState().setHovered(null)
    }
  }, [ui, pins, camera, disabled])

  return null
}
