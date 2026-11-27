import { ChevronRight, Route } from 'lucide-react'
import { useId } from 'react'
import { useStore } from 'zustand'
import type { Pin, Road } from '../../persistence/types'
import { roadLengthKm } from '../../render/layers/roadMath'
import { childrenOf } from '../../state/pinHierarchy'
import { pinImageId, type PinImages } from '../../state/pinImages'
import { pinType, pinTypeLabel } from '../../state/pinTypes'
import type { PinsStore } from '../../state/pinsStore'
import { NO_ROADS_STORE, ROAD_KIND_LABELS, roadConnections, type RoadsStore } from '../../state/roadsStore'
import type { WorldStore } from '../../state/worldStore'
import { formatKm } from '../map/measure'
import { PinIcon } from './PinIcon'

/**
 * A aba Conexões do drawer (pins.md → E2, AC-F3-13, AC-F5-15): o pin pai, os pins filhos e as
 * estradas ligadas ao pin. Cada pin é um botão que o seleciona (`onOpen`). Sem pai, "Sem pin pai.";
 * sem filhos, "Nenhum pin pertence a este.".
 *
 * Estradas: uma linha por vizinho na estrada (`roadConnections`: o pin da ponta tem o seguinte, o do
 * meio, o anterior e o seguinte), com o nome do vizinho ("Ponto no mapa" sem pin daquele lado) e
 * "nome da estrada · tipo · km". Clicar seleciona o vizinho, ou a estrada, sem pin daquele lado.
 * Sem estradas, o convite para Desenhar estrada (R) ou Rota automática (A).
 */
export function PinConnections({
  pin,
  pins,
  roads,
  world,
  images,
  onOpen,
}: {
  pin: Pin
  pins: PinsStore
  roads?: RoadsStore | undefined
  world: WorldStore
  images: PinImages
  onOpen: (id: string) => void
}) {
  const ids = useId()
  const all = useStore(pins, (s) => s.pins)
  const allRoads = useStore(roads ?? NO_ROADS_STORE, (s) => s.roads)
  const sizeKm = useStore(world, (s) => s.sizeKm)
  const byId = new Map(all.map((p) => [p.id, p]))
  const parent = pin.parentId === undefined ? undefined : byId.get(pin.parentId)
  const children = childrenOf(all, pin.id)
  const connections = roadConnections(allRoads, pin.id)
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
      <section aria-labelledby={`${ids}-estradas`} className="flex flex-col gap-2">
        <h3 id={`${ids}-estradas`} className="text-[13px] font-bold text-ink-2">
          Estradas{connections.length > 0 && ` (${connections.length})`}
        </h3>
        {connections.length > 0 ? (
          <ul className="flex flex-col gap-1.5" data-testid="pin-roads">
            {connections.map((c, i) => {
              const neighbor = c.neighbor === undefined ? undefined : byId.get(c.neighbor)
              return (
                <RoadLink
                  key={`${c.road.id}-${i}`}
                  road={c.road}
                  neighbor={neighbor}
                  km={roadLengthKm(c.road, (id) => byId.get(id)?.pos, sizeKm)}
                  onOpen={() => (neighbor ? onOpen(neighbor.id) : roads?.getState().select(c.road.id))}
                />
              )
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-2">
            Nenhuma estrada liga este pin. Use <b className="text-ink">Desenhar estrada</b> (R) ou <b className="text-ink">Rota automática</b> (A).
          </p>
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

/** Uma estrada vista do pin: o vizinho e "estrada · tipo · km"; clicar abre o vizinho (ou a estrada). */
function RoadLink({ road, neighbor, km, onOpen }: { road: Road; neighbor: Pin | undefined; km: number; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        data-road-link={road.id}
        data-neighbor={neighbor?.id ?? ''}
        className="flex min-h-12 w-full items-center gap-2.5 rounded-[10px] border border-line bg-field px-2.5 py-1.5 text-left text-ink hover:border-line-2 focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
      >
        <Route size={18} aria-hidden="true" className="shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold">{neighbor ? neighbor.name : 'Ponto no mapa'}</span>
          <span className="truncate text-[12px]/4 text-ink-2">
            {road.name} · {ROAD_KIND_LABELS[road.kind]} · {formatKm(km)}
          </span>
        </span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
      </button>
    </li>
  )
}
