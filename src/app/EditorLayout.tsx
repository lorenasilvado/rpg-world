import { CircleHelp, Compass, Download, Moon, PanelLeftOpen, PanelRightOpen, Redo2, Search, Sun, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { useStore } from 'zustand'
import { BAR_BOTTOM, BAR_SIDE, ZOOM_SIDE, bottomBarLayout } from '../features/map/bottomBarLayout'
import { MapToolbar } from '../features/map/MapToolbar'
import { ShortcutsDialog } from '../features/help/ShortcutsDialog'
import { Minimap } from '../features/map/Minimap'
import { useCoarsePointer } from '../features/map/useCoarsePointer'
import { ZoomControls } from '../features/map/ZoomControls'
import { GenerateSidebar } from '../features/sidebar/GenerateSidebar'
import { createCameraStore } from '../state/cameraStore'
import type { UiStore } from '../state/uiStore'
import type { WorldStore } from '../state/worldStore'
import { GenerationErrorToast } from './GenerationErrorToast'
import { inDialog, isFieldTarget } from '../render/camera'
import { MapView, type CreateMapRenderer } from './MapView'
import { DESKTOP_QUERY } from './panelInsets'
import { useTheme } from './useTheme'

/**
 * Casca vazia do editor (design-system.md → Layout do Editor):
 * mapa em tela cheia atrás dos painéis, sidebar à esquerda (320 px) e drawer à direita (400 px).
 * Abaixo de 768 px, sidebar e drawer viram painéis sobrepostos, abertos pelos botões da barra:
 * o scrim cobre o mapa e a barra de ações, Esc fecha o painel, o foco vai para o botão de fechar
 * do painel ao abrir e volta ao botão que o abriu ao fechar. Com um painel aberto, o resto da tela
 * fica `inert` (o Tab não sai do painel). Ao passar para 768 px ou mais, os painéis fecham.
 *
 * O cabeçalho da sidebar mostra o nome do mundo. A sidebar tem as seções e os sliders de geração (`GenerateSidebar`). A partir de 768 px, ela
 * recolhe a 48 px e abre de novo pelo botão ou pela tecla `[`; abaixo disso, a tecla abre e fecha o
 * painel sobreposto. A tecla não vale com o foco num campo de texto nem com Ctrl, Alt ou Meta.
 *
 * O `world` é o estado do mundo (`worldStore.ts`): o mapa desenha o campo dele (`MapView`), a
 * sidebar muda os parâmetros dele, o toast mostra o erro da geração, e o status dela fica em
 * `data-generation-status` (os testes esperam por ele). O `ui` guarda as camadas do mapa ligadas e
 * a sidebar recolhida (`uiStore.ts`). `createRenderer` troca o
 * renderer do mapa (os testes do jsdom, sem WebGL, passam um falso).
 *
 * A linha inferior, entre a sidebar e o drawer, 16 px da base: o minimapa à esquerda e o controle
 * de zoom à direita, com o toast de erro da geração. A largura da linha (a da área livre) é medida
 * e `bottomBarLayout` decide onde ficam o minimapa (ao lado do zoom, ou acima dele quando não cabem
 * lado a lado: tablet com a sidebar aberta) e o toast. O minimapa e o zoom leem a câmera do
 * renderer (`cameraStore.ts`). A toolbar de ferramentas (`MapToolbar`) fica no centro da linha, numa
 * segunda linha acima dela ou em pé acima do zoom, conforme a largura (`bottomBarLayout`).
 *
 * A barra de ações do topo (navegacao.md → Elementos do editor, AC-F2-10): Buscar, Desfazer,
 * Refazer e Exportar ficam desabilitados (as funções vêm no M2 e no M3); o tema alterna, e Ajuda
 * (ou a tecla ?) abre o modal "Atalhos de teclado" (`ShortcutsDialog`). Buscar mostra o rótulo e o
 * atalho só a partir de 768 px e com a área livre de pelo menos `SEARCH_LABEL_FROM`; senão, só o
 * ícone. Abaixo de 768 px, os botões da barra ficam sem folga entre si, para caber no celular.
 */
export function EditorLayout({
  world,
  ui,
  createRenderer,
}: {
  world: WorldStore
  ui: UiStore
  createRenderer?: CreateMapRenderer
}) {
  const { theme, toggle } = useTheme()
  const generationStatus = useStore(world, (s) => s.status)
  const worldName = useStore(world, (s) => s.name)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  /** Quem tinha o foco ao abrir a Ajuda: recebe o foco de volta ao fechar. */
  const helpReturn = useRef<HTMLElement | null>(null)
  const openHelp = () => {
    helpReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setHelpOpen(true)
  }
  const desktop = useDesktop()
  const sidebarCollapsed = useStore(ui, (s) => s.sidebarCollapsed) && desktop
  const [camera] = useState(createCameraStore)
  const minimapOpen = useStore(ui, (s) => s.minimapOpen)
  const bottomBar = useRef<HTMLDivElement>(null)
  const barWidth = useWidth(bottomBar)
  const layout = bottomBarLayout(barWidth, minimapOpen, useCoarsePointer())
  // O minimapa só desliza entre ao lado e acima do zoom depois da primeira medição da linha: ao
  // abrir o editor numa área estreita, ele já aparece no lugar, sem subir animado.
  const barAnimated = useAnimatedAfterMeasure(barWidth)
  const anyOpen = sidebarOpen || drawerOpen
  const searchLabel = desktop && (barWidth === null || barWidth >= SEARCH_LABEL_FROM)
  const sidebarOpener = useRef<HTMLButtonElement>(null)
  const sidebarClose = useRef<HTMLButtonElement>(null)
  const drawerOpener = useRef<HTMLButtonElement>(null)
  const drawerClose = useRef<HTMLButtonElement>(null)
  usePanelFocus(sidebarOpen, sidebarClose, sidebarOpener)
  usePanelFocus(drawerOpen, drawerClose, drawerOpener)

  const closeAll = () => {
    setSidebarOpen(false)
    setDrawerOpen(false)
  }

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY)
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeAll()
    }
    desktop.addEventListener('change', onChange)
    return () => desktop.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented || isTextField(e.target) || inDialog(e.target)) return
      e.preventDefault()
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        const { sidebarCollapsed, setSidebarCollapsed } = ui.getState()
        setSidebarCollapsed(!sidebarCollapsed)
      } else {
        setDrawerOpen(false)
        setSidebarOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ui])

  useEffect(() => {
    if (anyOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented || isFieldTarget(e.target) || inDialog(e.target)) return
      e.preventDefault()
      openHelp()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [anyOpen])

  useEffect(() => {
    if (!anyOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [anyOpen])

  return (
    <div className="relative h-full overflow-hidden bg-map-canvas" data-testid="editor" data-generation-status={generationStatus}>
      <MapView world={world} ui={ui} camera={camera} inert={anyOpen} createRenderer={createRenderer} />

      <div
        ref={bottomBar}
        data-testid="bottom-bar"
        data-stacked={layout.stacked}
        inert={anyOpen}
        style={{ bottom: BAR_BOTTOM }}
        className={[
          'pointer-events-none absolute right-0 left-0 z-10',
          'transition-[left] duration-200 ease-[var(--ease-panel)]',
          'md:right-[var(--drawer-width)]',
          sidebarCollapsed ? 'md:left-[var(--sidebar-collapsed-width)]' : 'md:left-[var(--sidebar-width)]',
        ].join(' ')}
      >
        <div
          data-testid="minimap-slot"
          data-animated={barAnimated}
          style={{ left: BAR_SIDE, bottom: layout.minimapBottom }}
          className={`pointer-events-auto absolute ${barAnimated ? 'transition-[bottom] duration-200 ease-[var(--ease-panel)]' : ''}`}
        >
          <Minimap world={world} ui={ui} camera={camera} />
        </div>
        <div
          data-testid="toolbar-slot"
          data-place={layout.toolbar}
          style={layout.toolbar === 'vertical' ? { right: ZOOM_SIDE, bottom: layout.toolbarBottom } : { left: '50%', bottom: layout.toolbarBottom }}
          className={[
            'pointer-events-auto absolute',
            layout.toolbar === 'vertical' ? '' : '-translate-x-1/2',
            // Na segunda linha, ela sobe e desce junto com o minimapa (abrir e recolher), deslizando.
            barAnimated ? 'transition-[bottom] duration-200 ease-[var(--ease-panel)]' : '',
          ].join(' ')}
        >
          <MapToolbar ui={ui} vertical={layout.toolbar === 'vertical'} />
        </div>
        <div style={{ right: ZOOM_SIDE }} className="pointer-events-auto absolute bottom-0">
          <ZoomControls world={world} camera={camera} areaWidth={barWidth} />
        </div>
        <GenerationErrorToast world={world} beside={layout.toastBeside} bottom={layout.toastBottom} right={layout.toastRight} />
      </div>

      {anyOpen && (
        <div
          aria-hidden="true"
          data-testid="scrim"
          className="absolute inset-0 z-[15] bg-scrim md:hidden"
          onClick={closeAll}
        />
      )}

      <aside
        aria-label="Gerar mundo"
        data-testid="sidebar"
        data-open={sidebarOpen}
        data-collapsed={sidebarCollapsed}
        inert={drawerOpen}
        className={[
          'absolute inset-y-0 left-0 z-20 flex w-[min(var(--sidebar-width),100vw)] flex-col overflow-hidden',
          'bg-paper-solid shadow-[4px_0_24px_rgba(43,30,15,0.18)]',
          'transition-[transform,width] duration-200 ease-[var(--ease-panel)]',
          sidebarOpen ? 'translate-x-0' : 'invisible -translate-x-full',
          'md:visible md:translate-x-0',
          sidebarCollapsed ? 'md:w-[var(--sidebar-collapsed-width)]' : 'md:w-[var(--sidebar-width)]',
        ].join(' ')}
      >
        <header
          className={`flex h-[var(--editor-header-height)] shrink-0 items-center gap-3 border-b border-line ${sidebarCollapsed ? 'px-2' : 'px-3'}`}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-control bg-amber text-on-amber">
            <Compass size={20} aria-hidden="true" />
          </span>
          {!sidebarCollapsed && (
            <span className="min-w-0 truncate font-title text-base/5 font-semibold" data-testid="world-name" title={worldName}>
              {worldName}
            </span>
          )}
          <IconButton
            ref={sidebarClose}
            label="Fechar painel"
            className="ml-auto md:hidden"
            onClick={() => setSidebarOpen(false)}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </header>
        <GenerateSidebar
          world={world}
          collapsed={sidebarCollapsed}
          canCollapse={desktop}
          onCollapsedChange={(collapsed) => ui.getState().setSidebarCollapsed(collapsed)}
        />
      </aside>

      <div
        data-testid="actions"
        inert={anyOpen}
        className={[
          'absolute top-3 right-3 z-10 flex h-14 items-center rounded-panel bg-paper px-1 shadow-md backdrop-blur-[14px] md:gap-0.5 md:px-1.5',
          'md:right-[calc(var(--drawer-width)+12px)]',
        ].join(' ')}
      >
        <IconButton ref={sidebarOpener} label="Abrir painel" className="md:hidden" onClick={() => setSidebarOpen(true)}>
          <PanelLeftOpen size={20} aria-hidden="true" />
        </IconButton>
        <IconButton ref={drawerOpener} label="Abrir detalhes" className="md:hidden" onClick={() => setDrawerOpen(true)}>
          <PanelRightOpen size={20} aria-hidden="true" />
        </IconButton>
        <SearchButton label={searchLabel} />
        <IconButton label="Desfazer" title="Desfazer (Ctrl+Z)" disabled>
          <Undo2 size={20} aria-hidden="true" />
        </IconButton>
        <IconButton label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled>
          <Redo2 size={20} aria-hidden="true" />
        </IconButton>
        <IconButton label="Exportar" disabled>
          <Download size={20} aria-hidden="true" />
        </IconButton>
        <IconButton
          label={theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'}
          onClick={toggle}
        >
          {theme === 'light' ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
        </IconButton>
        <IconButton label="Ajuda" title="Ajuda ( ? )" keyShortcuts="?" onClick={openHelp}>
          <CircleHelp size={20} aria-hidden="true" />
        </IconButton>
      </div>

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocus={helpReturn} />

      <aside
        aria-label="Detalhes"
        data-testid="drawer"
        data-open={drawerOpen}
        inert={sidebarOpen}
        className={[
          'absolute inset-y-0 right-0 z-20 flex w-[min(var(--drawer-width),100vw)] flex-col',
          'bg-paper-solid shadow-lg',
          'transition-transform duration-200 ease-[var(--ease-panel)]',
          drawerOpen ? 'translate-x-0' : 'invisible translate-x-full',
          'md:visible md:w-[var(--drawer-width)] md:translate-x-0',
        ].join(' ')}
      >
        <div className="flex h-14 shrink-0 items-center justify-end px-3 md:hidden">
          <IconButton ref={drawerClose} label="Fechar detalhes" onClick={() => setDrawerOpen(false)}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex-1" />
      </aside>
    </div>
  )
}

/** Largura do elemento, acompanhada pelo `ResizeObserver` (`null` antes de medir, ou sem ele, como no jsdom). */
function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/**
 * Fica `true` dois quadros depois de a largura ser medida (`width` deixa de ser `null`): até lá, as
 * transições da linha inferior ficam desligadas, para o primeiro layout não aparecer animado.
 */
function useAnimatedAfterMeasure(width: number | null) {
  const [animated, setAnimated] = useState(false)
  const measured = width !== null
  useEffect(() => {
    if (!measured || animated) return
    // Dois quadros: o primeiro desenha a posição medida; só no seguinte a transição liga (num quadro só,
    // a posição nova e a transição podem entrar no mesmo cálculo de estilo e animar mesmo assim).
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setAnimated(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [measured, animated])
  return animated
}

/** Se a tela tem 768 px ou mais (sidebar e drawer fixos). */
function useDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY)
    const onChange = (e: { matches: boolean }) => setDesktop(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return desktop
}

/** Tipos de `input` que não recebem texto: neles a tecla `[` continua sendo o atalho. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file', 'image'])

/** Foco num campo de texto: aí a tecla `[` é do campo. */
function isTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest('textarea, select')) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)
}


/** Ao abrir o painel, foca o botão de fechar; ao fechar, devolve o foco a quem o abriu. */
function usePanelFocus(
  open: boolean,
  closeButton: RefObject<HTMLButtonElement | null>,
  opener: RefObject<HTMLButtonElement | null>,
) {
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) closeButton.current?.focus()
    else if (wasOpen.current) opener.current?.focus()
    wasOpen.current = open
  }, [open, closeButton, opener])
}

