import { X } from 'lucide-react'
import { BAR_GAP, BAR_SIDE, TOAST_WIDTH, ZOOM_BAR_HEIGHT, ZOOM_SIDE } from '../map/bottomBarLayout'

/**
 * Toast Sem caminho (estradas.md → Estados: Sem caminho, AC-F5-13): a Rota automática não achou
 * caminho por terra entre dois pins. É o toast de erro (`--brick`, texto branco, ação com fundo
 * branco a 18%, como o da geração), com a ação "Criar rota marítima" (`onCreateSea`) e o botão
 * Fechar (`onClose`). Sem a ação (`onCreateSea` ausente, quando nem pela água há caminho), fica só
 * o texto e o Fechar. Com `busy`, a ação espera o worker ("Calculando…", desabilitada).
 *
 * Não some sozinho: fica até ser fechado, até a rota marítima ser criada ou até outra mudança no
 * histórico. Fica na linha inferior do editor, no lugar dos toasts (`bottomBarLayout`), acima dos outros.
 */
export function NoPathToast({
  message,
  onCreateSea,
  busy = false,
  onClose,
  beside = true,
  bottom = ZOOM_BAR_HEIGHT + BAR_GAP,
  right = ZOOM_SIDE,
}: {
  message: string
  onCreateSea?: () => void
  busy?: boolean
  onClose: () => void
  beside?: boolean
  bottom?: number
  right?: number
}) {
  return (
    <div
      role="alert"
      data-testid="no-path-toast"
      style={{ bottom, right, ...(beside ? { width: TOAST_WIDTH } : { left: BAR_SIDE }) }}
      className="toast-in pointer-events-auto absolute z-[2] flex items-center gap-2 rounded-panel bg-brick py-2 pr-1 pl-4 text-white shadow-lg"
    >
      <span className="flex-1 py-1 font-semibold" data-testid="no-path-message">
        {message}
      </span>
      {onCreateSea && (
        <button
          type="button"
          onClick={onCreateSea}
          disabled={busy}
          className="h-11 shrink-0 rounded-control bg-white/18 px-3 font-extrabold hover:bg-white/28 active:bg-white/36 disabled:opacity-70 disabled:hover:bg-white/18"
        >
          {busy ? 'Calculando…' : 'Criar rota marítima'}
        </button>
      )}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="grid size-11 shrink-0 place-items-center rounded-control hover:bg-white/18 active:bg-white/28"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
