import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRight, Check, ChevronDown, Dices, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { WorldParams } from '../../core'
import { PRESETS, type Preset, type PresetId } from '../../state/presets'
import { randomSeed } from '../../state/seed'
import { CopySeedButton, SeedButton } from '../sidebar/SeedButtons'
import { useCopySeed } from '../sidebar/useCopySeed'
import { loadThumbnails, THUMBNAIL_SEED_MS, THUMBNAIL_SIZE, type CreateThumbnails, type Thumbnails } from './thumbnails'

/**
 * 04 · Assistente de novo mundo (AC-F1-19): modal de 800 px com o nome do mundo, os 4 presets em
 * cartões com miniatura ("Ponto de partida") e a seção Avançado com a seed. Abre sobre a Lista de
 * mundos. "Criar mundo →" entrega o nome, a seed e os parâmetros do preset (`onCreate`: quem abriu
 * salva e abre o mundo novo) e fecha. Cancelar, o X e o Esc fecham sem criar nada; um clique fora do
 * modal não fecha, para não perder o que foi digitado.
 *
 * O nome é obrigatório: sem nome (só espaços contam como vazio), "Criar mundo" fica desabilitado.
 * A seed começa sorteada; vazia, vale a sorteada ao abrir (a "opcional" do campo). As miniaturas
 * usam essa seed e são geradas no worker das miniaturas (`thumbnails.ts`), de novo 300 ms depois da
 * última mudança da seed; até chegar, o cartão mostra o fundo do mar.
 */
/** O que o assistente entrega ao criar o mundo. */
export type NewWorldValues = { name: string; seed: string; params: Readonly<WorldParams> }

export function NewWorldWizard({
  open,
  onClose,
  onCreate,
  createThumbnails,
}: {
  open: boolean
  onClose: () => void
  onCreate: (values: NewWorldValues) => void
  /** Sem ele (os testes do jsdom), os cartões ficam sem miniatura. */
  createThumbnails?: CreateThumbnails
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
          className={[
            'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(800px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-modal bg-paper-solid text-ink shadow-lg outline-none',
          ].join(' ')}
          data-testid="new-world-wizard"
        >
          <WizardForm onCreate={onCreate} onClose={onClose} createThumbnails={createThumbnails} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function WizardForm({
  onCreate,
  onClose,
  createThumbnails,
}: {
  onCreate: (values: NewWorldValues) => void
  onClose: () => void
  createThumbnails?: CreateThumbnails
}) {
  const [name, setName] = useState('')
  const [presetId, setPresetId] = useState<PresetId>(PRESETS[0].id)
  /** A seed sorteada ao abrir: a inicial do campo, e a que vale com o campo vazio. */
  const [fallbackSeed] = useState(() => randomSeed())
  const [seedText, setSeedText] = useState(fallbackSeed)
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const seedInput = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const seedId = useId()
  const advancedId = useId()
  const presetsId = useId()
  const seed = seedText.trim() || fallbackSeed
  const { copied, copy } = useCopySeed(seed, seedInput)
  const thumbs = usePresetThumbnails(seed, createThumbnails)
  const trimmedName = name.trim()

  const create = () => {
    if (!trimmedName) return
    const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
    onCreate({ name: trimmedName, seed, params: preset.params })
    onClose()
  }

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        create()
      }}
    >
      <div className="min-h-0 overflow-y-auto px-5 pt-6 pb-5 sm:px-8 sm:pt-7">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Dialog.Title className="font-title text-[26px] leading-[34px] font-semibold">Novo mundo</Dialog.Title>
            <p className="text-sm/5 text-ink-2">
              Dê um nome e escolha um ponto de partida. Tudo pode ser ajustado depois no editor.
            </p>
          </div>
          <Dialog.Close
            type="button"
            aria-label="Fechar"
            title="Fechar"
            className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-control text-ink hover:bg-hover active:bg-press focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none"
          >
            <X size={20} aria-hidden="true" />
          </Dialog.Close>
        </div>

        <label htmlFor={nameId} className="mt-6 block text-sm/5 font-bold">
          Nome do mundo
        </label>
        <input
          id={nameId}
          value={name}
          autoFocus
          autoComplete="off"
          placeholder="Ex.: Terras de Valdora"
          onChange={(e) => setName(e.target.value)}
          className="mt-2 h-11 w-full rounded-control border border-line-2 bg-field px-3.5 text-[15px] text-ink outline-none placeholder:text-ink-3 max-md:text-[16px] hover:border-ink-3 focus:border-amber focus:shadow-[0_0_0_3px_var(--amber-soft)]"
        />

        <div className="mt-6" role="group" aria-labelledby={presetsId}>
          <span id={presetsId} className="block text-sm/5 font-bold">
            Ponto de partida
          </span>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PRESETS.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={preset.id === presetId}
                rgba={thumbs[preset.id]}
                onSelect={() => setPresetId(preset.id)}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-4">
          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls={advancedId}
            onClick={() => setAdvancedOpen((o) => !o)}
            className="-ml-1 flex h-9 items-center gap-2 rounded-control px-1 text-sm/5 font-bold hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none"
          >
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`transition-transform duration-200 ${advancedOpen ? '' : '-rotate-90'}`}
            />
            Avançado
          </button>
          <div id={advancedId} hidden={!advancedOpen} className="pt-3">
            <label htmlFor={seedId} className="block text-sm/5">
              <span className="font-bold">Seed</span> <span className="text-ink-2">(opcional)</span>
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id={seedId}
                ref={seedInput}
                value={seedText}
                spellCheck={false}
                autoComplete="off"
                placeholder={fallbackSeed}
                onChange={(e) => setSeedText(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-control border border-line-2 bg-field px-3.5 font-mono text-sm font-medium text-ink outline-none placeholder:text-ink-3 max-md:text-[16px] hover:border-ink-3 focus:border-amber focus:shadow-[0_0_0_3px_var(--amber-soft)]"
              />
              <SeedButton label="Seed aleatória" onClick={() => setSeedText(randomSeed())}>
                <Dices size={18} aria-hidden="true" />
              </SeedButton>
              <CopySeedButton copied={copied} onClick={copy} />
            </div>
            <p className="mt-2 text-[13px] leading-[18px] text-ink-2">A mesma seed sempre gera o mesmo mapa.</p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-3 border-t border-line px-5 py-4 sm:px-8">
        <Dialog.Close
          type="button"
          className="h-11 rounded-control border border-line-2 bg-field px-4 text-sm font-bold text-ink hover:border-ink-3 hover:bg-sunken active:bg-press focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none"
        >
          Cancelar
        </Dialog.Close>
        <button
          type="submit"
          disabled={!trimmedName}
          className={[
            'flex h-11 items-center gap-2 rounded-control border border-transparent px-4 text-sm font-bold',
            'bg-amber text-on-amber hover:bg-[var(--amber-hover)] hover:shadow-md active:translate-y-px active:bg-[var(--amber-press)]',
            'focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none',
            'disabled:translate-y-0 disabled:border-dashed disabled:border-line-2 disabled:bg-sunken disabled:text-ink-3 disabled:shadow-none',
          ].join(' ')}
        >
          Criar mundo
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  )
}

