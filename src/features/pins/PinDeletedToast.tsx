import { useEffect } from 'react'
import { BAR_GAP, BAR_SIDE, TOAST_WIDTH, ZOOM_BAR_HEIGHT, ZOOM_SIDE } from '../map/bottomBarLayout'

/** Quanto tempo o toast "Pin excluído" fica à vista. */
export const PIN_DELETED_TOAST_MS = 6000

/**
 * Toast "Pin excluído" (pins.md → Estados: Excluído, AC-F3-05), ou "Estrada excluída" (`message`,
 * estradas.md AC-F5-08): aparece ao excluir um pin (ou uma estrada), com a ação
 * "Desfazer" (`onUndo`, o desfazer do histórico do mundo, que devolve o pin com a ficha inteira). Some
 * depois de `PIN_DELETED_TOAST_MS`, ou quando `onClose` é chamado (outra mudança no histórico).
 *
 * Fica na linha inferior do editor, no lugar dos toasts (`bottomBarLayout`), como o toast de erro da
 * geração: `--paper-solid`, `--shadow-lg` e a ação em `--amber-ink` 800 (design-system.md → Toast).
 */
export function PinDeletedToast({
  open,
  message = 'Pin excluído',
  onUndo,
  onClose,
  beside = true,
  bottom = ZOOM_BAR_HEIGHT + BAR_GAP,
  right = ZOOM_SIDE,
}: {
  /** Muda a cada exclusão (o tempo recomeça); `null` fecha. */
  open: number | null
  /** O texto do toast: "Pin excluído" ou, para a estrada (estradas.md, AC-F5-08), "Estrada excluída". */
  message?: string
  /** Sem ele, o toast não tem "Desfazer" (nada a desfazer: "Conectar cidades" sem estrada nova). */
  onUndo?: () => void
  onClose: () => void
  beside?: boolean
  bottom?: number
  right?: number
}) {
  useEffect(() => {
    if (open === null) return
    const timer = setTimeout(onClose, PIN_DELETED_TOAST_MS)
    return () => clearTimeout(timer)
  }, [open, onClose])

  if (open === null) return null
  return (
    <div
      role="status"
      data-testid="pin-deleted-toast"
      style={{ bottom, right, ...(beside ? { width: TOAST_WIDTH } : { left: BAR_SIDE }) }}
      className="toast-in pointer-events-auto absolute z-[2] flex items-center gap-3 rounded-panel bg-paper-solid py-2 pr-2 pl-4 text-ink shadow-lg"
    >
      <span className="flex-1 leading-5 font-semibold">{message}</span>
      {onUndo ? (
        <button
          type="button"
          onClick={onUndo}
          className="h-11 rounded-control px-3 font-extrabold text-amber-ink hover:bg-hover active:bg-press"
        >
          Desfazer
        </button>
      ) : (
        <span aria-hidden className="h-11" />
      )}
    </div>
  )
}
