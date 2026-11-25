import { Cloud, CloudOff, FileJson, LoaderCircle, RotateCw } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { SaveStore } from '../../persistence/autosave'

/**
 * Indicador de salvamento, abaixo do nome do mundo na barra da sidebar (design-system.md →
 * Feedback, AC-F4-02): "Salvando…" (`loader-circle` girando, `--ink-2`), "Salvo" (`cloud`, `--ok`)
 * e "Erro ao salvar" (`cloud-off`, `--brick-ink` sobre `--brick-soft`). Com erro, ele vira um botão
 * que abre o menu com "Tentar de novo" (grava já) e "Exportar .json" (o backup: baixa o arquivo do
 * mundo como está na tela, `onExport`; sem ele, desabilitado). Esc ou um clique fora fecha o menu.
 */
export function SaveIndicator({ save, onExport }: { save: SaveStore; onExport?: () => Promise<void> }) {
  const status = useStore(save, (s) => s.status)
  const [menuOpen, setMenuOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const firstItem = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  // O menu é do erro: se o salvamento volta a dar certo, ele fecha (e não reabre no próximo erro).
  const [prevStatus, setPrevStatus] = useState(status)
  if (status !== prevStatus) {
    setPrevStatus(status)
    if (status !== 'error') setMenuOpen(false)
  }
  const open = menuOpen && status === 'error'

  useEffect(() => {
    if (!open) return
    firstItem.current?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setMenuOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const label = 'flex items-center gap-[5px] text-xs/4 font-bold'
  return (
    <div ref={root} className="relative" data-testid="save-indicator" data-status={status}>
      <span role="status" className="sr-only">
        {status === 'saving' ? 'Salvando…' : status === 'saved' ? 'Salvo' : 'Erro ao salvar'}
      </span>
      {status === 'saving' && (
        <span aria-hidden="true" className={`${label} px-1.5 text-ink-2`}>
          <LoaderCircle size={13} className="animate-spin [animation-duration:900ms]" />
          Salvando…
        </span>
      )}
      {status === 'saved' && (
        <span aria-hidden="true" className={`${label} px-1.5 text-ok`}>
          <Cloud size={13} />
          Salvo
        </span>
      )}
      {status === 'error' && (
        <button
          ref={button}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setMenuOpen((o) => !o)}
          className={`${label} rounded-full bg-brick-soft px-1.5 text-brick-ink hover:brightness-95`}
        >
          <CloudOff size={13} aria-hidden="true" />
          Erro ao salvar
        </button>
      )}
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Erro ao salvar"
          className="absolute top-full left-0 z-30 mt-1 flex w-52 flex-col rounded-control border border-line bg-paper-solid p-1 shadow-lg"
        >
          <button
            ref={firstItem}
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              save.getState().retry()
            }}
            className="flex h-10 items-center gap-2 rounded-control px-2.5 text-left text-sm font-semibold text-ink hover:bg-hover active:bg-press"
          >
            <RotateCw size={16} aria-hidden="true" />
            Tentar de novo
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!onExport}
            onClick={() => {
              setMenuOpen(false)
              void onExport?.().catch(() => undefined)
            }}
            className="flex h-10 items-center gap-2 rounded-control px-2.5 text-left text-sm font-semibold text-ink enabled:hover:bg-hover enabled:active:bg-press disabled:opacity-50"
          >
            <FileJson size={16} aria-hidden="true" />
            Exportar .json
          </button>
        </div>
      )}
    </div>
  )
}
