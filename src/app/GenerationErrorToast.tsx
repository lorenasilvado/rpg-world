import { useStore } from 'zustand'
import { BAR_GAP, BAR_SIDE, TOAST_WIDTH, ZOOM_BAR_HEIGHT, ZOOM_SIDE } from '../features/map/bottomBarLayout'
import type { WorldStore } from '../state/worldStore'

/**
 * Toast de erro da geração (geracao-terreno.md → Estados, AC-F1-12): aparece quando o pedido mais
 * novo falha (a geração ou o worker) e some quando uma geração nova começa. "Tentar de novo" gera
 * o mapa final de novo, com a seed e os parâmetros atuais.
 *
 * Fica dentro da linha inferior do editor, que decide a posição (`bottomBarLayout`): `bottom` é a
 * base do toast a partir da base da linha; à direita, ele fica alinhado com o controle de zoom. Com
 * `beside`, ele fica no canto direito, com
 * `TOAST_WIDTH`, e senão ocupa a largura da área livre (design-system.md → Layout do Editor: toasts
 * acima do controle de zoom, sem cobrir o minimapa).
 */
export function GenerationErrorToast({
  world,
  beside = true,
  bottom = ZOOM_BAR_HEIGHT + BAR_GAP,
}: {
  world: WorldStore
  beside?: boolean
  bottom?: number
}) {
  const status = useStore(world, (s) => s.status)
  if (status !== 'error') return null
  return (
    <div
      role="alert"
      data-testid="generation-error-toast"
      style={{ bottom, right: ZOOM_SIDE, ...(beside ? { width: TOAST_WIDTH } : { left: BAR_SIDE }) }}
      className="toast-in pointer-events-auto absolute z-[2] flex items-center gap-3 rounded-panel bg-brick py-2 pr-2 pl-4 text-white shadow-lg"
    >
      <span className="flex-1 font-semibold">Não foi possível gerar o mapa</span>
      <button
        type="button"
        onClick={() => world.getState().generate()}
        className="h-11 rounded-control bg-white/18 px-3 font-extrabold hover:bg-white/28 active:bg-white/36"
      >
        Tentar de novo
      </button>
    </div>
  )
}
