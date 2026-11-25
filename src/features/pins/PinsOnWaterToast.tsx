import { useEffect } from 'react'
import { BAR_GAP, BAR_SIDE, TOAST_WIDTH, ZOOM_BAR_HEIGHT, ZOOM_SIDE } from '../map/bottomBarLayout'
import { pinsOnWaterLabel } from './place'

/** Quanto tempo o aviso de pins sobre a água fica à vista. */
export const PINS_ON_WATER_TOAST_MS = 6000

/**
 * Aviso "N pins ficaram sobre a água" (geracao-terreno.md → Estados: Aviso, AC-F1-30): aparece quando
 * o mapa final regerado deixa pins em célula de oceano ou de lago, com a ação "Mostrar" (`onShow`, que
 * centraliza a câmera no primeiro deles). Os pins não se movem. Some depois de
 * `PINS_ON_WATER_TOAST_MS`, ao Mostrar, ou quando `onClose` é chamado.
 *
 * Fica na linha inferior do editor, no lugar dos toasts (`bottomBarLayout`), como o "Pin excluído":
 * `--paper-solid`, `--shadow-lg` e a ação em `--amber-ink` 800 (design-system.md → Toast).
 */
export function PinsOnWaterToast({
  open,
  count,
  onShow,
  onClose,
  beside = true,
  bottom = ZOOM_BAR_HEIGHT + BAR_GAP,
  right = ZOOM_SIDE,
}: {
  /** Muda a cada mapa que deixa pins sobre a água (o tempo recomeça); `null` fecha. */
  open: number | null
  count: number
  onShow: () => void
  onClose: () => void
  beside?: boolean
  bottom?: number
  right?: number
}) {
  useEffect(() => {
    if (open === null) return
    const timer = setTimeout(onClose, PINS_ON_WATER_TOAST_MS)
    return () => clearTimeout(timer)
  }, [open, onClose])

  if (open === null) return null
  return (
    <div
      role="status"
      data-testid="pins-on-water-toast"
      style={{ bottom, right, ...(beside ? { width: TOAST_WIDTH } : { left: BAR_SIDE }) }}
      className="toast-in pointer-events-auto absolute z-[2] flex items-center gap-3 rounded-panel bg-paper-solid py-2 pr-2 pl-4 text-ink shadow-lg"
    >
      <span className="flex-1 font-semibold">{pinsOnWaterLabel(count)}</span>
      <button
        type="button"
        onClick={onShow}
        className="h-11 rounded-control px-3 font-extrabold text-amber-ink hover:bg-hover active:bg-press"
      >
        Mostrar
      </button>
    </div>
  )
}
