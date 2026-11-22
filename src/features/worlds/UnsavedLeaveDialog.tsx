import * as Dialog from '@radix-ui/react-dialog'
import { CloudOff } from 'lucide-react'

/**
 * Ao voltar à Lista de mundos com o salvamento em "Erro ao salvar" (mundos.md → Ações): as últimas
 * mudanças do mundo não estão no banco, e fechar o mundo as perderia. O modal pergunta antes:
 * "Tentar de novo" grava já (e volta se der certo), "Voltar sem salvar" volta mesmo assim e "Ficar
 * no mundo" (ou Esc, ou o clique fora) fecha o modal e mantém o editor.
 */
export function UnsavedLeaveDialog({
  open,
  retrying,
  onRetry,
  onLeave,
  onStay,
}: {
  open: boolean
  /** Enquanto "Tentar de novo" grava: os botões ficam desabilitados. */
  retrying: boolean
  onRetry: () => void
  onLeave: () => void
  onStay: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onStay()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          data-testid="unsaved-leave-dialog"
          className={[
            'fixed top-1/2 left-1/2 z-50 flex w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3',
            'rounded-modal bg-paper-solid p-6 text-ink shadow-lg outline-none sm:p-7',
          ].join(' ')}
        >
          <Dialog.Title className="flex items-center gap-2 font-title text-2xl/8 font-semibold">
            <CloudOff size={22} aria-hidden="true" className="shrink-0 text-brick-ink" />
            Mudanças não salvas
          </Dialog.Title>
          <Dialog.Description className="text-sm/5 text-ink-2">
            As últimas mudanças deste mundo não foram salvas no navegador. Se voltar à lista agora, elas se perdem.
          </Dialog.Description>
          <div className="mt-3 flex flex-wrap justify-end gap-3">
            <Dialog.Close type="button" disabled={retrying} className={SECONDARY}>
              Ficar no mundo
            </Dialog.Close>
            <button type="button" disabled={retrying} onClick={onLeave} className={`${SECONDARY} text-brick-ink`}>
              Voltar sem salvar
            </button>
            <button type="button" disabled={retrying} onClick={onRetry} className={PRIMARY}>
              {retrying ? 'Salvando…' : 'Tentar de novo'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const FOCUS = 'focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none'

const SECONDARY = [
  'h-11 rounded-control border border-line-2 bg-field px-4 text-sm font-bold text-ink',
  'enabled:hover:border-ink-3 enabled:hover:bg-sunken enabled:active:bg-press disabled:opacity-60',
  FOCUS,
].join(' ')

const PRIMARY = [
  'h-11 rounded-control border border-transparent bg-amber px-4 text-sm font-bold text-on-amber',
  'enabled:hover:bg-[var(--amber-hover)] enabled:active:bg-[var(--amber-press)] disabled:opacity-60',
  FOCUS,
].join(' ')
