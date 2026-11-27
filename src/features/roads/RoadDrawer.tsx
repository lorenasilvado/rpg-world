import { ChevronRight, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { Pin, Road, RoadKind } from '../../persistence/types'
import { roadLengthKm } from '../../render/layers/roadMath'
import { pinImageId, type PinImages } from '../../state/pinImages'
import { pinType } from '../../state/pinTypes'
import type { PinsStore } from '../../state/pinsStore'
import { ROAD_KIND_LABELS, linkedPins, type RoadsStore } from '../../state/roadsStore'
import type { WorldStore } from '../../state/worldStore'
import { formatKm } from '../map/measure'
import { PinIcon } from '../pins/PinIcon'

/** Os tipos de via, na ordem do seletor (estradas.md → Drawer da estrada); os nomes vêm de `ROAD_KIND_LABELS`. */
const ROAD_KINDS: readonly { id: RoadKind; label: string }[] = (['road', 'trail', 'sea'] as const).map((id) => ({ id, label: ROAD_KIND_LABELS[id] }))

/**
 * O drawer da estrada selecionada (estradas.md → Drawer da estrada, AC-F5-06 a AC-F5-08), no mesmo
 * lugar do drawer do pin. Sem estrada selecionada, nada.
 *
 * - O cabeçalho "Estrada" e o botão fechar (a partir de 768 px; abaixo, o painel sobreposto tem o seu).
 * - O nome, editável: muda a cada tecla, e as teclas seguidas viram um passo no Desfazer (o
 *   `endTextEdit` ao sair do campo fecha o passo). Um nome vazio não fica: ao sair do campo, volta o
 *   último nome. Fora do foco, o campo acompanha o nome da estrada (desfazer e refazer). Enter sai do
 *   campo; Esc, nele, fecha o drawer.
 * - O tipo de via, num seletor segmentado (Estrada, Trilha, Rota marítima): cada troca é um passo.
 * - "Liga": os pins das pontas, cada um um botão que o seleciona (`onOpenPin`); sem pin ligado, o aviso.
 * - A extensão aproximada, em km (a curva, no `sizeKm` do mundo).
 * - O rodapé: "Excluir estrada" (`onDelete`, com o toast "Estrada excluída").
 */
export function RoadDrawer({
  roads,
  pins,
  images,
  world,
  onDelete,
}: {
  roads: RoadsStore
  pins: PinsStore
  images: PinImages
  world: WorldStore
  /** Exclui a estrada (o mesmo da tecla Delete: o toast "Estrada excluída" com Desfazer). */
  onDelete: (id: string) => void
}) {
  const selected = useStore(roads, (s) => s.roads.find((r) => r.id === s.selectedId) ?? null)
  if (!selected) return null
  return <RoadCard key={selected.id} road={selected} roads={roads} pins={pins} images={images} world={world} onDelete={onDelete} />
}

function RoadCard({
  road,
  roads,
  pins,
  images,
  world,
  onDelete,
}: {
  road: Road
  roads: RoadsStore
  pins: PinsStore
  images: PinImages
  world: WorldStore
  onDelete: (id: string) => void
}) {
  const ids = useId()
  const allPins = useStore(pins, (s) => s.pins)
  const sizeKm = useStore(world, (s) => s.sizeKm)
  const byId = new Map(allPins.map((p) => [p.id, p]))
  const ends = linkedPins(road)
    .map((id) => byId.get(id))
    .filter((p): p is Pin => p !== undefined)
  const km = roadLengthKm(road, (id) => byId.get(id)?.pos, sizeKm)
  const close = () => roads.getState().select(null)

  return (
    <section aria-label={`Estrada ${road.name}`} data-testid="road-drawer" data-road-drawer="" data-road-id={road.id} className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between pt-4 pr-3 pb-2 pl-5">
        <span className="text-[11px]/4 font-extrabold tracking-[.08em] text-ink-2 uppercase">Estrada</span>
        <button
          type="button"
          aria-label="Fechar"
          title="Fechar (Esc)"
          onClick={close}
          className="hidden size-11 place-items-center rounded-control text-ink hover:bg-hover active:bg-press focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none desk:grid"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-5">
        <NameField road={road} roads={roads} onEscape={close} />

        <div role="group" aria-labelledby={`${ids}-tipo`} className="flex flex-col gap-2">
          <span id={`${ids}-tipo`} className="font-bold">
            Tipo de via
          </span>
          {/* Abaixo de 768 px, o drawer tem 320 px: cada botão fica com a largura do texto, numa linha
              só ("Rota marítima" não quebra); a partir de 768 px, os três iguais, como no protótipo. */}
          <div className="flex rounded-[10px] border border-line bg-sunken p-[3px]" data-testid="road-kind">
            {ROAD_KINDS.map((k) => {
              const on = road.kind === k.id
              return (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => roads.getState().updateRoad(road.id, { kind: k.id })}
                  className={[
                    'h-[34px] min-w-0 flex-auto rounded-[7px] px-2 text-[13px] font-bold whitespace-nowrap text-ink desk:flex-1 desk:px-1',
                    'focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none',
                    on ? 'bg-paper-solid shadow-sm' : 'hover:bg-hover',
                  ].join(' ')}
                >
                  {k.label}
                </button>
              )
            })}
          </div>
        </div>

        <section aria-labelledby={`${ids}-liga`} className="flex flex-col gap-2">
          <h3 id={`${ids}-liga`} className="font-bold">
            Liga
          </h3>
          {ends.length > 0 ? (
            <ul className="flex flex-col gap-2" data-testid="road-ends">
              {ends.map((p, i) => (
                <EndLink key={`${p.id}-${i}`} pin={p} images={images} onOpen={(id) => pins.getState().select(id)} />
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-2">Nenhum pin: as pontas ficam soltas no mapa.</p>
          )}
        </section>

        <p className="text-ink-2" data-testid="road-length">
          Extensão aproximada: <b className="text-ink">{formatKm(km)}</b>
        </p>
      </div>

      <footer className="flex shrink-0 justify-end border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() => onDelete(road.id)}
          className="flex h-10 items-center gap-1.5 rounded-control bg-brick px-4 text-[13px] font-bold text-white hover:bg-[#9C2F25] active:bg-[#86281F] focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none"
        >
          <Trash2 size={16} aria-hidden="true" />
          Excluir estrada
        </button>
      </footer>
    </section>
  )
}

/** Um pin da ponta: o ícone e o nome; clicar o seleciona (AC-F5-07). */
function EndLink({ pin, images, onOpen }: { pin: Pin; images: PinImages; onOpen: (id: string) => void }) {
  const imageId = pinImageId(pin)
  const imageUrl = useStore(images.store, (s) => (imageId ? s.urls[imageId] : undefined))
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(pin.id)}
        data-pin-link={pin.id}
        className="flex h-12 w-full items-center gap-2.5 rounded-[10px] border border-line bg-field px-2.5 text-left text-ink hover:border-line-2 focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
      >
        <PinIcon type={pinType(pin.type)} size={22} image={imageUrl} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate font-bold">{pin.name}</span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
      </button>
    </li>
  )
}

/** O nome da estrada, editável (AC-F5-07). */
function NameField({ road, roads, onEscape }: { road: Road; roads: RoadsStore; onEscape: () => void }) {
  const [draft, setDraft] = useState(road.name)
  const input = useRef<HTMLInputElement>(null)

  // O nome mudou fora do campo (desfazer ou refazer): o campo acompanha. Com o foco no campo, o texto
  // é o que a pessoa digita (o nome salvo vem sem os espaços das pontas).
  useEffect(() => {
    if (document.activeElement !== input.current) setDraft(road.name)
  }, [road.name])

  return (
    <input
      ref={input}
      aria-label="Nome da estrada"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        roads.getState().updateRoad(road.id, { name: e.target.value })
      }}
      onBlur={() => {
        setDraft(roads.getState().roads.find((r) => r.id === road.id)?.name ?? road.name)
        roads.getState().endTextEdit()
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
      className="-ml-[7px] h-10 w-full rounded-control border border-transparent bg-transparent px-1.5 font-title text-[21px]/7! font-semibold text-ink hover:border-line-2 focus:border-amber focus:bg-field focus:shadow-[0_0_0_3px_var(--amber-soft)] focus:outline-none"
    />
  )
}
