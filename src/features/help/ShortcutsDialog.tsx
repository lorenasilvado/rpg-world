import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { RefObject } from 'react'
import { SHORTCUTS } from './shortcuts'

/**
 * Modal "Atalhos de teclado" (navegacao.md, AC-F2-12), aberto pela Ajuda da barra superior ou pela
 * tecla ?. Fecha pelo X, por Esc ou por um clique fora; o foco volta para `returnFocus` (o elemento
 * que tinha o foco ao abrir, guardado por quem abre: o Radix sozinho o deixa no `body`).
 */
export function ShortcutsDialog({
  open,
  onClose,
  returnFocus,
}: {
  open: boolean
  onClose: () => void
  returnFocus?: RefObject<HTMLElement | null>
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            const target = returnFocus?.current
            if (!target?.isConnected) return
            e.preventDefault()
            target.focus()
          }}
          data-testid="shortcuts-dialog"
          className={[
            'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(620px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-modal bg-paper-solid text-ink shadow-lg outline-none',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3 pt-5 pr-4 pb-1 pl-5 sm:pl-7">
            <Dialog.Title className="font-title text-2xl/8 font-semibold">Atalhos de teclado</Dialog.Title>
            <Dialog.Close
              type="button"
              aria-label="Fechar"
              title="Fechar"
              className="grid size-11 shrink-0 place-items-center rounded-control text-ink hover:bg-hover active:bg-press"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <dl className="grid min-h-0 grid-cols-1 gap-x-8 overflow-y-auto px-5 pt-2 pb-7 sm:grid-cols-2 sm:px-7">
            {SHORTCUTS.map(({ action, keys }) => (
              <div key={action} className="flex h-10 items-center justify-between gap-3 border-b border-line">
                <dt>{action}</dt>
                <dd className="m-0">
                  <kbd className="rounded-[4px] border border-b-2 border-line-2 bg-sunken px-[7px] font-sans text-xs/5 font-bold whitespace-nowrap">
                    {keys}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
