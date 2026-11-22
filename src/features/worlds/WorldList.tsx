import { CircleHelp, Compass, Ellipsis, Moon, Plus, Sun, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTheme } from '../../app/useTheme'
import type { World } from '../../persistence/types'
import { worldStoreInitial } from '../../persistence/worldRecord'
import { ShortcutsDialog } from '../help/ShortcutsDialog'
import { LIST_THUMBNAIL_SIZE, type CreateThumbnails, type Thumbnails } from '../wizard/thumbnails'
import { worldCaption } from './editedAgo'

/**
 * 01 · Lista de mundos e 02 · Lista vazia (mundos.md, AC-F4-04, AC-F4-05): a tela inicial do app.
 *
 * Cabeçalho de 72 px com o logo, o tema e a Ajuda (o modal "Atalhos de teclado"); o título "Seus
 * mundos" com a contagem e os botões Importar (desabilitado até a importação existir) e Novo mundo.
 * Com `worlds` nulo (lendo o IndexedDB), a grade mostra cartões esqueleto do mesmo tamanho dos
 * cartões. Sem mundos, a ilustração "Terra incognita", "Criar meu primeiro mundo" e o link de
 * importar (desabilitado como o botão).
 *
 * Cada cartão abre o mundo (`onOpen`) e tem a miniatura 16:10, o nome, "Editado há X · N pins" e o
 * botão "⋯" (desabilitado até o menu existir). As miniaturas são geradas num worker só delas
 * (`createThumbnails`), uma por vez, na ordem da lista; até chegar, o cartão mostra o fundo do mar.
 */
export function WorldList({
  worlds,
  now,
  onOpen,
  onNew,
  createThumbnails,
}: {
  /** Os mundos salvos, do editado por último ao mais antigo; `null` enquanto carrega. */
  worlds: readonly World[] | null
  /** O instante de referência do "Editado há X". */
  now: Date
  onOpen: (world: World) => void
  onNew: () => void
  /** Sem ele (os testes do jsdom), os cartões ficam sem miniatura. */
  createThumbnails?: CreateThumbnails
}) {
  const { theme, toggle } = useTheme()
  const themeLabel = theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'
  const [helpOpen, setHelpOpen] = useState(false)
  const helpReturn = useRef<HTMLElement | null>(null)
  const thumbs = useWorldThumbnails(worlds, createThumbnails)
  const empty = worlds !== null && worlds.length === 0

  return (
    <div className="flex h-full flex-col bg-bg text-ink" data-testid="world-list" data-state={worlds === null ? 'loading' : empty ? 'empty' : 'ready'}>
      <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line px-4 sm:px-8 lg:px-12">
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-amber text-on-amber">
          <Compass size={22} aria-hidden="true" />
        </span>
        <span className="flex-1 truncate font-title text-lg/6 font-semibold">RPG World Builder</span>
        <HeaderButton label={themeLabel} onClick={toggle}>
          {theme === 'light' ? <Moon size={22} aria-hidden="true" /> : <Sun size={22} aria-hidden="true" />}
        </HeaderButton>
        <HeaderButton
          label="Ajuda"
          onClick={() => {
            helpReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            setHelpOpen(true)
          }}
        >
          <CircleHelp size={22} aria-hidden="true" />
        </HeaderButton>
      </header>

      <main aria-labelledby="world-list-title" className="min-h-0 flex-1 overflow-y-auto px-4 pt-8 pb-12 sm:px-8 lg:px-12 lg:pt-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-4">
          <div className="mr-auto flex min-w-0 items-baseline gap-4">
            <h1 id="world-list-title" className="font-title text-[34px]/10 font-semibold whitespace-nowrap">
              Seus mundos
            </h1>
            {worlds !== null && !empty && (
              <span className="text-[13px]/[18px] font-semibold text-ink-2" data-testid="world-count">
                {worlds.length === 1 ? '1 mundo' : `${worlds.length} mundos`}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" disabled title="Importar (em breve)" className={SECONDARY}>
              <Upload size={18} aria-hidden="true" />
              Importar
            </button>
            <button type="button" onClick={onNew} className={PRIMARY}>
              <Plus size={18} aria-hidden="true" />
              Novo mundo
            </button>
          </div>
        </div>

        {empty ? (
          <EmptyState onNew={onNew} />
        ) : (
          <ul
            aria-label="Mundos"
            aria-busy={worlds === null}
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {worlds === null
              ? SKELETONS.map((i) => <SkeletonCard key={i} />)
              : worlds.map((world) => (
                  <WorldCard key={world.id} world={world} caption={worldCaption(world, now)} rgba={thumbs[world.id]} onOpen={() => onOpen(world)} />
                ))}
          </ul>
        )}
      </main>

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocus={helpReturn} />
    </div>
  )
}

const SKELETONS = [0, 1, 2, 3]

const FOCUS = 'focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--amber)] focus-visible:outline-none'

const PRIMARY = [
  'flex h-11 items-center gap-2 rounded-control border border-transparent px-4 text-sm font-bold whitespace-nowrap',
  'bg-amber text-on-amber hover:bg-[var(--amber-hover)] hover:shadow-md active:translate-y-px active:bg-[var(--amber-press)]',
  FOCUS,
].join(' ')

const SECONDARY = [
  'flex h-11 items-center gap-2 rounded-control border border-line-2 bg-field px-4 text-sm font-bold whitespace-nowrap text-ink',
  'enabled:hover:border-ink-3 enabled:hover:bg-sunken enabled:active:bg-press',
  'disabled:border-dashed disabled:bg-transparent disabled:text-ink-3',
  FOCUS,
].join(' ')

function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-11 shrink-0 place-items-center rounded-control text-ink hover:bg-hover active:bg-press ${FOCUS}`}
    >
      {children}
    </button>
  )
}

/** O cartão de um mundo: abre no editor; o "⋯" fica desabilitado até o menu existir. */
function WorldCard({
  world,
  caption,
  rgba,
  onOpen,
}: {
  world: World
  caption: string
  rgba: Uint8ClampedArray<ArrayBuffer> | undefined
  onOpen: () => void
}) {
  return (
    <li className="relative" data-testid="world-card">
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full flex-col overflow-hidden rounded-panel bg-paper-solid text-left shadow-md hover:shadow-lg ${FOCUS}`}
      >
        <WorldThumbnail rgba={rgba} />
        <span className="flex min-w-0 flex-col gap-1 py-3.5 pr-14 pl-4">
          <span className="truncate text-base/[22px] font-bold" data-testid="world-card-name">
            {world.name}
          </span>
          <span className="truncate text-[13px]/[18px] font-semibold text-ink-2" data-testid="world-card-caption">
            {caption}
          </span>
        </span>
      </button>
      <button
        type="button"
        disabled
        aria-label={`Mais ações de ${world.name}`}
        title="Mais ações (em breve)"
        className="absolute right-2 bottom-3 grid size-11 place-items-center rounded-control text-ink disabled:opacity-40"
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
    </li>
  )
}

