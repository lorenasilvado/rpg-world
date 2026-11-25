import { Download, FileJson, Image } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { MapImageOptions } from '../../render/mapImage'
import { ExportImageDialog } from './ExportImageDialog'

/**
 * O Exportar da barra do editor (mundos.md → Ações, AC-F4-09, AC-F4-11): o botão abre o menu com
 * "Arquivo do mundo (.json)", que baixa o mundo como está na tela (`onExportJson`), e "Imagem
 * (.png)", que fecha o menu e abre o modal "Exportar imagem" (`ExportImageDialog`, que chama
 * `onExportImage`; ao fechar, o foco volta ao botão). O menu abre abaixo do botão, alinhado à direita,
 * com o foco no primeiro item; setas, Home e End andam entre os itens habilitados; Esc fecha e
 * devolve o foco ao botão; Tab ou um clique fora fecham. Se a exportação falha, o menu continua
 * aberto com o aviso. Sem `onExportJson` (testes), o botão fica desabilitado; sem `onExportImage`,
 * o item "Imagem (.png)".
 */
export function ExportMenu({
  onExportJson,
  onExportImage,
}: {
  onExportJson?: () => Promise<void>
  onExportImage?: (options: MapImageOptions) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'exporting' | 'error'>('idle')
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    items(menu.current)[0]?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const toggle = (next: boolean) => {
    setOpen(next)
    if (next) setState('idle')
  }

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  const exportJson = async () => {
    if (!onExportJson || state === 'exporting') return
    setState('exporting')
    try {
      await onExportJson()
    } catch {
      setState('error')
      return
    }
    setState('idle')
    close()
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
    } else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Exportar"
        title="Exportar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={!onExportJson}
        onClick={() => toggle(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            toggle(true)
          }
        }}
        className={[
          'grid size-11 shrink-0 place-items-center rounded-control text-ink enabled:hover:bg-hover enabled:active:bg-press disabled:opacity-40',
          open ? 'bg-press' : '',
        ].join(' ')}
      >
        <Download size={20} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label="Exportar"
          data-testid="export-menu"
          onKeyDown={onMenuKeyDown}
          className="absolute top-[calc(100%+14px)] right-[-6px] z-30 flex w-[244px] flex-col rounded-panel border border-line bg-paper-solid p-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={state === 'exporting'}
            onClick={() => void exportJson()}
            className={ITEM}
          >
            <FileJson size={18} aria-hidden="true" className="shrink-0" />
            {state === 'exporting' ? 'Exportando…' : 'Arquivo do mundo (.json)'}
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={!onExportImage || state === 'exporting'}
            onClick={() => {
              setOpen(false)
              setImageOpen(true)
            }}
            className={ITEM}
          >
            <Image size={18} aria-hidden="true" className="shrink-0" />
            Imagem (.png)
          </button>
          {state === 'error' && (
            <p role="alert" className="mx-1 mt-1 mb-0.5 rounded-control bg-brick-soft px-2.5 py-2 text-[13px]/[18px] font-semibold text-brick-ink">
              Não foi possível exportar o mundo. Tente de novo.
            </p>
          )}
        </div>
      )}
      {onExportImage && (
        <ExportImageDialog
          open={imageOpen}
          onExport={onExportImage}
          onClose={() => setImageOpen(false)}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            button.current?.focus()
          }}
        />
      )}
    </div>
  )
}

const ITEM = [
  'flex h-11 items-center gap-2.5 rounded-control px-2.5 text-left text-sm font-semibold text-ink outline-none',
  'enabled:hover:bg-hover enabled:focus:bg-hover enabled:active:bg-press disabled:opacity-50',
].join(' ')

/** Os itens habilitados do menu, na ordem. */
function items(menu: HTMLElement | null): HTMLButtonElement[] {
  return menu ? [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')] : []
}
