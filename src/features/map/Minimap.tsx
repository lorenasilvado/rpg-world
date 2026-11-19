import { ChevronDown, Map as MapIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useStore } from 'zustand'
import type { CameraStore } from '../../state/cameraStore'
import type { UiStore } from '../../state/uiStore'
import type { WorldStore } from '../../state/worldStore'
import {
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  inRect,
  minimapToWorld,
  minimapViewCenter,
  minimapKeyStep,
  minimapViewRect,
} from './mapControls'
import { MINIMAP_PADDING, PANEL_BORDER, minimapHeaderHeight } from './bottomBarLayout'
import { createTerrainPainter, minimapResolution } from './minimapTerrain'
import { useCoarsePointer } from './useCoarsePointer'

/**
 * Minimapa (navegacao.md, AC-F2-08): o terreno do mapa exibido em 160 × 100, com o retângulo da
 * área visível, que acompanha a câmera. Arrastar o retângulo move a área visível; tocar fora dele
 * centra a câmera ali (e o arrasto continua dali). Com o foco no minimapa, as setas movem a área
 * visível 10 px do minimapa (1/10 do mapa). O cabeçalho "Minimapa" recolhe e abre (`minimapOpen` do
 * `ui`); em tela de toque, ele tem 44 px de altura (a área de toque mínima).
 *
 * O retângulo é posto direto no estilo, a cada mudança do `camera`, sem render do React. Para os
 * testes, o minimapa expõe em `data-drawn` o tamanho do campo desenhado (vazio antes do primeiro).
 */
export function Minimap({ world, ui, camera }: { world: WorldStore; ui: UiStore; camera: CameraStore }) {
  const open = useStore(ui, (s) => s.minimapOpen)
  const touch = useCoarsePointer()
  const bodyId = useId()
  return (
    <section
      aria-label="Minimapa"
      data-testid="minimap"
      data-open={open}
      style={{ borderWidth: PANEL_BORDER }}
      className="overflow-hidden rounded-panel border-line bg-paper shadow-md backdrop-blur-[14px]"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        title={open ? 'Ocultar minimapa' : 'Mostrar minimapa'}
        onClick={() => ui.getState().setMinimapOpen(!open)}
        style={{ height: minimapHeaderHeight(touch) }}
        className="flex w-full items-center gap-1.5 pr-1.5 pl-2.5 text-[11px]/4 font-extrabold tracking-[0.08em] text-ink-2 uppercase hover:text-ink"
      >
        <MapIcon size={15} aria-hidden="true" />
        <span className="flex-1 pr-2 text-left">Minimapa</span>
        <ChevronDown size={16} aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </button>
      <div id={bodyId} hidden={!open} style={{ padding: `0 ${MINIMAP_PADDING}px ${MINIMAP_PADDING}px` }}>
        <MinimapSurface world={world} camera={camera} />
      </div>
    </section>
  )
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

function MinimapSurface({ world, camera }: { world: WorldStore; camera: CameraStore }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const rect = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  // A densidade da tela ao montar (o canvas é redesenhado a cada mapa novo).
  const [res] = useState(minimapResolution)

  // O terreno: redesenhado a cada campo novo (a prévia e o mapa final), reaproveitando o canvas de
  // origem de cada tamanho.
  useEffect(() => {
    const painter = createTerrainPainter()
    const draw = () => {
      const { field, terrainRgba } = world.getState()
      const el = canvas.current
      if (!el || !field || !terrainRgba) return
      if (painter.draw(el, field.width, field.height, terrainRgba)) surface.current?.setAttribute('data-drawn', String(field.width))
    }
    draw()
    return world.subscribe((s, prev) => {
      if (s.field !== prev.field) draw()
    })
  }, [world])

  // O retângulo da área visível, a cada mudança da câmera.
  useEffect(() => {
    const place = () => {
      const el = rect.current
      if (!el) return
      const { ready, view } = camera.getState()
      el.hidden = !ready
      if (!ready) return
      const r = minimapViewRect(view)
      el.style.left = `${r.x}px`
      el.style.top = `${r.y}px`
      el.style.width = `${r.width}px`
      el.style.height = `${r.height}px`
    }
    place()
    return camera.subscribe(place)
  }, [camera])

  const local = (e: ReactPointerEvent) => {
    const box = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }

  const moveTo = (p: { x: number; y: number }) => {
    const d = drag.current
    if (!d) return
    const target = minimapToWorld(p.x - d.dx, p.y - d.dy)
    camera.getState().controls?.centerOn(target.x, target.y)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const { ready, view, controls } = camera.getState()
    if (!ready || !controls || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = local(e)
    // No retângulo: arrasta mantendo o ponto pego. Fora: centra ali e arrasta a partir do centro.
    const center = minimapViewCenter(view)
    drag.current = inRect(p.x, p.y, minimapViewRect(view)) ? { dx: p.x - center.x, dy: p.y - center.y } : { dx: 0, dy: 0 }
    moveTo(p)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current) moveTo(local(e))
  }

  const endDrag = () => {
    drag.current = null
  }

  // Setas com o foco no minimapa: movem a área visível `MINIMAP_KEY_STEP_PX` px do minimapa, na hora.
  // O atalho de pan da câmera (`MapCamera`) escuta as setas no `document`; para ele não somar outro
  // passo, o evento para aqui (`stopPropagation`: o React escuta na raiz do app, abaixo do
  // `document`, então o evento nativo não chega a ele) e fica marcado como tratado (`preventDefault`,
  // que a câmera também respeita).
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const dir = ARROWS[e.key]
    if (!dir || e.ctrlKey || e.altKey || e.metaKey) return
    const { ready, view, controls } = camera.getState()
    if (!ready || !controls) return
    e.preventDefault()
    e.stopPropagation()
    const step = minimapKeyStep()
    controls.centerOn(view.x + view.width / 2 + dir[0] * step, view.y + view.height / 2 + dir[1] * step)
  }

  return (
    <div
      ref={surface}
      data-testid="minimap-surface"
      role="group"
      aria-roledescription="minimapa"
      aria-label="Área visível do mapa: arraste ou use as setas para mover"
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      className="relative cursor-pointer touch-none overflow-hidden rounded-[6px] bg-map-canvas select-none"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
    >
      <canvas
        ref={canvas}
        width={MINIMAP_WIDTH * res}
        height={MINIMAP_HEIGHT * res}
        className="block size-full"
        aria-hidden="true"
      />
      <div
        ref={rect}
        data-testid="minimap-view"
        hidden
        className="absolute cursor-move rounded-[2px] border-2 border-[#FFFBF2] shadow-[0_0_0_1px_rgba(43,36,32,0.6)]"
      />
    </div>
  )
}
