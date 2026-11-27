import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CameraState } from '../../state/cameraStore'
import { HINT_TOP_PX } from './MeasureTool'

/** Distância mínima da dica às bordas laterais da área do mapa. */
const HINT_GUTTER_PX = 12

/**
 * A dica de uma ferramenta de estrada (Desenhar estrada, Rota automática), no topo da área livre do
 * mapa: a região `status`, uma pílula escura com borda âmbar e o ícone da ferramenta, em 16/22
 * negrito, maior que a da Régua para não passar despercebida; numa área estreita (celular), ela
 * quebra em linhas, a 12 px das bordas. `action` é um botão depois do texto ("Conectar cidades", na
 * Rota automática), depois de um ponto separador.
 */
export function ToolHint({
  icon: Icon,
  text,
  cam,
  testId,
  textTestId,
  action,
}: {
  icon: LucideIcon
  text: string
  cam: Pick<CameraState, 'origin' | 'view' | 'scale'>
  testId: string
  textTestId: string
  action?: ReactNode
}) {
  const left = cam.origin.x + (cam.view.width * cam.scale) / 2
  return (
    <div
      role="status"
      data-testid={testId}
      style={{ left, top: HINT_TOP_PX, maxWidth: Math.max(160, cam.view.width * cam.scale - HINT_GUTTER_PX * 2) }}
      className="absolute flex w-max -translate-x-1/2 items-center gap-2.5 rounded-[22px] border-2 border-[#D99A3A] bg-[#2B2420] py-3 pr-5 pl-4 text-[16px]/[22px] font-bold text-[#F7F1E3] shadow-lg"
    >
      <Icon aria-hidden size={20} strokeWidth={2.25} className="shrink-0 text-[#D99A3A]" />
      <span data-testid={textTestId}>{text}</span>
      {action && (
        <>
          <span aria-hidden className="text-[#D99A3A]">
            ·
          </span>
          {action}
        </>
      )}
    </div>
  )
}