/** A partir desta largura da área livre (e de 768 px de tela), Buscar mostra o rótulo e o atalho. */
const SEARCH_LABEL_FROM = 420

/**
 * Buscar (Ctrl K), desabilitado até a busca existir (M2). Com `label`, parece um campo com o rótulo
 * e a tecla; sem, só o ícone (área livre estreita e celular).
 */
function SearchButton({ label }: { label: boolean }) {
  return (
    <button
      type="button"
      aria-label="Buscar"
      title="Buscar (Ctrl+K)"
      disabled
      data-testid="search-button"
      data-label={label}
      className={
        label
          ? 'mr-1.5 flex h-10 shrink-0 items-center gap-2 rounded-control border border-line bg-field pr-2 pl-2.5 text-[13px] font-semibold text-ink-2 disabled:opacity-55'
          : 'grid size-11 shrink-0 place-items-center rounded-control text-ink disabled:opacity-40'
      }
    >
      <Search size={label ? 18 : 20} aria-hidden="true" />
      {label && (
        <>
          <span aria-hidden="true">Buscar</span>
          <kbd aria-hidden="true" className="rounded-[4px] border border-line bg-sunken px-[5px] font-sans text-[11px]/[18px] font-bold">
            Ctrl K
          </kbd>
        </>
      )}
    </button>
  )
}

/**
 * Botão de ícone da barra (44 × 44). `title` é o texto do tooltip (o rótulo, se não vier). Com
 * `disabled`, a função ainda não existe: opacidade .4 (design system → Botão de ícone).
 */
function IconButton({
  ref,
  label,
  title = label,
  keyShortcuts,
  disabled = false,
  className = '',
  onClick,
  children,
}: {
  ref?: Ref<HTMLButtonElement>
  label: string
  title?: string
  keyShortcuts?: string
  disabled?: boolean
  className?: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-keyshortcuts={keyShortcuts}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-11 shrink-0 place-items-center rounded-control text-ink enabled:hover:bg-hover enabled:active:bg-press disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}
