import { Compass, Moon, PanelLeftOpen, PanelRightOpen, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { useStore } from 'zustand'
import { GenerateSidebar } from '../features/sidebar/GenerateSidebar'
import type { UiStore } from '../state/uiStore'
import type { WorldStore } from '../state/worldStore'
import { GenerationErrorToast } from './GenerationErrorToast'
import { inDialog } from '../render/camera'
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
  const desktop = useDesktop()
  const sidebarCollapsed = useStore(ui, (s) => s.sidebarCollapsed) && desktop
  const anyOpen = sidebarOpen || drawerOpen
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
    if (!anyOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [anyOpen])

  return (
    <div className="relative h-full overflow-hidden bg-map-canvas" data-testid="editor" data-generation-status={generationStatus}>
      <MapView world={world} ui={ui} inert={anyOpen} createRenderer={createRenderer} />

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
          'absolute top-3 right-3 z-10 flex h-14 items-center gap-1 rounded-panel bg-paper px-2 shadow-md backdrop-blur-[14px]',
          'md:right-[calc(var(--drawer-width)+12px)]',
        ].join(' ')}
      >
        <IconButton ref={sidebarOpener} label="Abrir painel" className="md:hidden" onClick={() => setSidebarOpen(true)}>
          <PanelLeftOpen size={20} aria-hidden="true" />
        </IconButton>
        <IconButton ref={drawerOpener} label="Abrir detalhes" className="md:hidden" onClick={() => setDrawerOpen(true)}>
          <PanelRightOpen size={20} aria-hidden="true" />
        </IconButton>
        <IconButton
          label={theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'}
          onClick={toggle}
        >
          {theme === 'light' ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
        </IconButton>
      </div>

      <GenerationErrorToast world={world} inert={anyOpen} />

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

function IconButton({
  ref,
  label,
  className = '',
  onClick,
  children,
}: {
  ref?: Ref<HTMLButtonElement>
  label: string
  className?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-11 place-items-center rounded-control text-ink hover:bg-hover active:bg-press ${className}`}
    >
      {children}
    </button>
  )
}
