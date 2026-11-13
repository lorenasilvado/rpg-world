import { useEffect, useRef } from 'react'
import type { MapInsets, MapRenderer } from '../render/MapRenderer'
import type { UiStore } from '../state/uiStore'
import type { WorldStore } from '../state/worldStore'
import { panelInsets } from './panelInsets'

export type CreateMapRenderer = (
  host: HTMLElement,
  world: WorldStore,
  insets: () => MapInsets,
  ui: UiStore,
) => Promise<MapRenderer>

/** O renderer do Pixi, carregado à parte: o React não depende dele para montar o editor. */
const createPixiRenderer: CreateMapRenderer = (host, world, insets, ui) =>
  import('../render/MapRenderer').then((m) => m.createMapRenderer(host, world, insets, ui))

/**
 * Área do mapa do editor: o renderer desenha nela o campo do `world`, com as camadas ligadas no
 * `ui`. O React só cria e destrói o renderer; o desenho não passa pelo React (ADR 0001).
 */
export function MapView({
  world,
  ui,
  inert,
  createRenderer = createPixiRenderer,
}: {
  world: WorldStore
  ui: UiStore
  inert: boolean
  createRenderer?: CreateMapRenderer
}) {
  const host = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const mounted: { renderer: MapRenderer | null; disposed: boolean } = { renderer: null, disposed: false }
    createRenderer(el, world, panelInsets, ui).then(
      (r) => {
        if (mounted.disposed) r.destroy()
        else mounted.renderer = r
      },
      (error: unknown) => console.error('Não foi possível iniciar o renderer do mapa', error),
    )
    return () => {
      mounted.disposed = true
      mounted.renderer?.destroy()
    }
  }, [world, ui, createRenderer])

  return (
    <main ref={host} aria-label="Mapa" data-testid="map" inert={inert} className="absolute inset-0 bg-map-canvas" />
  )
}
