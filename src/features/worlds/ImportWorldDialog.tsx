import * as Dialog from '@radix-ui/react-dialog'
import { CircleX, FileJson, TriangleAlert, Upload, X } from 'lucide-react'
import { fileSize, importMessage, type ImportFailure } from './importMessages'

/**
 * 03 · Erro ao importar (mundos.md, AC-F4-10): o modal "Importar mundo" com o arquivo recusado (nome,
 * tamanho, "Não aceito") e o alerta com a causa e o passo para corrigir. Outro arquivo pode ser
 * solto sobre a janela (quem monta o modal ouve o soltar) ou escolhido em "Escolher outro arquivo",
 * sem fechar o modal; Cancelar, o fechar, Esc ou o clique fora fecham. Enquanto um arquivo é lido
 * (`busy`), os botões ficam desabilitados.
 */
export function ImportWorldDialog({
  failure,
  busy,
  onChoose,
  onClose,
  onCloseAutoFocus,
}: {
  /** O arquivo recusado; `null` fecha o modal. */
  failure: ImportFailure | null
  busy: boolean
  /** Abre o seletor de arquivos. */
  onChoose: () => void
  onClose: () => void
  onCloseAutoFocus?: (e: Event) => void
}) {
  const message = failure ? importMessage(failure.reason) : null
  return (
    <Dialog.Root open={failure !== null} onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]" />
        <Dialog.Content
          data-testid="import-world-dialog"
          data-reason={failure?.reason}
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={(e) => {
            // O foco vai para "Escolher outro arquivo", o próximo passo.
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-autofocus]')?.focus()
          }}
          className={[
            'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col',
            'overflow-y-auto rounded-modal bg-paper-solid text-ink shadow-lg outline-none',
          ].join(' ')}
        >
          <div className="flex items-center gap-3 px-6 pt-6 sm:px-7">
            <Dialog.Title className="flex-1 font-title text-2xl/8 font-semibold">Importar mundo</Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              title="Fechar"
              disabled={busy}
              className={`-mr-2 grid size-11 shrink-0 place-items-center rounded-control text-ink enabled:hover:bg-hover enabled:active:bg-press ${FOCUS}`}
            >
              <X size={22} aria-hidden="true" />
            </Dialog.Close>
          </div>

          {failure && message && (
            <div className="px-6 pt-5 pb-5 sm:px-7">
              <div className="flex flex-col gap-4 rounded-panel border border-dashed border-brick bg-brick-soft/60 p-4 sm:p-5">
                <div className="flex items-center gap-3 rounded-control border border-line bg-paper-solid px-3.5 py-2.5">
                  <FileJson size={22} aria-hidden="true" className="shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm/5 font-semibold" data-testid="import-file-name">
                      {failure.fileName}
                    </span>
                    <span className="text-xs/4 text-ink-2">{fileSize(failure.size)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-brick-ink">
                    <CircleX size={20} aria-hidden="true" />
                    Não aceito
                  </span>
                </div>
                <div role="alert" className="flex gap-2.5">
                  <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brick-ink" />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm/5 font-bold">{message.title}</p>
                    <p className="text-sm/5 text-ink-2" data-testid="import-reason">
                      {message.text}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[13px]/[18px] text-ink-2">Arraste outro arquivo .json para esta janela ou escolha no computador.</p>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4 sm:px-7">
            <Dialog.Close type="button" disabled={busy} className={SECONDARY}>
              Cancelar
            </Dialog.Close>
            <button type="button" data-autofocus disabled={busy} onClick={onChoose} className={PRIMARY}>
              <Upload size={18} aria-hidden="true" />
              {busy ? 'Lendo arquivo…' : 'Escolher outro arquivo'}
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
  'flex h-11 items-center gap-2 rounded-control border border-transparent bg-amber px-4 text-sm font-bold text-on-amber',
  'enabled:hover:bg-[var(--amber-hover)] enabled:hover:shadow-md enabled:active:translate-y-px enabled:active:bg-[var(--amber-press)] disabled:opacity-60',
  FOCUS,
].join(' ')
