import { Copy, Download, Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type WorldMenuAction = 'rename' | 'duplicate' | 'export' | 'delete'

/**
 * O botão "⋯" do cartão e o menu dele (mundos.md → 01 · Lista de mundos, AC-F4-07): Renomear,
 * Duplicar, Exportar (baixa o arquivo do mundo, .json) e, após um separador, Excluir em vermelho.
 * O menu abre abaixo do botão (ou acima, se não cabe abaixo), alinhado à direita do
 * cartão, com o foco no primeiro item; setas, Home e End andam entre os itens habilitados, Esc fecha e devolve o foco ao "⋯", e
 * Tab ou um clique fora fecham.
 */
export function WorldCardMenu({
  worldName,
  open,
  onOpenChange,
  onAction,
  buttonRef,
}: {
  worldName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (action: WorldMenuAction) => void
  /** Recebe o "⋯", para quem fecha um modal aberto pelo menu devolver o foco a ele. */
  buttonRef: (button: HTMLButtonElement | null) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()
  // O pai passa uma função nova a cada render: o efeito lê a atual sem reabrir (e sem roubar o foco).
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })

  // Abre para cima quando não cabe abaixo do cartão (o último da grade, no celular) e cabe acima.
  const [up, setUp] = useState(false)
  useLayoutEffect(() => {
    if (!open || !root.current || !menu.current) return
    const button = root.current.getBoundingClientRect()
    const height = menu.current.offsetHeight + MENU_GAP
    setUp(button.bottom + height > window.innerHeight && button.top - height >= 0)
  }, [open])

  useEffect(() => {
    if (!open) return
    items(menu.current)[0]?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onOpenChangeRef.current(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    onOpenChange(false)
    button.current?.focus()
  }

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const list = items(menu.current)
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    const move = (i: number) => {
      e.preventDefault()
      list[(i + list.length) % list.length]?.focus()
    }
    if (e.key === 'ArrowDown') move(at + 1)
    else if (e.key === 'ArrowUp') move(at - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(list.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') onOpenChange(false)
  }

  const choose = (action: WorldMenuAction) => {
    close()
    onAction(action)
  }

  return (
    <div ref={root} className="absolute right-2 bottom-3">
      <button
        ref={(el) => {
          button.current = el
          buttonRef(el)
        }}
        type="button"
        aria-label={`Mais ações de ${worldName}`}
        title="Mais ações"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            onOpenChange(true)
          }
        }}
        className={[
          'grid size-11 place-items-center rounded-control text-ink hover:bg-hover active:bg-press',
          open ? 'bg-press' : '',
          'focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none',
        ].join(' ')}
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={`Ações de ${worldName}`}
          onKeyDown={onMenuKeyDown}
          data-testid="world-card-menu"
          data-placement={up ? 'up' : 'down'}
          style={up ? { bottom: `calc(100% + ${MENU_GAP}px)` } : { top: `calc(100% + ${MENU_GAP}px)` }}
          className="absolute right-[-8px] z-30 flex w-[216px] flex-col rounded-panel border border-line bg-paper-solid p-1.5 shadow-lg"
        >
          <MenuItem icon={<Pencil size={18} />} onClick={() => choose('rename')}>
            Renomear
          </MenuItem>
          <MenuItem icon={<Copy size={18} />} onClick={() => choose('duplicate')}>
            Duplicar
          </MenuItem>
          <MenuItem icon={<Download size={18} />} title="Exportar o arquivo do mundo (.json)" onClick={() => choose('export')}>
            Exportar
          </MenuItem>
          <div role="separator" className="mx-2 my-1 h-px bg-line" />
          <MenuItem icon={<Trash2 size={18} />} danger onClick={() => choose('delete')}>
            Excluir
          </MenuItem>
        </div>
      )}
    </div>
  )
}

/** A distância entre o "⋯" e o menu: abaixo, ele começa logo depois do contorno do cartão. */
const MENU_GAP = 20

/** Os itens habilitados do menu, na ordem. */
function items(menu: HTMLElement | null): HTMLButtonElement[] {
  return menu ? [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')] : []
}

function MenuItem({
  icon,
  onClick,
  disabled,
  danger,
  title,
  children,
}: {
  icon: ReactNode
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={title}
      onClick={onClick}
      className={[
        'flex h-11 items-center gap-2.5 rounded-control px-2.5 text-left text-sm font-semibold outline-none',
        danger ? 'text-brick-ink' : 'text-ink',
        'enabled:hover:bg-hover enabled:focus:bg-hover enabled:active:bg-press disabled:opacity-50',
      ].join(' ')}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      {children}
    </button>
  )
}