/** Cartão de preset: miniatura, nome e descrição; o selecionado tem borda âmbar e o check. */
function PresetCard({
  preset,
  selected,
  rgba,
  onSelect,
}: {
  preset: Preset
  selected: boolean
  rgba: Uint8ClampedArray<ArrayBuffer> | undefined
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      data-testid={`preset-${preset.id}`}
      className={[
        'relative flex flex-col gap-2 rounded-panel border bg-field p-1.5 pb-2.5 text-left text-ink',
        'focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none',
        selected ? 'border-amber shadow-[0_0_0_1px_var(--amber)]' : 'border-line hover:border-line-2 hover:bg-sunken',
      ].join(' ')}
    >
      <Thumbnail rgba={rgba} />
      <span className="flex flex-col gap-1 px-1.5">
        <span className="text-sm/5 font-bold">{preset.name}</span>
        <span className="text-xs/4 text-ink-2">{preset.description}</span>
      </span>
      {selected && (
        <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-amber text-on-amber shadow-sm">
          <Check size={15} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
    </button>
  )
}

/** A miniatura do preset num canvas (cortada ao centro); sem imagem, o fundo do mar. */
function Thumbnail({ rgba }: { rgba: Uint8ClampedArray<ArrayBuffer> | undefined }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx || !rgba) return
    ctx.putImageData(new ImageData(rgba, THUMBNAIL_SIZE, THUMBNAIL_SIZE), 0, 0)
  }, [rgba])
  return (
    <canvas
      ref={canvas}
      width={THUMBNAIL_SIZE}
      height={THUMBNAIL_SIZE}
      aria-hidden="true"
      data-ready={rgba !== undefined}
      className="aspect-[8/5] w-full rounded-[8px] bg-map-canvas object-cover"
    />
  )
}

/**
 * As miniaturas dos 4 presets com a `seed`: um worker só delas enquanto o assistente está aberto,
 * e um lote novo 300 ms depois da última mudança da seed. As imagens da seed anterior ficam até as
 * novas chegarem.
 */
function usePresetThumbnails(seed: string, createThumbnails: CreateThumbnails | undefined) {
  const [thumbs, setThumbs] = useState<Partial<Record<PresetId, Uint8ClampedArray<ArrayBuffer>>>>({})
  const thumbnails = useRef<Thumbnails | null>(null)
  /** Se um lote já saiu: o primeiro sai já, e os seguintes esperam a pausa na digitação da seed. */
  const started = useRef(false)

  useEffect(() => {
    if (!createThumbnails) return
    const created = createThumbnails()
    thumbnails.current = created
    return () => {
      created.dispose()
      thumbnails.current = null
    }
  }, [createThumbnails])

  useEffect(() => {
    const current = thumbnails.current
    if (!current) return
    const delay = started.current ? THUMBNAIL_SEED_MS : 0
    started.current = true
    const job = { cancel: () => {} }
    const timer = setTimeout(() => {
      job.cancel = loadThumbnails(current, seed, PRESETS, (id, rgba) => setThumbs((prev) => ({ ...prev, [id]: rgba })))
    }, delay)
    return () => {
      clearTimeout(timer)
      job.cancel()
    }
  }, [createThumbnails, seed])

  return thumbs
}
