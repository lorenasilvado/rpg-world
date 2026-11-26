import { Route } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { WORLD_SIZE, inDialog, isFieldTarget } from '../../render/camera'
import type { CameraStore } from '../../state/cameraStore'
import type { PinsStore } from '../../state/pinsStore'
import type { RoadsStore } from '../../state/roadsStore'
import type { UiStore } from '../../state/uiStore'
import { CLICK_SLOP_PX } from '../map/MeasureTool'
import { ToolHint } from '../map/ToolHint'
import { clampToWorld, screenToWorld, worldToScreen } from '../map/measure'
import { createVisiblePins } from '../pins/visiblePins'
import { addDraftPoint, curvePath, draftToRoad, isDoubleTap, roadHint, type DraftPoint, type Tap } from './drawRoad'

/**
 * Desenhar estrada (estradas.md, AC-F5-04, AC-F5-05). A tecla R (ouvida pelo `MeasureTool`, com as
 * outras ferramentas) ou a ferramenta da toolbar a liga. Cada clique (o ponteiro anda até
 * `CLICK_SLOP_PX`; mais que isso é pan) adiciona um ponto: no mapa, onde clicou (fora dele, na borda
 * mais próxima); num pin à vista, na posição do pin, e a ponta que começa ou termina ali fica ligada
 * a ele. Enter, ou um duplo clique (ou duplo toque), termina o desenho com 2 pontos ou mais: a
 * estrada "Nova estrada", tipo Estrada, entra no `roadsStore` (um passo no Desfazer) e fica
 * selecionada, e a ferramenta volta para Navegar. Esc apaga o desenho e, sem desenho, volta para
 * Navegar. As teclas seguem as exceções dos atalhos do mapa (foco num campo, dentro de um modal), e
 * nada vale com `disabled` (painel sobreposto aberto no celular).
 *
 * A prévia é um SVG por cima do mapa, sem eventos, que acompanha a câmera: a curva suavizada pelos
 * pontos, com o traço da estrada, os pontos marcados e, com o mouse, a linha tracejada do último ponto
 * até o cursor (ou até o pin sob ele). A dica fica no topo da área do mapa (`ToolHint`).
 */
export function RoadTool({
  ui,
  roads,
  pins,
  camera,
  disabled,
}: {
  ui: UiStore
  roads: RoadsStore
  pins: PinsStore
  camera: CameraStore
  disabled: boolean
}) {
  const active = useStore(ui, (s) => s.tool === 'road')
  return active ? <RoadLayer ui={ui} roads={roads} pins={pins} camera={camera} disabled={disabled} /> : null
}

/** O elemento da área do mapa sob o evento (`null` fora dela: painéis, barras, minimapa). */
function mapUnder(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof (target as Element).closest !== 'function') return null
  return (target as Element).closest<HTMLElement>('[data-testid="map"]')
}

/** Um popover ou menu aberto (Camadas, Exportar…): o botão que o abriu tem `aria-haspopup` e `aria-expanded`. */
function popupOpen(): boolean {
  return document.querySelector('[aria-haspopup][aria-expanded="true"]') !== null
}

/** O alvo do teclado é um controle (botão, link, interruptor…) fora do mapa: o Enter é dele. */
function onControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target === document.body || target === document.documentElement) return false
  return mapUnder(target) === null
}

/** Ponto do mundo (0–1024) de um ponto 0..1 do mapa. */
const toWorld = (p: { u: number; v: number }) => ({ x: p.u * WORLD_SIZE, y: p.v * WORLD_SIZE })

