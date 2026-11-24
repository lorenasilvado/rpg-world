import * as Dialog from '@radix-ui/react-dialog'
import { Trash2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import type { World } from '../../persistence/types'

/**
 * Renomear, pelo menu "⋯" do cartão (mundos.md → Ações, AC-F4-07): o campo "Nome do mundo" vem
 * com o nome atual selecionado; "Renomear" (ou Enter) grava o nome sem os espaços das pontas e
 * fecha, e fica desabilitado com o campo vazio. Cancelar, Esc ou o clique fora fecham sem mudar;
 * enquanto grava, nada fecha o modal. Se a gravação falha, o modal continua aberto com o aviso.
 */
export function RenameWorldDialog({
  world,
  onRename,
  onClose,
  onCloseAutoFocus,
}: {
  /** O mundo a renomear; `null` fecha o modal. */
  world: World | null
  onRename: (world: World, name: string) => Promise<void>
  onClose: () => void
  onCloseAutoFocus: (e: Event) => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog.Root open={world !== null} onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          data-testid="rename-world-dialog"
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          {...holdWhile(busy)}
          className={CONTENT}
        >
          {world && <RenameForm key={world.id} world={world} onRename={onRename} onClose={onClose} onBusyChange={setBusy} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function RenameForm({
  world,
  onRename,
  onClose,
  onBusyChange,
}: {
  world: World
  onRename: (world: World, name: string) => Promise<void>
  onClose: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const [name, setName] = useState(world.name)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const inputId = useId()
  const trimmed = name.trim()

  const submit = async () => {
    if (!trimmed || state === 'saving') return
    if (trimmed === world.name) return onClose()
    setState('saving')
    onBusyChange(true)
    try {
      await onRename(world, trimmed)
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
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Dialog.Title className={TITLE}>Renomear mundo</Dialog.Title>
      <label htmlFor={inputId} className="mt-1 text-sm/5 font-bold">
        Nome do mundo
      </label>
      <input
        id={inputId}
        value={name}
        autoComplete="off"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setName(e.target.value)
          if (state === 'error') setState('idle')
        }}
        className="h-11 w-full rounded-control border border-line-2 bg-field px-3.5 text-[15px] text-ink outline-none max-md:text-[16px] hover:border-ink-3 focus:border-amber focus:shadow-[0_0_0_3px_var(--amber-soft)]"
      />
      {state === 'error' && <ErrorNote>Não foi possível renomear o mundo. Tente de novo.</ErrorNote>}
      <Buttons>
        <Dialog.Close type="button" disabled={state === 'saving'} className={SECONDARY}>
          Cancelar
        </Dialog.Close>
        <button type="submit" disabled={!trimmed || state === 'saving'} className={PRIMARY}>
          {state === 'saving' ? 'Salvando…' : 'Renomear'}
        </button>
      </Buttons>
    </form>
  )
}

/**
 * A confirmação de Excluir, pelo menu "⋯" do cartão (mundos.md → Ações, AC-F4-07): avisa que o
 * mundo e os pins dele saem deste navegador e que não dá para desfazer. O foco começa em Cancelar;
 * "Excluir mundo" (destrutivo) exclui e fecha; enquanto exclui, nada fecha o modal. Se a exclusão
 * falha, o modal continua com o aviso.
 */
export function DeleteWorldDialog({
  world,
  onDelete,
  onClose,
  onCloseAutoFocus,
}: {
  /** O mundo a excluir; `null` fecha o modal. */
  world: World | null
  onDelete: (world: World) => Promise<void>
  onClose: () => void
  onCloseAutoFocus: (e: Event) => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog.Root open={world !== null} onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content data-testid="delete-world-dialog" onCloseAutoFocus={onCloseAutoFocus} {...holdWhile(busy)} className={CONTENT}>
          {world && <DeleteBody key={world.id} world={world} onDelete={onDelete} onClose={onClose} onBusyChange={setBusy} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function DeleteBody({
  world,
  onDelete,
  onClose,
  onBusyChange,
}: {
  world: World
  onDelete: (world: World) => Promise<void>
  onClose: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const [state, setState] = useState<'idle' | 'deleting' | 'error'>('idle')
  const busy = state === 'deleting'

  const confirm = async () => {
    setState('deleting')
    onBusyChange(true)
    try {
      await onDelete(world)
    } catch {
      setState('error')
      return
    } finally {
      onBusyChange(false)
    }
    onClose()
  }

  return (
    <>
      <Dialog.Title className={TITLE}>Excluir “{world.name}”?</Dialog.Title>
      <Dialog.Description className="text-sm/5 text-ink-2">{deleteMessage(world.pins.length)}</Dialog.Description>
      {state === 'error' && <ErrorNote>Não foi possível excluir o mundo. Tente de novo.</ErrorNote>}
      <Buttons>
        <Dialog.Close type="button" disabled={busy} className={SECONDARY}>
          Cancelar
        </Dialog.Close>
        <button type="button" disabled={busy} onClick={() => void confirm()} className={DESTRUCTIVE}>
          <Trash2 size={18} aria-hidden="true" />
          {busy ? 'Excluindo…' : 'Excluir mundo'}
        </button>
      </Buttons>
    </>
  )
}

/** O texto da confirmação de Excluir, com os pins que vão junto. */
function deleteMessage(pins: number): string {
  const what = pins === 0 ? 'O mundo será excluído' : pins === 1 ? 'O mundo e o pin dele serão excluídos' : `O mundo e os ${pins} pins dele serão excluídos`
  return `${what} deste navegador. Isso não pode ser desfeito.`
}

/** Enquanto grava ou exclui, Esc e o clique fora não fecham o modal (o resultado aparece nele). */
function holdWhile(busy: boolean) {
  const hold = (e: Event) => {
    if (busy) e.preventDefault()
  }
  return { onEscapeKeyDown: hold, onInteractOutside: hold }
}

function Buttons({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap justify-end gap-3">{children}</div>
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-control bg-brick-soft px-3 py-2 text-[13px]/[18px] font-semibold text-brick-ink">
      {children}
    </p>
  )
}

const CONTENT = [
  'fixed top-1/2 left-1/2 z-50 flex w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3',
  'rounded-modal bg-paper-solid p-6 text-ink shadow-lg outline-none sm:p-7',
].join(' ')

const TITLE = 'font-title text-2xl/8 font-semibold [overflow-wrap:anywhere]'

const FOCUS = 'focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none'

const SECONDARY = [
  'h-11 rounded-control border border-line-2 bg-field px-4 text-sm font-bold text-ink',
  'enabled:hover:border-ink-3 enabled:hover:bg-sunken enabled:active:bg-press disabled:opacity-60',
  FOCUS,
].join(' ')

const DISABLED = 'disabled:translate-y-0 disabled:border-dashed disabled:border-line-2 disabled:bg-sunken disabled:text-ink-3 disabled:shadow-none'

const PRIMARY = [
  'h-11 rounded-control border border-transparent bg-amber px-4 text-sm font-bold text-on-amber',
  'enabled:hover:bg-[var(--amber-hover)] enabled:hover:shadow-md enabled:active:translate-y-px enabled:active:bg-[var(--amber-press)]',
  DISABLED,
  FOCUS,
].join(' ')

const DESTRUCTIVE = [
  'flex h-11 items-center gap-2 rounded-control border border-transparent bg-brick px-4 text-sm font-bold text-white',
  'enabled:hover:bg-[#9C2F25] enabled:active:translate-y-px enabled:active:bg-[#86281F]',
  DISABLED,
  FOCUS,
].join(' ')
