import { useStore } from 'zustand'
import type { WorldStore } from '../state/worldStore'

/**
 * Toast de erro da geração (geracao-terreno.md → Estados, AC-F1-12): aparece quando o pedido mais
 * novo falha (a geração ou o worker) e some quando uma geração nova começa. "Tentar de novo" gera
 * o mapa final de novo, com a seed e os parâmetros atuais. Fica no canto inferior direito da área
 * do mapa, logo acima do controle de zoom (design-system.md → Layout do Editor): 56 px dele e 12 px de
 * folga sobre os 16 px da base. Abaixo de 768 px, ele ocupa a largura da tela, e com o minimapa aberto
 * (`aboveMinimap`) sobe para acima dele, para não cobri-lo.
 */
export function GenerationErrorToast({
  world,
  inert,
  aboveMinimap = false,
}: {
  world: WorldStore
  inert?: boolean
  aboveMinimap?: boolean
}) {
  const status = useStore(world, (s) => s.status)
  if (status !== 'error') return null
  return (
    <div
      role="alert"
      data-testid="generation-error-toast"
      inert={inert}
      className={[
        'toast-in absolute right-4 left-4 z-10 flex items-center gap-3 rounded-panel bg-brick py-2 pr-2 pl-4 text-white shadow-lg',
        // No celular, o toast ocupa a largura: com o minimapa aberto (140 px de altura), ele sobe acima
        // dele; recolhido, o controle de zoom (56 px) é o mais alto da linha inferior. Abaixo de 360 px,
        // o minimapa fica empilhado 68 px acima da base da linha (EditorLayout), e o toast sobe junto:
        // 16 + 68 + 140 (ou 34, recolhido) + 12.
        aboveMinimap ? 'bottom-[168px] max-[360px]:bottom-[236px]' : 'bottom-[84px] max-[360px]:bottom-[130px]',
        'md:bottom-[84px] md:left-auto md:right-[calc(var(--drawer-width)+16px)]',
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
