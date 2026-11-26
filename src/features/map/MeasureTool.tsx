import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { inDialog, isFieldTarget } from '../../render/camera'
import type { CameraStore } from '../../state/cameraStore'
import type { UiStore } from '../../state/uiStore'
import type { WorldStore } from '../../state/worldStore'
import { addMeasurePoint, clampToWorld, distanceKm, formatKm, measureHint, screenToWorld, worldToScreen, type WorldPoint } from './measure'

/** Até quantos px o ponteiro pode andar entre apertar e soltar para contar como clique (e não pan). */
export const CLICK_SLOP_PX = 5
/** Distância da dica ao topo da área do mapa: abaixo da barra de ações (12 + 56 + 16). */
export const HINT_TOP_PX = 84

/**
 * Medir distância (navegacao.md, AC-F2-13). A tecla M (ou a ferramenta da toolbar) liga a ferramenta,
 * e a tecla V volta para Navegar (as teclas P, Adicionar pin, e R, Desenhar estrada, são ouvidas aqui também), com as mesmas exceções dos atalhos da câmera (Ctrl, Alt ou Meta, foco num campo, dentro de um
 * modal, `disabled`: painel sobreposto aberto no celular). Com ela ligada, dois cliques no mapa
 * marcam as pontas, e a distância em km aparece no meio da linha; um terceiro clique recomeça.
 * Arrastar continua fazendo pan (só conta como clique quem anda até `CLICK_SLOP_PX`). Esc apaga os
 * pontos marcados e, sem pontos, volta para Navegar; com o foco num campo, o Esc é do campo.
 *
 * O desenho (a linha, as pontas, a distância e a dica) é um SVG por cima do mapa, sem eventos, que
 * acompanha a câmera pelo `camera` (a parte visível do mundo e a origem da área livre). A dica é a
 * região `status`: com as duas pontas, ela anuncia também a distância ao leitor de tela.
 */
export function MeasureTool({ ui, world, camera, disabled }: { ui: UiStore; world: WorldStore; camera: CameraStore; disabled: boolean }) {
  const active = useStore(ui, (s) => s.tool === 'measure')

  useEffect(() => {
    if (disabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const tool = key === 'm' ? 'measure' : key === 'v' ? 'nav' : key === 'p' ? 'pin' : key === 'r' ? 'road' : null
      if (!tool || e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return
      if (isFieldTarget(e.target) || inDialog(e.target)) return
      e.preventDefault()
      ui.getState().setTool(tool)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ui, disabled])

  return active ? <MeasureLayer ui={ui} world={world} camera={camera} disabled={disabled} /> : null
}

/** O elemento da área do mapa sob o evento (`null` fora dela: painéis, barras, minimapa). */
function mapUnder(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof (target as Element).closest !== 'function') return null
  return (target as Element).closest<HTMLElement>('[data-testid="map"]')
}

function MeasureLayer({ ui, world, camera, disabled }: { ui: UiStore; world: WorldStore; camera: CameraStore; disabled: boolean }) {
  const [points, setPoints] = useState<WorldPoint[]>([])
  const pointsRef = useRef(points)
  useEffect(() => {
    pointsRef.current = points
  }, [points])
  /** Onde o mouse está no mundo, para a linha seguir o cursor depois do primeiro ponto. */
  const [cursor, setCursor] = useState<WorldPoint | null>(null)
  const cam = useStore(camera)
  const sizeKm = useStore(world, (s) => s.sizeKm)

  useEffect(() => {
    if (disabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isFieldTarget(e.target) || inDialog(e.target)) return
      e.preventDefault()
      if (pointsRef.current.length === 0) ui.getState().setTool('nav')
      else setPoints([])
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ui, disabled])

  useEffect(() => {
    if (disabled) return
    // O ponteiro apertado no mapa: um segundo dedo (pinça) cancela o clique.
    let press: { id: number; x: number; y: number } | null = null
    const down = new Set<number>()
    const toWorld = (e: PointerEvent, map: HTMLElement) => {
      const rect = map.getBoundingClientRect()
      return screenToWorld(e.clientX - rect.left, e.clientY - rect.top, camera.getState())
    }
    const onDown = (e: PointerEvent) => {
      if (!mapUnder(e.target)) return
      // Um toque esquece onde o mouse estava: a linha provisória não vai até lá (aparelho híbrido).
      if (e.pointerType === 'touch') setCursor(null)
      down.add(e.pointerId)
      press = down.size === 1 && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      down.delete(e.pointerId)
      const p = press
      if (!p || p.id !== e.pointerId) return
      press = null
      const map = mapUnder(e.target) ?? mapUnder(document.elementFromPoint?.(e.clientX, e.clientY) ?? null)
      if (!map || Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_SLOP_PX || !camera.getState().ready) return
      const point = clampToWorld(toWorld(e, map))
      setPoints((current) => addMeasurePoint(current, point))
    }
    const onCancel = (e: PointerEvent) => {
      down.delete(e.pointerId)
      if (press?.id === e.pointerId) press = null
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      // Sobre um controle (toolbar, minimapa, barras), a linha fica no último ponto do mapa.
      const map = mapUnder(e.target)
      if (map && camera.getState().ready) setCursor(clampToWorld(toWorld(e, map)))
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
    }
  }, [camera, disabled])

  const a = points[0]
  const b = points[1] ?? (a ? cursor : null)
  const sa = a && worldToScreen(a, cam)
  const sb = b && worldToScreen(b, cam)
  const hintLeft = cam.origin.x + (cam.view.width * cam.scale) / 2

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" data-testid="measure-layer" data-points={points.length}>
      {cam.ready && (
        <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
          {sa && sb && (
            <>
              <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="rgba(43,36,32,.55)" strokeWidth={4.5} strokeLinecap="round" />
              <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="#FFFBF2" strokeWidth={2.5} strokeDasharray="6 5" />
            </>
          )}
          {sa && <circle cx={sa.x} cy={sa.y} r={5} fill="#FFFBF2" stroke="#2B2420" strokeWidth={2} />}
          {sb && points.length === 2 && <circle cx={sb.x} cy={sb.y} r={5} fill="#FFFBF2" stroke="#2B2420" strokeWidth={2} />}
        </svg>
      )}
      {cam.ready && sa && sb && a && b && (
        <div
          data-testid="measure-distance"
          data-final={points.length === 2}
          style={{ left: (sa.x + sb.x) / 2, top: (sa.y + sb.y) / 2 }}
          className="absolute -translate-x-1/2 -translate-y-[140%] rounded-full bg-[#2B2420] px-2.5 py-1 text-[13px]/[18px] font-bold whitespace-nowrap text-[#F7F1E3]"
        >
          {formatKm(distanceKm(a, b, sizeKm))}
        </div>
      )}
      <div
        role="status"
        data-testid="measure-status"
        style={{ left: hintLeft, top: HINT_TOP_PX }}
        className="absolute -translate-x-1/2 rounded-full bg-[#2B2420] px-3.5 py-2 text-[13px]/[18px] font-semibold whitespace-nowrap text-[#F7F1E3] shadow-md"
      >
        <span data-testid="measure-hint">{measureHint(points)}</span>
        {/* Só para o leitor de tela: a medida pronta (a pílula da distância é visual). */}
        {points.length === 2 && <span className="sr-only">{`. Distância: ${formatKm(distanceKm(points[0], points[1], sizeKm))}`}</span>}
      </div>
    </div>
  )
}
