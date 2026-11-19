import { LocateFixed, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import type { CameraStore } from '../../state/cameraStore'
import type { WorldStore } from '../../state/worldStore'
import { PANEL_BORDER, ZOOM_BAR_HEIGHT, ZOOM_BAR_PADDING } from './bottomBarLayout'
import { SCALE_BAR_PX, scaleLabel, showsZoomDetails, zoomPercent } from './mapControls'

/**
 * Controle de zoom do canto inferior direito (navegacao.md, AC-F2-09): a barra de escala em km
 * (a partir do `sizeKm` do mundo), Afastar, a porcentagem do zoom, Aproximar e Centralizar. Os
 * botões fazem o mesmo que as teclas −, + e 0. Com a área livre abaixo de 860 px, a escala e a
 * porcentagem somem e ficam só os botões (`data-compact`, também antes de a câmera estar pronta).
 * Os botões têm 44 × 44 px em telas de toque (`ZOOM_BUTTON_TOUCH`, a área de toque mínima do design
 * system) e 40 px de largura com mouse (a exceção do zoom no desktop).
 */
export function ZoomControls({ world, camera }: { world: WorldStore; camera: CameraStore }) {
  const sizeKm = useStore(world, (s) => s.sizeKm)
  const ready = useStore(camera, (s) => s.ready)
  const details = useStore(camera, (s) => showsZoomDetails(s.areaWidth))
  const scale = useStore(camera, (s) => scaleLabel(s.scale, sizeKm))
  const percent = useStore(camera, (s) => zoomPercent(s.zoom))
  const run = (command: 'zoomIn' | 'zoomOut' | 'center') => camera.getState().controls?.[command]()
  const showDetails = ready && details

  return (
    <div
      role="group"
      aria-label="Zoom"
      data-testid="zoom-controls"
      data-compact={!showDetails}
      style={{ height: ZOOM_BAR_HEIGHT, padding: `0 ${ZOOM_BAR_PADDING}px`, borderWidth: PANEL_BORDER }}
      className="flex items-center rounded-panel border-line bg-paper shadow-md backdrop-blur-[14px]"
    >
      {showDetails && (
        <div data-testid="map-scale" title="Escala" className="flex flex-col items-center gap-0.5 pr-1.5 pl-2">
          <span className="text-[11px]/3 font-bold text-ink-2 tabular-nums">{scale}</span>
          <span aria-hidden="true" className="h-[5px] border-[1.5px] border-t-0 border-ink" style={{ width: SCALE_BAR_PX }} />
        </div>
      )}
      <ZoomButton label="Afastar" shortcut="−" onClick={() => run('zoomOut')}>
        <Minus size={18} aria-hidden="true" />
      </ZoomButton>
      {showDetails && (
        <span data-testid="zoom-percent" aria-label="Zoom atual" className="w-9 text-center text-[11px] font-bold text-ink-2 tabular-nums">
          {percent}
        </span>
      )}
      <ZoomButton label="Aproximar" shortcut="+" onClick={() => run('zoomIn')}>
        <Plus size={18} aria-hidden="true" />
      </ZoomButton>
      <ZoomButton label="Centralizar" shortcut="0" onClick={() => run('center')}>
        <LocateFixed size={18} aria-hidden="true" />
      </ZoomButton>
    </div>
  )
}

function ZoomButton({ label, shortcut, onClick, children }: { label: string; shortcut: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-keyshortcuts={shortcut === '−' ? '-' : shortcut}
      title={`${label} ( ${shortcut} )`}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-control text-ink hover:bg-hover active:bg-press pointer-fine:w-10"
    >
      {children}
    </button>
  )
}
