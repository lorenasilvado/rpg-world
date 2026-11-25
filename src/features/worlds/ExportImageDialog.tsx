import * as Dialog from '@radix-ui/react-dialog'
import { Image } from 'lucide-react'
import { useId, useState } from 'react'
import { EXPORT_SCALES, exportImageSize, type ExportScale, type MapImageOptions } from '../../render/mapImage'

/**
 * Exportar › Imagem (.png) (mundos.md → Ações, AC-F4-11): o modal "Exportar imagem" escolhe a
 * escala (1×, 2× ou 4×, com o tamanho em px) e se a imagem leva os pins e os rótulos (ligado ao
 * abrir). "Baixar PNG" chama `onExport`; enquanto o PNG é gerado, os controles ficam desabilitados
 * e nem Esc nem o clique fora fecham o modal. Deu certo: o modal fecha. Falhou: continua aberto
 * com o aviso, para tentar de novo. Cancelar, Esc ou o clique fora fecham sem exportar.
 */
export function ExportImageDialog({
  open,
  onExport,
  onClose,
  onCloseAutoFocus,
}: {
  open: boolean
  onExport: (options: MapImageOptions) => Promise<void>
  onClose: () => void
  onCloseAutoFocus?: (e: Event) => void
}) {
  const [busy, setBusy] = useState(false)
  const hold = (e: Event) => {
    if (busy) e.preventDefault()
  }
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          data-testid="export-image-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={hold}
          onInteractOutside={hold}
          className={CONTENT}
        >
          {open && <ExportImageForm onExport={onExport} onClose={onClose} onBusyChange={setBusy} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ExportImageForm({
  onExport,
  onClose,
  onBusyChange,
}: {
  onExport: (options: MapImageOptions) => Promise<void>
  onClose: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const [scale, setScale] = useState<ExportScale>(1)
  const [pins, setPins] = useState(true)
  const [state, setState] = useState<'idle' | 'exporting' | 'error'>('idle')
  const ids = useId()
  const busy = state === 'exporting'

  const submit = async () => {
    if (busy) return
    setState('exporting')
    onBusyChange(true)
    try {
      await onExport({ scale, pins })
    } catch {
      setState('error')
      return
    } finally {
      onBusyChange(false)
    }
    onClose()
  }

  return (
    <form
      className="flex flex-col gap-4"
      aria-busy={busy}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Dialog.Title className="flex items-center gap-2 font-title text-2xl/8 font-semibold">
        <Image size={22} aria-hidden="true" className="shrink-0 text-ink-2" />
        Exportar imagem
      </Dialog.Title>
      <Dialog.Description className="-mt-2 text-sm/5 text-ink-2">
        O mapa inteiro em PNG. Nas escalas maiores, o terreno é gerado de novo com mais detalhe.
      </Dialog.Description>

      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend id={`${ids}-escala`} className="mb-2 text-[13px] font-bold text-ink-2">
          Escala
        </legend>
        <div role="radiogroup" aria-labelledby={`${ids}-escala`} className="grid grid-cols-3 gap-2">
          {EXPORT_SCALES.map((s) => {
            const checked = scale === s
            const px = exportImageSize(s)
            return (
              <label
                key={s}
                className={[
                  'flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-control border text-center',
                  'has-focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] has-disabled:cursor-default has-disabled:opacity-60',
                  checked ? 'border-amber bg-amber-soft' : 'border-line-2 bg-field hover:bg-sunken',
                ].join(' ')}
              >
                <input type="radio" name={`${ids}-escala`} value={s} checked={checked} onChange={() => setScale(s)} className="sr-only" />
                <span className="text-base/5 font-extrabold text-ink">{s}×</span>
                <span className="font-mono text-xs/4 text-ink-2">
                  {px} × {px} px
                </span>
              </label>
            )
          })}
        </div>
        {scale === 4 && (
          <p className="text-[13px]/[18px] text-ink-2" data-testid="export-image-slow">
            Em 4×, gerar a imagem pode levar até um minuto.
          </p>
        )}
      </fieldset>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink has-disabled:cursor-default has-disabled:opacity-60">
        <input
          type="checkbox"
          checked={pins}
          disabled={busy}
          onChange={(e) => setPins(e.target.checked)}
          className="size-[18px] shrink-0 accent-[var(--amber)]"
        />
        Pins e rótulos
      </label>

      {state === 'error' && (
        <p role="alert" className="rounded-control bg-brick-soft px-3 py-2 text-[13px]/[18px] font-semibold text-brick-ink">
          Não foi possível exportar a imagem. Tente de novo.
        </p>
      )}

      <div className="mt-1 flex flex-wrap justify-end gap-3">
        <Dialog.Close type="button" disabled={busy} className={SECONDARY}>
          Cancelar
        </Dialog.Close>
        <button type="submit" disabled={busy} className={PRIMARY}>
          {busy ? 'Gerando imagem…' : 'Baixar PNG'}
        </button>
      </div>
    </form>
  )
}

const CONTENT = [
  'fixed top-1/2 left-1/2 z-50 flex w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col',
  'rounded-modal bg-paper-solid p-6 text-ink shadow-lg outline-none sm:p-7',
].join(' ')

const FOCUS = 'focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none'

const SECONDARY = [
  'h-11 rounded-control border border-line-2 bg-field px-4 text-sm font-bold text-ink',
  'enabled:hover:border-ink-3 enabled:hover:bg-sunken enabled:active:bg-press disabled:opacity-60',
  FOCUS,
].join(' ')

const PRIMARY = [
  'h-11 rounded-control border border-transparent bg-amber px-4 text-sm font-bold text-on-amber',
  'enabled:hover:bg-[var(--amber-hover)] enabled:hover:shadow-md enabled:active:translate-y-px enabled:active:bg-[var(--amber-press)] disabled:opacity-60',
  FOCUS,
].join(' ')
