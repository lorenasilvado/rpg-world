import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { Pin } from '../../persistence/types'
import { PIN_SHAPES } from '../../render/style/pinShapes'
import { pinType, pinTypeLabel } from '../../state/pinTypes'
import type { PinsStore } from '../../state/pinsStore'
import { PinIcon } from './PinIcon'
import { typeChipColors } from './typeChip'

/**
 * O conteúdo do drawer com um pin selecionado (pins.md → E2, AC-F3-01 e AC-F3-03): o ícone do
 * tipo, o nome, editável, e a etiqueta do tipo, na cor dele. Sem pin selecionado, nada.
 *
 * O pin recém-criado (`newPinId`) abre com o nome em edição (o campo com o foco e o texto
 * selecionado). O nome muda a cada tecla; um nome vazio não fica: ao sair do campo, volta o último
 * nome. Fora do foco, o campo acompanha o nome do pin (desfazer e refazer). Enter sai do campo; Esc, nele, fecha o drawer. O botão fechar (a partir de 768 px; abaixo,
 * o painel sobreposto tem o seu) também fecha.
 */
export function PinDrawer({ pins }: { pins: PinsStore }) {
  const selected = useStore(pins, (s) => s.pins.find((p) => p.id === s.selectedId) ?? null)
  const isNew = useStore(pins, (s) => s.selectedId !== null && s.selectedId === s.newPinId)
  if (!selected) return null
  return <PinCard key={selected.id} pin={selected} pins={pins} editName={isNew} />
}

function PinCard({ pin, pins, editName }: { pin: Pin; pins: PinsStore; editName: boolean }) {
  const [draft, setDraft] = useState(pin.name)
  const input = useRef<HTMLInputElement>(null)
  const type = pinType(pin.type)
  const chip = typeChipColors(PIN_SHAPES[type])

  useEffect(() => {
    if (!editName) return
    // Depois do deslizamento do drawer e da câmera: o foco não rola nada.
    input.current?.focus({ preventScroll: true })
    input.current?.select()
  }, [editName])

  // O nome mudou fora do campo (desfazer ou refazer, pela barra ou por Ctrl+Z): o campo acompanha.
  // Com o foco no campo, o texto é o que a pessoa digita (o nome salvo vem sem os espaços das pontas).
  useEffect(() => {
    if (document.activeElement !== input.current) setDraft(pin.name)
  }, [pin.name])

  const close = () => pins.getState().select(null)

  return (
    <section aria-label={`Pin ${pin.name}`} data-testid="pin-drawer" data-pin-id={pin.id} className="flex min-h-0 flex-1 flex-col">
      <div className="hidden h-14 shrink-0 items-center justify-end px-3 md:flex">
        <button
          type="button"
          aria-label="Fechar"
          title="Fechar (Esc)"
          onClick={close}
          className="grid size-11 place-items-center rounded-control text-ink hover:bg-hover active:bg-press"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <header className="flex items-start gap-4 px-5 pt-2 pb-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-panel border border-line bg-field shadow-sm" data-testid="pin-drawer-icon">
          <PinIcon type={type} size={40} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
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
              pins.getState().endNameEdit()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                close()
              }
            }}
            maxLength={80}
            className="-mx-1.5 w-full rounded-control border border-transparent bg-transparent px-1.5 font-title text-[21px]/7 font-semibold text-ink hover:border-line-2 focus:border-amber focus:bg-field focus:shadow-[0_0_0_3px_var(--amber-soft)] focus:outline-none"
          />
          <span
            data-testid="pin-drawer-type"
            style={{ background: chip.background, color: chip.color }}
            className="rounded-pill px-2 text-[11px]/5 font-extrabold tracking-[.08em] uppercase"
          >
            {pinTypeLabel(type)}
          </span>
        </div>
      </header>
    </section>
  )
}
