import { ChevronDown, Map as MapIcon } from 'lucide-react'
import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useStore } from 'zustand'
import type { CameraStore } from '../../state/cameraStore'
import type { UiStore } from '../../state/uiStore'
import type { WorldStore } from '../../state/worldStore'
import {
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  inRect,
  minimapMapBox,
  minimapToWorld,
  minimapViewCenter,
  minimapViewRect,
} from './mapControls'

/** Resolução do canvas do minimapa: 2× o tamanho na tela, nítido em telas de alta densidade. */
const MINIMAP_RES = 2

/**
 * Minimapa (navegacao.md, AC-F2-08): o terreno do mapa exibido em 160 × 100, com o retângulo da
 * área visível, que acompanha a câmera. Arrastar o retângulo move a área visível; tocar fora dele
 * centra a câmera ali (e o arrasto continua dali). O cabeçalho "Minimapa" recolhe e abre
 * (`minimapOpen` do `ui`).
 *
 * O retângulo é posto direto no estilo, a cada mudança do `camera`, sem render do React. Para os
 * testes, o minimapa expõe em `data-drawn` o tamanho do campo desenhado (vazio antes do primeiro).
 */
export function Minimap({ world, ui, camera }: { world: WorldStore; ui: UiStore; camera: CameraStore }) {
  const open = useStore(ui, (s) => s.minimapOpen)
  const bodyId = useId()
  return (
    <section
      aria-label="Minimapa"
      data-testid="minimap"
      data-open={open}
      className="overflow-hidden rounded-panel border border-line bg-paper shadow-md backdrop-blur-[14px]"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        title={open ? 'Ocultar minimapa' : 'Mostrar minimapa'}
        onClick={() => ui.getState().setMinimapOpen(!open)}
        className="flex h-8 w-full items-center gap-1.5 pr-1.5 pl-2.5 text-[11px]/4 font-extrabold tracking-[0.08em] text-ink-2 uppercase hover:text-ink"
      >
        <MapIcon size={15} aria-hidden="true" />
        <span className="flex-1 pr-2 text-left">Minimapa</span>
        <ChevronDown size={16} aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </button>
      <div id={bodyId} hidden={!open} className="px-1.5 pb-1.5">
        <MinimapSurface world={world} camera={camera} />
      </div>
    </section>
  )
}

function MinimapSurface({ world, camera }: { world: WorldStore; camera: CameraStore }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const rect = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  // O terreno: redesenhado a cada campo novo (a prévia e o mapa final).
  useEffect(() => {
    const draw = () => {
      const { field, terrainRgba } = world.getState()
      const el = canvas.current
      if (!el || !field || !terrainRgba) return
      if (drawTerrain(el, field.width, field.height, terrainRgba)) surface.current?.setAttribute('data-drawn', String(field.width))
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

  return (
    <div
      ref={surface}
      data-testid="minimap-surface"
      role="img"
      aria-label="Mapa inteiro, com a área visível marcada; arraste para mover"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="relative cursor-pointer touch-none overflow-hidden rounded-[6px] bg-map-canvas select-none"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
    >
      <canvas
        ref={canvas}
        width={MINIMAP_WIDTH * MINIMAP_RES}
        height={MINIMAP_HEIGHT * MINIMAP_RES}
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

/**
 * Desenha o RGBA do terreno (`width` × `height`) reduzido no quadrado do mapa do minimapa. Devolve
 * se desenhou (sem canvas 2D, como no jsdom, não desenha).
 */
function drawTerrain(el: HTMLCanvasElement, width: number, height: number, rgba: Uint8ClampedArray<ArrayBuffer>): boolean {
  const ctx = el.getContext('2d')
  const src = document.createElement('canvas')
  src.width = width
  src.height = height
  const srcCtx = src.getContext('2d')
  if (!ctx || !srcCtx) return false
  srcCtx.putImageData(new ImageData(rgba, width, height), 0, 0)
  const box = minimapMapBox()
  ctx.clearRect(0, 0, el.width, el.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, box.x * MINIMAP_RES, box.y * MINIMAP_RES, box.size * MINIMAP_RES, box.size * MINIMAP_RES)
  return true
}