function RoadLayer({ ui, roads, pins, camera, disabled }: { ui: UiStore; roads: RoadsStore; pins: PinsStore; camera: CameraStore; disabled: boolean }) {
  const [draft, setDraft] = useState<DraftPoint[]>([])
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  /** Onde o mouse está (0..1 no mapa; sobre um pin, a posição dele), para a linha seguir o cursor. */
  const [cursor, setCursor] = useState<{ u: number; v: number } | null>(null)
  const cam = useStore(camera)

  useEffect(() => {
    if (disabled) return
    const finish = () => {
      const road = draftToRoad(draftRef.current)
      if (!road) return false
      draftRef.current = []
      setDraft([])
      roads.getState().addRoad(road)
      ui.getState().setTool('nav')
      return true
    }
    const keyAllowed = (e: KeyboardEvent) => !e.defaultPrevented && !isFieldTarget(e.target) && !inDialog(e.target)
    // Esc com desenho e Enter: na captura, antes das outras teclas (o Esc do pin tiraria a seleção).
    // Com um popover ou menu aberto, o Esc é dele (fecha só ele); o Enter só termina com o foco fora
    // de um controle (no mapa ou em lugar nenhum): num botão focado, ele aperta o botão.
    const onKeyCapture = (e: KeyboardEvent) => {
      if (!keyAllowed(e) || e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Escape' && draftRef.current.length > 0 && !popupOpen()) {
        e.preventDefault()
        e.stopPropagation()
        draftRef.current = []
        setDraft([])
      } else if (e.key === 'Enter' && draftRef.current.length >= 2 && !onControl(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        finish()
      }
    }
    // Esc sem desenho: depois das outras teclas (com um pin selecionado, o Esc tira a seleção antes).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !keyAllowed(e)) return
      e.preventDefault()
      ui.getState().setTool('nav')
    }

    const visible = createVisiblePins(ui, pins, camera)
    /** O ponto do desenho sob o ponto da página: o pin à vista ali, ou o ponto do mapa. */
    const pointAt = (clientX: number, clientY: number, map: HTMLElement): DraftPoint => {
      const rect = map.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const pin = visible.pinAt(x, y)
      if (pin) return { u: pin.pos.u, v: pin.pos.v, pin: pin.id }
      const w = clampToWorld(screenToWorld(x, y, camera.getState()))
      return { u: w.x / WORLD_SIZE, v: w.y / WORLD_SIZE }
    }

    // O aperto em curso (um segundo dedo, a pinça, o cancela) e o último clique, para o duplo clique.
    const g: { press: { id: number; x: number; y: number } | null; lastTap: Tap | null } = { press: null, lastTap: null }
    const down = new Set<number>()
    const onDown = (e: PointerEvent) => {
      if (!mapUnder(e.target)) return
      if (e.pointerType === 'touch') setCursor(null)
      down.add(e.pointerId)
      g.press = down.size === 1 && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null
      if (down.size > 1) g.lastTap = null
    }
    const onUp = (e: PointerEvent) => {
      down.delete(e.pointerId)
      const p = g.press
      if (!p || p.id !== e.pointerId) return
      g.press = null
      const map = mapUnder(e.target) ?? mapUnder(document.elementFromPoint?.(e.clientX, e.clientY) ?? null)
      if (!map || Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_SLOP_PX || !camera.getState().ready) return
      const tap: Tap = { t: e.timeStamp, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' }
      // O segundo clique do duplo clique termina (o primeiro já marcou o último ponto).
      if (isDoubleTap(g.lastTap, tap)) {
        g.lastTap = null
        finish()
        return
      }
      g.lastTap = tap
      const next = addDraftPoint(draftRef.current, pointAt(e.clientX, e.clientY, map))
      draftRef.current = next
      setDraft(next)
    }
    const onCancel = (e: PointerEvent) => {
      down.delete(e.pointerId)
      if (g.press?.id === e.pointerId) g.press = null
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      // Sobre um controle (toolbar, minimapa, barras), a linha fica no último ponto do mapa.
      const map = mapUnder(e.target)
      if (map && camera.getState().ready) {
        const at = pointAt(e.clientX, e.clientY, map)
        setCursor({ u: at.u, v: at.v })
      }
    }
    document.addEventListener('keydown', onKeyCapture, true)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('pointermove', onMove)
    return () => {
      document.removeEventListener('keydown', onKeyCapture, true)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('pointermove', onMove)
    }
  }, [ui, roads, pins, camera, disabled])

  const screen = draft.map((p) => worldToScreen(toWorld(p), cam))
  const last = screen[screen.length - 1]
  const tip = last && cursor ? worldToScreen(toWorld(cursor), cam) : null
  const d = curvePath(screen)

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" data-testid="road-draw-layer" data-points={draft.length}>
      {cam.ready && (
        <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
          {d && (
            <>
              <path d={d} fill="none" stroke="#F5EACB" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke="#7A5230" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          {last && tip && (
            <line
              data-testid="road-draw-preview"
              x1={last.x}
              y1={last.y}
              x2={tip.x}
              y2={tip.y}
              stroke="#2B2420"
              strokeWidth={2.5}
              strokeDasharray="2 6"
              strokeLinecap="round"
            />
          )}
          {screen.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={4.5} fill="#FFFBF2" stroke="#2B2420" strokeWidth={2} />
          ))}
        </svg>
      )}
      <ToolHint icon={Route} text={roadHint(draft)} cam={cam} testId="road-draw-status" textTestId="road-draw-hint" />
    </div>
  )
}
