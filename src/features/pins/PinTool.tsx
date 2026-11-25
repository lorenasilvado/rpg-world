import { useEffect } from 'react'
import { inDialog, isFieldTarget } from '../../render/camera'
import { GROUP_FOCUS_ZOOM, createPinGrouper, groupAt } from '../../render/layers/pinGroups'
import { pinAt, pinToScreen, screenToPin, screenToPinClamped } from '../../render/layers/pinMath'
import type { Pin } from '../../persistence/types'
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
 * aperto num pin é ouvido na captura, antes do canvas, e segura o pan da câmera (`holdPan`) até
 * soltar; o evento segue, e o "clique fora" dos popovers e menus continua valendo.
 * Esc, um segundo dedo ou o `pointercancel` devolvem o pin ao lugar. A seleção não muda no arrasto.
 *
 * Só os pins à vista contam: os dos tipos desligados em Camadas (AC-F3-15) e os que estão num grupo
 * (zoom abaixo de 0,8×, AC-F3-14) não recebem clique nem hover. Um clique num grupo (com Navegar ou
 * Adicionar pin) leva a câmera ao ponto médio dele, no zoom 1,3× (`focusOn`), sem criar pin; com o
 * mouse sobre um grupo, `groupHovered` fica ligado (o cursor é a lupa). Com o mouse parado, o hover
 * é refeito quando a câmera ou as camadas mudam.
 *
 * Esc fecha o drawer (tira a seleção); sem pin selecionado, com Adicionar pin, volta para Navegar.
 * Delete ou Backspace exclui o pin selecionado (`onDelete`), sem confirmação. As teclas seguem as exceções dos
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
      // Delete, ou Backspace (a tecla "delete" do notebook Mac).
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Com o foco no drawer (um chip de tag, uma aba, o rodapé), a tecla não exclui o pin: um
        // Backspace num chip não pode apagar o pin inteiro.
        if (inPinDrawer(e.target)) return
        const id = pins.getState().selectedId
        if (id === null || !onDelete || e.ctrlKey || e.altKey || e.metaKey || pins.getState().dragging) return
        e.preventDefault()
        onDelete(id)
        return
      }
      if (e.key !== 'Escape') return
      // O Esc no meio do arrasto é do arrasto (o efeito do ponteiro, na captura).
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
    const grouper = createPinGrouper<Pin>()
    /** Os pins soltos à vista e os grupos, como o renderer os desenha. */
    const visible = () => {
      const s = pins.getState()
      const cam = camera.getState()
      const g = grouper(s.pins, ui.getState().layers, cam.scale, cam.zoom, s.selectedId, s.dragging?.id ?? null)
      return { singles: g.grouped.size ? g.shown.filter((p) => !g.grouped.has(p.id)) : g.shown, groups: g.groups }
    }
    const under = (x: number, y: number) => {
      const s = pins.getState()
      return pinAt(x, y, visible().singles, camera.getState(), s.selectedId, s.hoveredId)
    }
    const groupUnder = (x: number, y: number) => groupAt(x, y, visible().groups, camera.getState())
    /** O pan da câmera está seguro por um aperto num pin. */
    let panHeld = false
    const holdPan = (held: boolean) => {
      if (panHeld === held) return
      panHeld = held
      camera.getState().controls?.holdPan?.(held)
    }
    const cancelDrag = () => {
      if (press?.dragging) pins.getState().endDrag(false)
      press = null
      holdPan(false)
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
      // O aperto é do pin: a câmera não faz pan até soltar.
      holdPan(true)
    }
    const onUp = (e: PointerEvent) => {
      down.delete(e.pointerId)
      const p = press
      if (!p || p.id !== e.pointerId) return
      press = null
      holdPan(false)
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
      const group = groupUnder(at.x, at.y)
      if (group) {
        camera.getState().controls?.focusOn(group.x, group.y, GROUP_FOCUS_ZOOM)
        pins.getState().setGroupHovered(false)
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
    // Esc no meio do arrasto devolve o pin e encerra o aperto: mexer depois não arrasta de novo, e
    // soltar não grava nada. Na captura, antes das outras teclas (Esc fecharia o drawer).
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !press?.dragging) return
      e.preventDefault()
      e.stopPropagation()
      cancelDrag()
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
      mouse = { x: e.clientX, y: e.clientY }
      hoverAt(mapUnder(e.target), e.clientX, e.clientY)
    }
    /** A última posição do mouse (não do dedo), para refazer o hover quando o mapa muda sob ele. */
    let mouse: { x: number; y: number } | null = null
    /** Marca o pin ou o grupo sob o ponto da página (`map`: a área do mapa sob ele, ou `null`). */
    const hoverAt = (map: HTMLElement | null, clientX: number, clientY: number) => {
      let at: { x: number; y: number } | null = null
      if (map && camera.getState().ready && ui.getState().tool !== 'measure') {
        const rect = map.getBoundingClientRect()
        at = { x: clientX - rect.left, y: clientY - rect.top }
      }
      const hit = at ? under(at.x, at.y) : null
      pins.getState().setHovered(hit ? hit.id : null)
      pins.getState().setGroupHovered(at !== null && hit === null && groupUnder(at.x, at.y) !== null)
    }
    // O zoom, o pan e as camadas mudam o que está sob o mouse parado (um pin entra num grupo, um
    // grupo se desfaz, um tipo some): o hover e o cursor acompanham sem esperar o próximo movimento.
    const refresh = () => {
      if (!mouse || press || pins.getState().dragging) return
      hoverAt(mapUnder(document.elementFromPoint?.(mouse.x, mouse.y) ?? null), mouse.x, mouse.y)
    }
    const unsubscribeCamera = camera.subscribe((state, prev) => {
      if (state.scale !== prev.scale || state.zoom !== prev.zoom || state.view !== prev.view || state.ready !== prev.ready) refresh()
    })
    const unsubscribeLayers = ui.subscribe((state, prev) => {
      if (state.layers !== prev.layers) refresh()
    })
    // Na captura: o aperto num pin segura o pan antes de o canvas (e a câmera) o receber.
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('keydown', onEscape, true)
    return () => {
      unsubscribeCamera()
      unsubscribeLayers()
      document.removeEventListener('keydown', onEscape, true)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('pointermove', onMove)
      if (press?.dragging) pins.getState().endDrag(false)
      holdPan(false)
      pins.getState().setHovered(null)
      pins.getState().setGroupHovered(false)
    }
  }, [ui, pins, camera, disabled])

  return null
}

/** Se o alvo do teclado está dentro do drawer do pin (`data-pin-drawer`). */
function inPinDrawer(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-pin-drawer]') !== null
}
