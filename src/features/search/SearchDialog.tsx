import * as Dialog from '@radix-ui/react-dialog'
import { Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useStore } from 'zustand'
import { pinImageId, type PinImages } from '../../state/pinImages'
import { pinType, pinTypeLabel } from '../../state/pinTypes'
import type { PinsStore } from '../../state/pinsStore'
import { PinIcon } from '../pins/PinIcon'
import { SEARCH_LIMIT, searchPins, type SearchResult } from './searchPins'

/**
 * O modal Buscar (pins.md → Buscar, AC-F3-16), aberto pelo Buscar da barra ou por Ctrl K: um campo
 * e a lista dos pins que batem com o texto por nome ou por tag (`searchPins`). As setas andam pela
 * lista (Home e End vão às pontas), Enter ou o clique escolhe (`onChoose`), e Esc ou um clique fora
 * fecha. O campo é um combobox com a lista (`aria-activedescendant`): o foco fica sempre no campo.
 * Ao fechar, o foco vai para `returnFocus` (quem abriu guarda o alvo: o Radix sozinho o deixa no `body`).
 */
export function SearchDialog({
  open,
  pins,
  images,
  onChoose,
  onClose,
  returnFocus,
}: {
  open: boolean
  pins: PinsStore
  images: PinImages
  /** Escolheu um resultado: quem abriu seleciona o pin e leva a câmera até ele. */
  onChoose: (id: string) => void
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
          data-testid="search-dialog"
          className={[
            'fixed top-[76px] left-1/2 z-50 flex max-h-[calc(100dvh-92px)] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 flex-col',
            'overflow-hidden rounded-modal bg-paper-solid text-ink shadow-lg outline-none',
          ].join(' ')}
        >
          <Dialog.Title className="sr-only">Buscar pins</Dialog.Title>
          {/* Montado só com o modal aberto: cada abertura começa com o campo vazio. */}
          <SearchBody pins={pins} images={images} onChoose={onChoose} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SearchBody({ pins, images, onChoose }: { pins: PinsStore; images: PinImages; onChoose: (id: string) => void }) {
  const ids = useId()
  const all = useStore(pins, (s) => s.pins)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const { results, total } = useMemo(() => searchPins(all, query), [all, query])
  const list = useRef<HTMLUListElement>(null)
  const current = results.length > 0 ? Math.min(active, results.length - 1) : -1
  const optionId = (i: number) => `${ids}-r${i}`

  // O resultado ativo fica à vista quando as setas o levam para fora da lista rolada.
  useEffect(() => {
    if (current < 0) return
    list.current?.children[current]?.scrollIntoView?.({ block: 'nearest' })
  }, [current])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    const last = results.length - 1
    let next: number | null = null
    if (e.key === 'ArrowDown') next = current >= last ? 0 : current + 1
    else if (e.key === 'ArrowUp') next = current <= 0 ? last : current - 1
    else if (e.key === 'Home' && e.ctrlKey) next = 0
    else if (e.key === 'End' && e.ctrlKey) next = last
    else if (e.key === 'Enter') {
      e.preventDefault()
      onChoose(results[current].pin.id)
      return
    }
    if (next === null) return
    e.preventDefault()
    setActive(next)
  }

  const status =
    all.length === 0
      ? 'Este mundo ainda não tem pins.'
      : !query.trim()
        ? 'Digite o nome ou uma tag do pin.'
        : total === 0
          ? `Nenhum pin com “${query.trim()}”.`
          : total > SEARCH_LIMIT
            ? `Mostrando ${SEARCH_LIMIT} de ${total} pins. Digite mais para refinar.`
            : null

  return (
    <>
      {/* O campo fica sempre com o foco: no lugar do anel, a borda de baixo fica âmbar (design system → inputs). */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 focus-within:border-amber">
        <Search size={20} aria-hidden="true" className="shrink-0 text-ink-2" />
        <input
          type="text"
          role="combobox"
          aria-label="Buscar pins"
          aria-expanded={results.length > 0}
          aria-controls={`${ids}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscar pins por nome ou tag"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          data-testid="search-input"
          // 16 px: no iOS, um campo menor aproxima a página ao receber o foco.
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3 focus-visible:shadow-none!"
        />
        <kbd aria-hidden="true" className="hidden rounded-[4px] border border-line bg-sunken px-[5px] font-sans text-[11px]/[18px] font-bold text-ink-2 md:block">
          Esc
        </kbd>
      </div>
      <ul
        ref={list}
        id={`${ids}-lista`}
        role="listbox"
        aria-label="Resultados"
        data-testid="search-results"
        className={`min-h-0 overflow-y-auto ${results.length > 0 ? 'p-2' : 'hidden'}`}
      >
        {results.map((r, i) => (
          <ResultOption
            key={r.pin.id}
            id={optionId(i)}
            result={r}
            images={images}
            active={i === current}
            onHover={() => setActive(i)}
            onChoose={() => onChoose(r.pin.id)}
          />
        ))}
      </ul>
      {status && (
        <p role="status" data-testid="search-status" className="px-4 py-4 text-[13px] text-ink-2">
          {status}
        </p>
      )}
    </>
  )
}

/** Um resultado: o ícone, o nome, o tipo e as tags que bateram com o texto. */
function ResultOption({
  id,
  result,
  images,
  active,
  onHover,
  onChoose,
}: {
  id: string
  result: SearchResult
  images: PinImages
  active: boolean
  onHover: () => void
  onChoose: () => void
}) {
  const { pin, tags } = result
  const type = pinType(pin.type)
  const imageId = pinImageId(pin)
  const imageUrl = useStore(images.store, (s) => (imageId ? s.urls[imageId] : undefined))
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      data-pin-result={pin.id}
      // O clique escolhe sem tirar o foco do campo.
      onMouseDown={(e) => e.preventDefault()}
      onMouseMove={active ? undefined : onHover}
      onClick={onChoose}
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 ${active ? 'bg-amber-soft' : ''}`}
    >
      <PinIcon type={type} size={24} image={imageUrl} className="shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-bold text-ink">{pin.name}</span>
        <span className="text-[12px] text-ink-2">{pinTypeLabel(type)}</span>
      </span>
      {tags.length > 0 && (
        <span className="flex min-w-0 shrink flex-wrap justify-end gap-1" data-testid="search-result-tags">
          {tags.map((t) => (
            <span key={t} className="max-w-[140px] truncate rounded-full border border-line bg-field px-2 text-[12px]/5 font-semibold text-ink-2">
              {t}
            </span>
          ))}
        </span>
      )}
    </li>
  )
}
