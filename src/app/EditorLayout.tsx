import { Compass, Moon, PanelLeftOpen, PanelRightOpen, Sun, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTheme } from './useTheme'

/**
 * Casca vazia do editor (design-system.md → Layout do Editor):
 * mapa em tela cheia atrás dos painéis, sidebar à esquerda (320 px) e drawer à direita (400 px).
 * Abaixo de 768 px, sidebar e drawer viram painéis sobrepostos, abertos pelos botões da barra.
 */
export function EditorLayout() {
  const { theme, toggle } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const anyOpen = sidebarOpen || drawerOpen

  const closeAll = () => {
    setSidebarOpen(false)
    setDrawerOpen(false)
  }

  return (
    <div className="relative h-full overflow-hidden bg-map-canvas" data-testid="editor">
      <main aria-label="Mapa" data-testid="map" className="absolute inset-0 bg-map-canvas" />

      {anyOpen && (
        <div
          aria-hidden="true"
          data-testid="scrim"
          className="absolute inset-0 z-10 bg-scrim md:hidden"
          onClick={closeAll}
        />
      )}

      <aside
        aria-label="Gerar mundo"
        data-testid="sidebar"
        data-open={sidebarOpen}
        className={[
          'absolute inset-y-0 left-0 z-20 flex w-[min(var(--sidebar-width),100vw)] flex-col',
          'bg-paper-solid shadow-[4px_0_24px_rgba(43,30,15,0.18)]',
          'transition-transform duration-200 ease-[var(--ease-panel)]',
          sidebarOpen ? 'translate-x-0' : 'invisible -translate-x-full',
          'md:visible md:w-[var(--sidebar-width)] md:translate-x-0',
        ].join(' ')}
      >
        <header className="flex h-[var(--editor-header-height)] shrink-0 items-center gap-3 border-b border-line px-3">
          <span className="grid size-8 place-items-center rounded-control bg-amber text-on-amber">
            <Compass size={20} aria-hidden="true" />
          </span>
          <span className="font-title text-base/5 font-semibold">RPG World Builder</span>
          <IconButton label="Fechar painel" className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </header>
        <div className="flex h-11 items-center border-b border-line px-4 text-xs font-extrabold tracking-[0.08em] text-ink-2 uppercase">
          Gerar mundo
        </div>
        <div className="flex-1" />
      </aside>

      <div
        data-testid="actions"
        className={[
          'absolute top-3 right-3 z-10 flex h-14 items-center gap-1 rounded-panel bg-paper px-2 shadow-md backdrop-blur-[14px]',
          'md:right-[calc(var(--drawer-width)+12px)]',
        ].join(' ')}
      >
        <IconButton label="Abrir painel" className="md:hidden" onClick={() => setSidebarOpen(true)}>
          <PanelLeftOpen size={20} aria-hidden="true" />
        </IconButton>
        <IconButton label="Abrir detalhes" className="md:hidden" onClick={() => setDrawerOpen(true)}>
          <PanelRightOpen size={20} aria-hidden="true" />
        </IconButton>
        <IconButton
          label={theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'}
          onClick={toggle}
        >
          {theme === 'light' ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
        </IconButton>
      </div>

      <aside
        aria-label="Detalhes"
        data-testid="drawer"
        data-open={drawerOpen}
        className={[
          'absolute inset-y-0 right-0 z-20 flex w-[min(var(--drawer-width),100vw)] flex-col',
          'bg-paper-solid shadow-lg',
          'transition-transform duration-200 ease-[var(--ease-panel)]',
          drawerOpen ? 'translate-x-0' : 'invisible translate-x-full',
          'md:visible md:w-[var(--drawer-width)] md:translate-x-0',
        ].join(' ')}
      >
        <div className="flex h-14 shrink-0 items-center justify-end px-3 md:hidden">
          <IconButton label="Fechar detalhes" onClick={() => setDrawerOpen(false)}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex-1" />
      </aside>
    </div>
  )
}

function IconButton({
  label,
  className = '',
  onClick,
  children,
}: {
  label: string
  className?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
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
