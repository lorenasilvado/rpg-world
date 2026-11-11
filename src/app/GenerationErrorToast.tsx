import { useStore } from 'zustand'
import type { WorldStore } from '../state/worldStore'

/**
 * Toast de erro da geração (geracao-terreno.md → Estados, AC-F1-12): aparece quando o pedido mais
 * novo falha (a geração ou o worker) e some quando uma geração nova começa. "Tentar de novo" gera
 * o mapa final de novo, com a seed e os parâmetros atuais. Fica no canto inferior direito da área
 * do mapa (design-system.md → Layout do Editor: toasts acima do controle de zoom).
 */
export function GenerationErrorToast({ world, inert }: { world: WorldStore; inert?: boolean }) {
  const status = useStore(world, (s) => s.status)
  if (status !== 'error') return null
  return (
    <div
      role="alert"
      data-testid="generation-error-toast"
      inert={inert}
      className={[
        'toast-in absolute right-4 bottom-4 left-4 z-10 flex items-center gap-3 rounded-panel bg-brick py-2 pr-2 pl-4 text-white shadow-lg',
        'md:left-auto md:right-[calc(var(--drawer-width)+16px)]',
      ].join(' ')}
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
