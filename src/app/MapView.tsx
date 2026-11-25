import { useEffect, useRef, type RefObject } from 'react'
import { useStore } from 'zustand'
import type { MapInsets, MapRenderer } from '../render/MapRenderer'
import type { CameraStore } from '../state/cameraStore'
import type { PinImages } from '../state/pinImages'
import type { PinsStore } from '../state/pinsStore'
import type { UiStore } from '../state/uiStore'
import { isGenerating, type WorldStore } from '../state/worldStore'
import { panelInsets } from './panelInsets'

export type CreateMapRenderer = (
  host: HTMLElement,
  world: WorldStore,
  insets: () => MapInsets,
  ui: UiStore,
  camera: CameraStore,
  pins: PinsStore,
  images?: PinImages,
) => Promise<MapRenderer>

/** O renderer do Pixi, carregado à parte: o React não depende dele para montar o editor. */
const createPixiRenderer: CreateMapRenderer = (host, world, insets, ui, camera, pins, images) =>
  import('../render/MapRenderer').then((m) => m.createMapRenderer(host, world, insets, ui, camera, pins, images))

/**
 * Área do mapa do editor: o renderer desenha nela o campo do `world`, com as camadas ligadas no
 * `ui`. O React só cria e destrói o renderer; o desenho não passa pelo React (ADR 0001). Quando a
 * sidebar recolhe ou abre (`sidebarCollapsed` do `ui`), a área livre muda e o mapa se ajusta a ela.
 * Durante a geração (`isGenerating`: o pedido mais novo não chegou, ou o mapa é a prévia), o mapa
 * fica `aria-busy` e `data-blurred`; o desfoque do terreno e da decoração é do renderer (AC-F1-18).
 * O renderer publica a câmera no `camera`, e o `MapView` registra nele os comandos do renderer que
 * guardou (o minimapa e o controle de zoom leem e comandam por ele). Com a ferramenta Medir distância
 * (`tool` do `ui`) e com Adicionar pin, o cursor sobre o mapa é a cruz, e a ferramenta fica em
 * `data-tool`. O renderer desenha os pins do `pins`; com o mouse sobre um pin, o cursor é a mãozinha, e
 * arrastando um pin, a mão fechada; sobre um grupo de pins, a lupa. As imagens enviadas dos pins (`images`) vão para o renderer.
 */
export function MapView({
  world,
  pins,
  ui,
  camera,
  inert,
  images,
  createRenderer = createPixiRenderer,
  ref,
}: {
  world: WorldStore
  pins: PinsStore
  ui: UiStore
  camera: CameraStore
  inert: boolean
  images?: PinImages
  createRenderer?: CreateMapRenderer
  /** O elemento do mapa (o `<main>`), para quem precisa levar o foco até ele (`focusMap`). */
  ref?: RefObject<HTMLElement | null>
}) {
  const host = useRef<HTMLElement>(null)
  const blurred = useStore(world, isGenerating)
  const tool = useStore(ui, (s) => s.tool)
  const overPin = useStore(pins, (s) => s.hoveredId !== null)
  const overGroup = useStore(pins, (s) => s.groupHovered)
  const draggingPin = useStore(pins, (s) => s.dragging !== null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const mounted: { renderer: MapRenderer | null; disposed: boolean } = { renderer: null, disposed: false }
    const insets = () => panelInsets(ui.getState().sidebarCollapsed)
    const unsubscribe = ui.subscribe((state, prev) => {
      if (state.sidebarCollapsed !== prev.sidebarCollapsed) mounted.renderer?.refit()
    })
    createRenderer(el, world, insets, ui, camera, pins, images).then(
      (r) => {
        if (mounted.disposed) {
          r.destroy()
          return
        }
        mounted.renderer = r
        if (r.controls) camera.getState().setControls(r.controls)
      },
      (error: unknown) => console.error('Não foi possível iniciar o renderer do mapa', error),
    )
    return () => {
      unsubscribe()
      mounted.disposed = true
      const controls = mounted.renderer?.controls
      if (controls && camera.getState().controls === controls) camera.getState().setControls(null)
      mounted.renderer?.destroy()
    }
  }, [world, pins, ui, camera, images, createRenderer])

  return (
    <main
      ref={(el) => {
        host.current = el
        if (ref) ref.current = el
      }}
      aria-label="Mapa"
      data-testid="map"
      data-blurred={blurred}
      data-tool={tool}
      aria-busy={blurred}
      inert={inert}
      className={`absolute inset-0 bg-map-canvas outline-none ${draggingPin ? 'cursor-grabbing' : overPin ? 'cursor-pointer' : overGroup ? 'cursor-zoom-in' : tool === 'measure' || tool === 'pin' ? 'cursor-crosshair' : ''}`}
    />
  )
}

