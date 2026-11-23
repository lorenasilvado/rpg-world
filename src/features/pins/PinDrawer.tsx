import { Copy, ImagePlus, LocateFixed, MapPin, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { Pin } from '../../persistence/types'
import { pinToWorld } from '../../render/layers/pinMath'
import { PIN_SHAPES } from '../../render/style/pinShapes'
import type { CameraStore } from '../../state/cameraStore'
import { pinType, pinTypeLabel } from '../../state/pinTypes'
import type { PinsStore } from '../../state/pinsStore'
import type { WorldStore } from '../../state/worldStore'
import { DescriptionEditor } from './DescriptionEditor'
import { PinIcon } from './PinIcon'
import { PinTags } from './PinTags'
import { duplicateOffset, pinPlace } from './place'
import { suggestedTags } from './tags'
import { typeChipColors } from './typeChip'

/** O zoom mínimo (relativo) do Centralizar: no mapa inteiro, a câmera aproxima até ele. */
export const CENTER_PIN_ZOOM = 1.6

const TABS = [
  { id: 'descricao', label: 'Descrição' },
  { id: 'detalhes', label: 'Detalhes' },
  { id: 'conexoes', label: 'Conexões' },
] as const

type TabId = (typeof TABS)[number]['id']

/**
 * A ficha do pin selecionado no drawer (pins.md → E2, AC-F3-06 a AC-F3-09). Sem pin selecionado,
 * nada.
 *
 * - A área "Adicionar imagem de capa (16:9)" no topo (o envio ainda não existe: o botão fica
 *   desabilitado) e o botão fechar (a partir de 768 px; abaixo, o painel sobreposto tem o seu).
 * - O cabeçalho: o ícone do tipo, o nome, editável, a etiqueta do tipo, na cor dele, e a linha do
 *   lugar, com o bioma sob o pin (do campo exibido) e as coordenadas (`place.ts`).
 * - As abas Descrição (a descrição em texto rico e as tags), Detalhes e Conexões (vazias por ora).
 * - O rodapé fixo: Centralizar (a câmera desliza até o pin, aproximando até `CENTER_PIN_ZOOM`),
 *   Duplicar (a cópia ao lado, selecionada) e Excluir (`onDelete`, com o toast "Pin excluído").
 *
 * O nome: o pin recém-criado (`newPinId`) abre com ele em edição (o campo com o foco e o texto
 * selecionado). O nome muda a cada tecla; um nome vazio não fica: ao sair do campo, volta o último
 * nome. Fora do foco, o campo acompanha o nome do pin (desfazer e refazer). Enter sai do campo; Esc,
 * nele, fecha o drawer.
 */
export function PinDrawer({
  pins,
  world,
  camera,
  onDelete,
  onCentered,
}: {
  pins: PinsStore
  world: WorldStore
  camera: CameraStore
  /** Exclui o pin (o mesmo da tecla Delete: o toast "Pin excluído" com Desfazer). */
  onDelete: (id: string) => void
  /** Depois do Centralizar (abaixo de 768 px, o painel sobreposto fecha para o mapa aparecer). */
  onCentered?: () => void
}) {
  const selected = useStore(pins, (s) => s.pins.find((p) => p.id === s.selectedId) ?? null)
  const isNew = useStore(pins, (s) => s.selectedId !== null && s.selectedId === s.newPinId)
  if (!selected) return null
  return (
    <PinCard
      key={selected.id}
      pin={selected}
      pins={pins}
      world={world}
      camera={camera}
      editName={isNew}
      onDelete={onDelete}
      onCentered={onCentered}
    />
  )
}

function PinCard({
  pin,
  pins,
  world,
  camera,
  editName,
  onDelete,
  onCentered,
}: {
  pin: Pin
  pins: PinsStore
  world: WorldStore
  camera: CameraStore
  editName: boolean
  onDelete: (id: string) => void
  onCentered?: () => void
}) {
  const type = pinType(pin.type)
  const chip = typeChipColors(PIN_SHAPES[type])
  const field = useStore(world, (s) => s.field)
  const allPins = useStore(pins, (s) => s.pins)
  const [tab, setTab] = useState<TabId>('descricao')
  const tabsId = useId()

  const close = () => pins.getState().select(null)
  const center = () => {
    const p = pinToWorld(pin.pos)
    camera.getState().controls?.focusOn?.(p.x, p.y, CENTER_PIN_ZOOM)
    onCentered?.()
  }
  const duplicate = () => {
    pins.getState().duplicatePin(pin.id, duplicateOffset(pin.pos, camera.getState().scale))
  }

  return (
    <section aria-label={`Pin ${pin.name}`} data-testid="pin-drawer" data-pin-id={pin.id} className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0">
        <div
          className="flex h-[74px] items-center justify-center border-b border-line"
          style={{ background: 'repeating-linear-gradient(135deg, var(--sunken) 0 10px, var(--paper-solid) 10px 20px)' }}
        >
          <button
            type="button"
            disabled
            title="Adicionar imagem de capa (16:9)"
            className="flex h-9 items-center gap-2 rounded-control px-3 text-[13px] font-semibold text-ink-2 disabled:cursor-default"
          >
            <ImagePlus size={16} aria-hidden="true" />
            Adicionar imagem de capa (16:9)
          </button>
        </div>
        <button
          type="button"
          aria-label="Fechar"
          title="Fechar (Esc)"
          onClick={close}
          className="absolute top-3.5 right-3 hidden size-11 place-items-center rounded-control border border-line bg-paper-solid text-ink hover:bg-hover active:bg-press focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none md:grid"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <header className="flex flex-col gap-2.5 px-5 pt-5 pb-4">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-panel border border-line bg-field shadow-sm" data-testid="pin-drawer-icon">
              <PinIcon type={type} size={36} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
              <NameField pin={pin} pins={pins} edit={editName} onEscape={close} />
              <span
                data-testid="pin-drawer-type"
                style={{ background: chip.background, color: chip.color }}
                className="rounded-pill px-2 text-[11px]/5 font-extrabold tracking-[.08em] uppercase"
              >
                {pinTypeLabel(type)}
              </span>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-[13px] text-ink-2" data-testid="pin-drawer-place">
            <MapPin size={14} aria-hidden="true" className="shrink-0" />
            {pinPlace(field, pin.pos)}
          </p>
        </header>

        <div role="tablist" aria-label="Ficha do pin" className="mx-5 flex gap-5 border-b border-line" onKeyDown={(e) => moveTab(e, tab, setTab)}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${tabsId}-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`${tabsId}-${t.id}-painel`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={[
                '-mb-px border-b-2 pt-1 pb-2 text-[14px] font-bold focus-visible:rounded-control focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none',
                tab === t.id ? 'border-amber text-amber-ink' : 'border-transparent text-ink-2 hover:border-line-2 hover:text-ink',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {TABS.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`${tabsId}-${t.id}-painel`}
            aria-labelledby={`${tabsId}-${t.id}`}
            hidden={tab !== t.id}
            className="px-5 pt-4 pb-6"
          >
            {t.id === 'descricao' && tab === 'descricao' && (
              <div className="flex flex-col gap-5">
                <DescriptionEditor
                  value={pin.description}
                  onChange={(description) => pins.getState().updatePin(pin.id, { description })}
                  onBlur={() => pins.getState().endTextEdit()}
                />
                <PinTags
                  tags={pin.tags}
                  suggestions={suggestedTags(allPins, pin.id)}
                  onChange={(tags) => pins.getState().updatePin(pin.id, { tags: [...tags] })}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <footer className="flex shrink-0 gap-2 border-t border-line px-4 py-3">
        <FooterButton onClick={center}>
          <LocateFixed size={16} aria-hidden="true" />
          Centralizar
        </FooterButton>
        <FooterButton onClick={duplicate}>
          <Copy size={16} aria-hidden="true" />
          Duplicar
        </FooterButton>
        <FooterButton destructive onClick={() => onDelete(pin.id)}>
          <Trash2 size={16} aria-hidden="true" />
          Excluir
        </FooterButton>
      </footer>
    </section>
  )
}

/** Setas, Home e End mudam de aba (o padrão das abas do WAI-ARIA, com a ativação junto do foco). */
function moveTab(e: KeyboardEvent<HTMLDivElement>, current: TabId, setTab: (id: TabId) => void) {
  const i = TABS.findIndex((t) => t.id === current)
  const next =
    e.key === 'ArrowRight' ? (i + 1) % TABS.length
    : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length
    : e.key === 'Home' ? 0
    : e.key === 'End' ? TABS.length - 1
    : null
  if (next === null) return
  e.preventDefault()
  setTab(TABS[next].id)
  const tablist = e.currentTarget
  requestAnimationFrame(() => tablist.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus())
}

function FooterButton({ destructive = false, onClick, children }: { destructive?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control px-2 text-[13px] font-bold',
        'focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none',
        destructive
          ? 'bg-brick text-white hover:bg-[#9C2F25] active:bg-[#86281F]'
          : 'border border-line-2 bg-field text-ink hover:border-ink-3 hover:bg-sunken active:bg-press',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** O nome do pin, editável (AC-F3-01, AC-F3-06). */
function NameField({ pin, pins, edit, onEscape }: { pin: Pin; pins: PinsStore; edit: boolean; onEscape: () => void }) {
  const [draft, setDraft] = useState(pin.name)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!edit) return
    // Depois do deslizamento do drawer e da câmera: o foco não rola nada.
    input.current?.focus({ preventScroll: true })
    input.current?.select()
  }, [edit])

  // O nome mudou fora do campo (desfazer ou refazer, pela barra ou por Ctrl+Z): o campo acompanha.
  // Com o foco no campo, o texto é o que a pessoa digita (o nome salvo vem sem os espaços das pontas).
  useEffect(() => {
    if (document.activeElement !== input.current) setDraft(pin.name)
  }, [pin.name])

  return (
    <>
      <label className="sr-only" htmlFor={`pin-name-${pin.id}`}>
        Nome do pin
      </label>
      <input
        ref={input}
        id={`pin-name-${pin.id}`}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const name = e.target.value.trim()
          if (name) pins.getState().rename(pin.id, name)
        }}
        onBlur={() => {
          setDraft(pins.getState().pins.find((p) => p.id === pin.id)?.name ?? pin.name)
          pins.getState().endTextEdit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onEscape()
          }
        }}
        maxLength={80}
        className="-mx-1.5 w-full rounded-control border border-transparent bg-transparent px-1.5 font-title text-[21px]/7 font-semibold text-ink hover:border-line-2 focus:border-amber focus:bg-field focus:shadow-[0_0_0_3px_var(--amber-soft)] focus:outline-none"
      />
    </>
  )
}
