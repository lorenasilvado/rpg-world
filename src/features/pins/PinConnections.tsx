import { useId } from 'react'
import { useStore } from 'zustand'
import type { Pin } from '../../persistence/types'
import { childrenOf } from '../../state/pinHierarchy'
import { pinImageId, type PinImages } from '../../state/pinImages'
import { pinType, pinTypeLabel } from '../../state/pinTypes'
import type { PinsStore } from '../../state/pinsStore'
import { PinIcon } from './PinIcon'

/**
 * A aba Conexões do drawer (pins.md → E2, AC-F3-13): o pin pai e os pins filhos, cada um um botão
 * que o seleciona (`onOpen`). Sem pai, "Sem pin pai."; sem filhos, "Nenhum pin pertence a este.".
 * As estradas ligadas ao pin entram com F5.
 */
export function PinConnections({ pin, pins, images, onOpen }: { pin: Pin; pins: PinsStore; images: PinImages; onOpen: (id: string) => void }) {
  const ids = useId()
  const all = useStore(pins, (s) => s.pins)
  const parent = pin.parentId === undefined ? undefined : all.find((p) => p.id === pin.parentId)
  const children = childrenOf(all, pin.id)
  return (
    <div className="flex flex-col gap-6" data-testid="pin-connections">
      <section aria-labelledby={`${ids}-pai`} className="flex flex-col gap-2">
        <h3 id={`${ids}-pai`} className="text-[13px] font-bold text-ink-2">
          Pin pai
        </h3>
        {parent ? (
          <ul className="flex flex-col gap-1">
            <PinLink pin={parent} images={images} onOpen={onOpen} />
          </ul>
        ) : (
          <p className="text-[13px] text-ink-2">Sem pin pai. Escolha um na aba Detalhes.</p>
        )}
      </section>
      <section aria-labelledby={`${ids}-filhos`} className="flex flex-col gap-2">
        <h3 id={`${ids}-filhos`} className="text-[13px] font-bold text-ink-2">
          Pins filhos{children.length > 0 && ` (${children.length})`}
        </h3>
        {children.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {children.map((c) => (
              <PinLink key={c.id} pin={c} images={images} onOpen={onOpen} />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-2">Nenhum pin pertence a este.</p>
        )}
      </section>
    </div>
  )
}

/** Um pin da lista: o ícone, o nome e o tipo; clicar o seleciona. */
function PinLink({ pin, images, onOpen }: { pin: Pin; images: PinImages; onOpen: (id: string) => void }) {
  const type = pinType(pin.type)
  const imageId = pinImageId(pin)
  const imageUrl = useStore(images.store, (s) => (imageId ? s.urls[imageId] : undefined))
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(pin.id)}
        data-pin-link={pin.id}
        className="flex min-h-11 w-full items-center gap-3 rounded-control px-2 py-1.5 text-left hover:bg-hover active:bg-press focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
      >
        <PinIcon type={type} size={24} image={imageUrl} className="shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-bold text-ink">{pin.name}</span>
          <span className="text-[12px] text-ink-2">{pinTypeLabel(type)}</span>
        </span>
      </button>
    </li>
  )
}
