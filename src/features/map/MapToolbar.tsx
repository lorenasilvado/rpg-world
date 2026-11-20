import type { LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { MapLayer, UiStore } from '../../state/uiStore'
import { PANEL_BORDER, TOOLBAR_GAP, TOOLBAR_PADDING, TOOLBAR_THICKNESS } from './bottomBarLayout'
import { LAYERS, TOOLS, type Tool } from './tools'

/**
 * Toolbar de ferramentas da linha inferior (navegacao.md → Elementos do editor, AC-F2-10 e AC-F2-11):
 * Navegar (a única ferramenta, ativa), Adicionar pin, Desenhar estrada, Rota automática, Camadas e
 * Medir distância. As ferramentas de funções que ainda não existem ficam desabilitadas (opacidade
 * .55). O hover (mesmo nas desabilitadas) ou o foco do teclado (só nas habilitadas: as
 * desabilitadas não recebem foco) mostra o tooltip com o nome e o atalho.
 *
 * Camadas abre um popover com um interruptor por camada do mapa (hoje, "Decoração", que liga e
 * desliga `layers.decor` do `ui`). O popover fecha por Camadas de novo, Esc (o foco volta a Camadas)
 * ou um clique fora dele.
 *
 * `vertical`: a toolbar fica em pé (quando não cabe deitada na linha, `bottomBarLayout`); o tooltip
 * abre à esquerda dela, e o popover, acima, alinhado à direita (deitada, os dois abrem acima,
 * centrados).
 */
export function MapToolbar({ ui, vertical = false }: { ui: UiStore; vertical?: boolean }) {
  const [layersOpen, setLayersOpen] = useState(false)
  const [tip, setTip] = useState<Tool['id'] | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const layersButton = useRef<HTMLButtonElement>(null)
  const popoverId = useId()

  useEffect(() => {
    if (!layersOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setLayersOpen(false)
      if (root.current?.contains(document.activeElement)) layersButton.current?.focus()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setLayersOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [layersOpen])

  const side = vertical
    ? 'right-[calc(100%+10px)] top-1/2 -translate-y-1/2'
    : 'bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2'
  // Em pé, o popover (248 px) não cabe à esquerda numa área estreita: abre acima, alinhado à direita.
  const popoverSide = vertical ? 'right-0 bottom-[calc(100%+10px)]' : side

  return (
    <div ref={root} className="relative" data-testid="map-toolbar" data-vertical={vertical}>
      <div
        role="toolbar"
        aria-label="Ferramentas"
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        style={{
          [vertical ? 'width' : 'height']: TOOLBAR_THICKNESS,
          padding: vertical ? `${TOOLBAR_PADDING}px 0` : `0 ${TOOLBAR_PADDING}px`,
          gap: TOOLBAR_GAP,
          borderWidth: PANEL_BORDER,
        }}
        className={`flex items-center rounded-panel border-line bg-paper shadow-md backdrop-blur-[14px] ${vertical ? 'flex-col' : ''}`}
      >
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          const isLayers = tool.id === 'layers'
          const on = isLayers ? layersOpen : tool.id === 'nav'
          const showTip = tip === tool.id && !(isLayers && layersOpen)
          return (
            <div key={tool.id} className={`flex items-center ${vertical ? 'flex-col' : ''}`} style={{ gap: TOOLBAR_GAP }}>
              {isLayers && (
                <span aria-hidden="true" className={`bg-line-2 ${vertical ? 'mx-auto my-1 h-px w-7' : 'mx-1 h-7 w-px'}`} />
              )}
              <div
                className="relative flex"
                onPointerEnter={(e) => e.pointerType === 'mouse' && setTip(tool.id)}
                onPointerLeave={() => setTip((t) => (t === tool.id ? null : t))}
              >
                <button
                  ref={isLayers ? layersButton : undefined}
                  type="button"
                  aria-label={tool.label}
                  disabled={tool.disabled}
                  {...(isLayers
                    ? { 'aria-expanded': layersOpen, 'aria-controls': layersOpen ? popoverId : undefined, 'aria-haspopup': 'true' as const }
                    : { 'aria-pressed': on })}
                  data-on={on}
                  onClick={isLayers ? () => setLayersOpen((open) => !open) : undefined}
                  onFocus={(e) => e.currentTarget.matches(':focus-visible') && setTip(tool.id)}
                  onBlur={() => setTip((t) => (t === tool.id ? null : t))}
                  className={[
                    'grid size-11 place-items-center rounded-control',
                    on
                      ? 'bg-amber text-on-amber shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]'
                      : 'text-ink enabled:hover:bg-hover enabled:active:bg-press',
                    'disabled:opacity-55',
                  ].join(' ')}
                >
                  <Icon size={20} aria-hidden="true" />
                </button>
                {showTip && (
                  <span
                    role="tooltip"
                    data-testid="tool-tooltip"
                    className={`pointer-events-none absolute z-[5] flex items-center gap-1.5 rounded-[6px] bg-[#2B2420] py-[5px] pr-1.5 pl-[9px] text-xs/4 font-semibold whitespace-nowrap text-[#F7F1E3] ${side}`}
                  >
                    {tool.label}
                    {tool.shortcut && <kbd className="rounded-[4px] bg-[rgba(247,241,227,.18)] px-[5px] font-sans font-extrabold">{tool.shortcut}</kbd>}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {layersOpen && (
        <div
          id={popoverId}
          role="group"
          aria-label="Camadas"
          data-testid="layers-popover"
          className={`absolute z-[5] flex w-62 flex-col rounded-panel border border-line bg-paper-solid p-2 text-ink shadow-lg ${popoverSide}`}
        >
          <span aria-hidden="true" className="px-2 py-1.5 text-[11px]/4 font-extrabold tracking-[.08em] text-ink-2 uppercase">
            Camadas
          </span>
          {LAYERS.map((layer) => (
            <LayerSwitch key={layer.id} ui={ui} layer={layer.id} label={layer.label} icon={layer.icon} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Uma linha do popover: ícone, nome e o interruptor (trilho âmbar ligado, `--line-2` desligado). */
function LayerSwitch({ ui, layer, label, icon: Icon }: { ui: UiStore; layer: MapLayer; label: string; icon: LucideIcon }) {
  const on = useStore(ui, (s) => s.layers[layer])
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => ui.getState().setLayer(layer, !on)}
      className="flex h-11 items-center gap-2.5 rounded-control px-2 text-left text-[13px] font-semibold hover:bg-hover pointer-fine:h-9"
    >
      <Icon size={18} aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <span aria-hidden="true" className={`relative h-[18px] w-8 rounded-[9px] transition-colors duration-150 ${on ? 'bg-amber' : 'bg-line-2'}`}>
        <span
          className={`absolute top-0.5 size-3.5 rounded-full bg-[#FFFBF2] shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-[left] duration-150 ${on ? 'left-4' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}