/** Miniatura 16:10 (o quadrado do terreno cortado ao centro); sem imagem, o fundo do mar. */
function WorldThumbnail({ rgba }: { rgba: Uint8ClampedArray<ArrayBuffer> | undefined }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx || !rgba) return
    ctx.putImageData(new ImageData(rgba, LIST_THUMBNAIL_SIZE, LIST_THUMBNAIL_SIZE), 0, 0)
  }, [rgba])
  return (
    <canvas
      ref={canvas}
      width={LIST_THUMBNAIL_SIZE}
      height={LIST_THUMBNAIL_SIZE}
      aria-hidden="true"
      data-ready={rgba !== undefined}
      className="aspect-[16/10] w-full bg-map-canvas object-cover"
    />
  )
}

/** Cartão esqueleto: a miniatura e as duas linhas em `--sunken`, com a altura do cartão real. */
function SkeletonCard() {
  return (
    <li aria-hidden="true" data-testid="world-card-skeleton" className="flex flex-col overflow-hidden rounded-panel bg-paper-solid shadow-md">
      <span className="aspect-[16/10] w-full animate-pulse bg-sunken" />
      <span className="flex flex-col gap-1 py-3.5 pr-14 pl-4">
        <span className="my-[3px] h-4 w-3/5 rounded-[4px] bg-sunken" />
        <span className="my-[3px] h-3 w-4/5 rounded-[4px] bg-sunken" />
      </span>
    </li>
  )
}

/** 02 · Lista vazia: a moldura "Terra incognita", o convite e o botão grande. */
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <section aria-labelledby="world-list-empty" className="mx-auto mt-10 flex max-w-[440px] flex-col items-center text-center sm:mt-14">
      <div aria-hidden="true" className="w-full rounded-panel border border-dashed border-line-2 bg-paper-solid p-4 shadow-md">
        <div
          className="relative grid aspect-[408/228] place-items-center rounded-[8px] border border-line"
          style={{
            backgroundImage:
              'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        >
          <span className="grid size-[90px] place-items-center rounded-full border border-line-2 bg-sunken text-amber-ink">
            <Compass size={24} />
          </span>
          <span className="absolute right-3 bottom-2 font-title text-[11px] font-semibold tracking-[.32em] text-ink-2">TERRA INCOGNITA</span>
        </div>
      </div>
      <h2 id="world-list-empty" className="mt-10 font-title text-[26px]/[34px] font-semibold">
        Nenhum mundo ainda
      </h2>
      <p className="mt-3 text-base/6 text-ink-2">Gere um continente em poucos segundos e comece a marcar cidades, NPCs e locais.</p>
      <button type="button" onClick={onNew} className={`${PRIMARY} mt-7 h-14 px-8 text-base shadow-md`}>
        <Plus size={20} aria-hidden="true" />
        Criar meu primeiro mundo
      </button>
      <p className="mt-9 text-[13px] font-semibold text-ink-2">
        ou{' '}
        <button
          type="button"
          disabled
          title="Importar (em breve)"
          className="font-bold text-amber-ink underline underline-offset-2 disabled:opacity-60"
        >
          importe um arquivo .json
        </button>
      </p>
    </section>
  )
}

/**
 * As miniaturas dos mundos da lista: um worker só delas enquanto a lista está à vista, uma miniatura
 * por vez, na ordem da lista. Uma falha só deixa as que faltam sem imagem.
 */
function useWorldThumbnails(worlds: readonly World[] | null, createThumbnails: CreateThumbnails | undefined) {
  const [thumbs, setThumbs] = useState<Record<string, Uint8ClampedArray<ArrayBuffer>>>({})
  const thumbnails = useRef<Thumbnails | null>(null)

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
    if (!current || !worlds) return
    const job = { cancelled: false }
    void (async () => {
      for (const world of worlds) {
        let rgba: Uint8ClampedArray<ArrayBuffer> | null
        try {
          rgba = await current.render(world.seed, worldStoreInitial(world).params, LIST_THUMBNAIL_SIZE)
        } catch {
          return
        }
        if (job.cancelled) return
        if (rgba) setThumbs((prev) => ({ ...prev, [world.id]: rgba }))
      }
    })()
    return () => {
      job.cancelled = true
    }
  }, [createThumbnails, worlds])

  return thumbs
}
