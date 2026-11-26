import type { ReactNode } from 'react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { PinIcon } from '../pins/PinIcon'
import { PIN_TYPES } from '../../state/pinTypes'
import type { MapLayer, MapTool, UiStore } from '../../state/uiStore'
import { PANEL_BORDER, TOOLBAR_GAP, TOOLBAR_PADDING, TOOLBAR_THICKNESS } from './bottomBarLayout'
import { LAYERS, TOOLS, type Tool } from './tools'

/**
 * Toolbar de ferramentas da linha inferior (navegacao.md → Elementos do editor, AC-F2-10, AC-F2-11 e
 * AC-F2-13): Navegar, Adicionar pin, Desenhar estrada, Rota automática, Camadas e Medir distância.
 * Navegar, Adicionar pin, Desenhar estrada e Medir distância trocam a ferramenta do mapa (`tool` do `ui`), e a ferramenta em uso fica
 * ativa, em âmbar. As ferramentas de funções que ainda não existem ficam desabilitadas (opacidade
 * .55). O hover (mesmo nas desabilitadas) ou o foco do teclado (só nas habilitadas: as
 * desabilitadas não recebem foco) mostra o tooltip com o nome e o atalho.
 *
 * Camadas abre um popover com um interruptor por camada do mapa: "Decoração" (`layers.decor` do
 * `ui`) e, abaixo dela, um por tipo de pin, com o ícone do tipo (`layers.<tipo>`, pins.md AC-F3-15). O
 * popover fecha por Camadas de novo, Esc (o foco volta a Camadas)
 * ou um clique fora dele.
 *
 * `vertical`: a toolbar fica em pé (quando não cabe deitada na linha, `bottomBarLayout`); o tooltip
 * abre à esquerda dela, e o popover, acima, alinhado à direita (deitada, os dois abrem acima,
 * centrados).
 *
 * `highlight`: o contorno âmbar da dica de boas-vindas à vista (AC-F1-31), na toolbar inteira
 * (`toolbar`) ou só em Adicionar pin (`pin`).
 */
/** A barra superior vai até 68 px do topo (12 de margem e 56 de altura); o popover para 8 px abaixo dela. */
const POPOVER_TOP_LIMIT = 76
/** O vão entre a toolbar e o popover, acima dela. */
const POPOVER_GAP = 10

export function MapToolbar({
  ui,
  vertical = false,
  highlight = null,
}: {
  ui: UiStore
  vertical?: boolean
  highlight?: 'toolbar' | 'pin' | null
}) {
  const [layersOpen, setLayersOpen] = useState(false)
  const [tip, setTip] = useState<Tool['id'] | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const layersButton = useRef<HTMLButtonElement>(null)
  const popoverId = useId()
  const activeTool = useStore(ui, (s) => s.tool)
  /** A altura máxima do popover: o espaço entre o topo da toolbar e a barra superior. */
  const [popoverMax, setPopoverMax] = useState<number | null>(null)

  // O popover abre acima da toolbar, que muda de lugar com o layout (deitada na linha, numa segunda
  // linha acima do minimapa, em pé): a altura que cabe é medida ao abrir e a cada redimensionamento.
  // Sem espaço para todas as linhas, ele rola.
  useLayoutEffect(() => {
    if (!layersOpen) return
    const measure = () => {
      const top = root.current?.getBoundingClientRect().top
      if (top !== undefined) setPopoverMax(Math.max(120, Math.floor(top - POPOVER_GAP - POPOVER_TOP_LIMIT)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [layersOpen, vertical])

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
    // Na captura: o Esc fecha o popover antes de chegar às outras teclas (a de Medir distância).
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
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
        data-welcome-highlight={highlight === 'toolbar' || undefined}
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
          const isMapTool = tool.id === 'nav' || tool.id === 'pin' || tool.id === 'road' || tool.id === 'measure'
          const on = isLayers ? layersOpen : tool.id === activeTool
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
                  data-welcome-highlight={(highlight === 'pin' && tool.id === 'pin') || undefined}
                  onClick={
                    isLayers
                      ? () => setLayersOpen((open) => !open)
                      : isMapTool
                        ? () => ui.getState().setTool(tool.id as MapTool)
                        : undefined
                  }
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
          style={popoverMax === null ? undefined : { maxHeight: popoverMax }}
          className={`absolute z-[5] flex w-62 flex-col overflow-y-auto rounded-panel [&>*]:shrink-0 border border-line bg-paper-solid p-2 text-ink shadow-lg ${popoverSide}`}
        >
          <span aria-hidden="true" className="px-2 py-1.5 text-[11px]/4 font-extrabold tracking-[.08em] text-ink-2 uppercase">
            Camadas
          </span>
          {LAYERS.map(({ id, label, icon: Icon }) => (
            <LayerSwitch key={id} ui={ui} layer={id} label={label} icon={<Icon size={18} aria-hidden="true" />} />
          ))}
          <span aria-hidden="true" className="mx-2 my-1 h-px bg-line" />
          {PIN_TYPES.map(({ id, label }) => (
            <LayerSwitch key={id} ui={ui} layer={id} label={label} icon={<PinIcon type={id} size={18} className="-mt-0.5" />} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Uma linha do popover: ícone, nome e o interruptor (trilho âmbar ligado, `--line-2` desligado). */
function LayerSwitch({ ui, layer, label, icon }: { ui: UiStore; layer: MapLayer; label: string; icon: ReactNode }) {
  const on = useStore(ui, (s) => s.layers[layer])
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => ui.getState().setLayer(layer, !on)}
      className="flex h-11 items-center gap-2.5 rounded-control px-2 text-left text-[13px] font-semibold hover:bg-hover pointer-fine:h-9"
    >
      <span className="flex w-[18px] shrink-0 justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      <span aria-hidden="true" className={`relative h-[18px] w-8 rounded-[9px] transition-colors duration-150 ${on ? 'bg-amber' : 'bg-line-2'}`}>
        <span
          className={`absolute top-0.5 size-3.5 rounded-full bg-[#FFFBF2] shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-[left] duration-150 ${on ? 'left-4' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}
