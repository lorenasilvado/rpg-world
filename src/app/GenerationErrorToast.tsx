import { useStore } from 'zustand'
import type { WorldStore } from '../state/worldStore'

/**
 * Toast de erro da geração (geracao-terreno.md → Estados, AC-F1-12): aparece quando o pedido mais
 * novo falha (a geração ou o worker) e some quando uma geração nova começa. "Tentar de novo" gera
 * o mapa final de novo, com a seed e os parâmetros atuais.
 *
 * Fica dentro da linha inferior do editor (`EditorLayout`), que é um container: a posição depende da
 * largura da área livre, não da tela, para nunca cobrir o minimapa (design-system.md → Layout do
 * Editor: toasts acima do controle de zoom). As alturas são a partir da base da linha (16 px da tela):
 * - 568 px ou mais: no canto direito, 12 px acima do controle de zoom (56 px). Cabe ao lado do
 *   minimapa: 16 + 174 (minimapa) + 12 + 349 (toast) + 16 ≈ 568.
 * - Abaixo: na largura da área, 12 px acima do minimapa aberto (140 px) ou, recolhido (34 px),
 *   acima do zoom, que é o mais alto.
 * - Abaixo de 360 px, o minimapa fica empilhado 68 px acima da base da linha, e o toast sobe junto.
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
        'toast-in pointer-events-auto absolute right-4 left-4 z-[2] flex items-center gap-3 rounded-panel bg-brick py-2 pr-2 pl-4 text-white shadow-lg',
        aboveMinimap
          ? 'bottom-[152px] @max-[360px]:bottom-[220px] @min-[568px]:bottom-[68px]'
          : 'bottom-[68px] @max-[360px]:bottom-[114px]',
        '@min-[568px]:left-auto',
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
