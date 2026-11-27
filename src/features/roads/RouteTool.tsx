import { Waypoints } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { WORLD_SIZE, inDialog, isFieldTarget } from '../../render/camera'
import type { CameraStore } from '../../state/cameraStore'
import type { PinsStore } from '../../state/pinsStore'
import type { Road } from '../../persistence/types'
import type { RoadsStore } from '../../state/roadsStore'
import type { UiStore } from '../../state/uiStore'
import { CLICK_SLOP_PX } from '../map/MeasureTool'
import { ToolHint } from '../map/ToolHint'
import { worldToScreen } from '../map/measure'
import { createVisiblePins } from '../pins/visiblePins'
import { routeHint, routeName, type RouteStep } from './autoRoute'
import type { WorldRouter } from './worldRouter'

/**
 * Rota automática (estradas.md, AC-F5-12). A tecla A (ouvida pelo `MeasureTool`, com as outras
 * ferramentas) ou a ferramenta da toolbar a liga. O primeiro clique num pin à vista o marca como a
 * origem (o anel do pin, `markedId` do `pinsStore`, sem selecioná-lo); o clique noutro pin pede a rota
 * ao worker (`router`, por terra). Enquanto ele calcula, uma linha tracejada âmbar liga os dois pins;
 * a rota que chega vira a estrada "Rota de A a B", tipo Estrada, ligada aos dois (um passo no
 * Desfazer, sem ficar selecionada), e `onCreated` mostra o toast "Rota criada". A ferramenta
 * continua ligada, pronta para a próxima rota.
 *
 * Um clique no mapa fora dos pins desmarca a origem; o clique no próprio pin de origem e os cliques
 * durante o cálculo não fazem nada. Esc com a origem marcada (ou calculando) cancela tudo e, sem
 * nada, volta para Navegar; trocar de ferramenta cancela o cálculo, e o resultado é descartado. Sem
 * caminho por terra (`route: null`) ou com o worker em falha, nada é criado e a ferramenta volta ao
 * primeiro passo; sem caminho por terra, `onNoPath` recebe os dois pins (o toast Sem caminho, com
 * "Criar rota marítima", AC-F5-13). As teclas seguem as exceções dos atalhos do mapa (foco num campo, dentro de um
 * modal, um popover aberto), e nada vale com `disabled` (painel sobreposto aberto no celular).
 */
export function RouteTool({
  ui,
  roads,
  pins,
  camera,
  router,
  disabled,
  onCreated,
  onNoPath,
}: {
  ui: UiStore
  roads: RoadsStore
  pins: PinsStore
  camera: CameraStore
  router: WorldRouter
  disabled: boolean
  /** A rota foi criada: quem o recebe mostra o toast "Rota criada". */
  onCreated?: (road: Road) => void
  /** Não há caminho por terra entre os pins `from` e `to` (ids): o toast Sem caminho (AC-F5-13). */
  onNoPath?: (from: string, to: string) => void
}) {
  const active = useStore(ui, (s) => s.tool === 'route')
  return active ? (
    <RouteLayer
      ui={ui}
      roads={roads}
      pins={pins}
      camera={camera}
      router={router}
      disabled={disabled}
      onCreated={onCreated}
      onNoPath={onNoPath}
    />
  ) : null
}

/** O elemento da área do mapa sob o evento (`null` fora dela: painéis, barras, minimapa). */
function mapUnder(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof (target as Element).closest !== 'function') return null
  return (target as Element).closest<HTMLElement>('[data-testid="map"]')
}

/** Um popover ou menu aberto (Camadas, Exportar…): o botão que o abriu tem `aria-haspopup` e `aria-expanded`. */
function popupOpen(): boolean {
  return document.querySelector('[aria-haspopup][aria-expanded="true"]') !== null
}

/** O cálculo em curso: os dois pins e o cancelamento. */
type Pending = { from: string; to: string; abort: AbortController }

function RouteLayer({
  ui,
  roads,
  pins,
  camera,
  router,
  disabled,
  onCreated,
  onNoPath,
}: {
  ui: UiStore
  roads: RoadsStore
  pins: PinsStore
  camera: CameraStore
  router: WorldRouter
  disabled: boolean
  onCreated?: (road: Road) => void
  onNoPath?: (from: string, to: string) => void
}) {
  const fromId = useStore(pins, (s) => s.markedId)
  const pinList = useStore(pins, (s) => s.pins)
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef(pending)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])
  const onCreatedRef = useRef(onCreated)
  useEffect(() => {
    onCreatedRef.current = onCreated
  }, [onCreated])
  const onNoPathRef = useRef(onNoPath)
  useEffect(() => {
    onNoPathRef.current = onNoPath
  }, [onNoPath])
  const cam = useStore(camera)

  // Sair da ferramenta cancela o cálculo e tira o anel da origem.
  useEffect(
    () => () => {
      pendingRef.current?.abort.abort()
      pendingRef.current = null
      pins.getState().mark(null)
    },
    [pins],
  )

  useEffect(() => {
    if (disabled) return
    const reset = () => {
      pendingRef.current?.abort.abort()
      pendingRef.current = null
      setPending(null)
      pins.getState().mark(null)
    }
    const start = (from: string, to: string) => {
      const list = pins.getState().pins
      const a = list.find((p) => p.id === from)
      const b = list.find((p) => p.id === to)
      if (!a || !b) return
      const job: Pending = { from, to, abort: new AbortController() }
      pendingRef.current = job
      setPending(job)
      router.route({ from: a.pos, to: b.pos, mode: 'land' }, { signal: job.abort.signal }).then(
        (res) => {
          if (pendingRef.current !== job) return
          pendingRef.current = null
          setPending(null)
          pins.getState().mark(null)
          // Um dos pins pode ter saído no meio do cálculo (Delete, Desfazer): nada é criado.
          const now = pins.getState().pins
          const A = now.find((p) => p.id === from)
          const B = now.find((p) => p.id === to)
          if (!A || !B) return
          if (!res.route) {
            onNoPathRef.current?.(from, to)
            return
          }
          const road = roads.getState().addRoad(
            { points: res.route.points, from, to, name: routeName(A.name, B.name) },
            { select: false },
          )
          if (road) onCreatedRef.current?.(road)
        },
        (error: unknown) => {
          if (pendingRef.current !== job) return
          pendingRef.current = null
          setPending(null)
          pins.getState().mark(null)
          if (!(error instanceof DOMException && error.name === 'AbortError')) console.error('A rota automática falhou.', error)
        },
      )
    }

    const keyAllowed = (e: KeyboardEvent) => !e.defaultPrevented && !isFieldTarget(e.target) && !inDialog(e.target)
    // Esc com a origem marcada ou calculando: na captura, antes das outras teclas. Com um popover ou
    // menu aberto, o Esc é dele (fecha só ele).
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !keyAllowed(e) || e.ctrlKey || e.altKey || e.metaKey || popupOpen()) return
      if (pendingRef.current === null && pins.getState().markedId === null) return
      e.preventDefault()
      e.stopPropagation()
      reset()
    }
    // Esc sem nada: depois das outras teclas (com um pin selecionado, o Esc tira a seleção antes).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !keyAllowed(e)) return
      e.preventDefault()
      ui.getState().setTool('nav')
    }

    const visible = createVisiblePins(ui, pins, camera)
    const g: { press: { id: number; x: number; y: number } | null } = { press: null }
    const down = new Set<number>()
    const onDown = (e: PointerEvent) => {
      if (!mapUnder(e.target)) return
      down.add(e.pointerId)
      g.press = down.size === 1 && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      down.delete(e.pointerId)
      const p = g.press
      if (!p || p.id !== e.pointerId) return
      g.press = null
      const map = mapUnder(e.target) ?? mapUnder(document.elementFromPoint?.(e.clientX, e.clientY) ?? null)
      if (!map || Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_SLOP_PX || !camera.getState().ready) return
      if (pendingRef.current) return
      const rect = map.getBoundingClientRect()
      const pin = visible.pinAt(e.clientX - rect.left, e.clientY - rect.top)
      const from = pins.getState().markedId
      if (!pin) {
        pins.getState().mark(null)
        return
      }
      if (from === null) pins.getState().mark(pin.id)
      else if (from !== pin.id) start(from, pin.id)
    }
    const onCancel = (e: PointerEvent) => {
      down.delete(e.pointerId)
      if (g.press?.id === e.pointerId) g.press = null
    }
    document.addEventListener('keydown', onKeyCapture, true)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    return () => {
      document.removeEventListener('keydown', onKeyCapture, true)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
    }
  }, [ui, roads, pins, camera, router, disabled])

  const step: RouteStep = pending ? 'calculating' : fromId !== null ? 'to' : 'from'
  const a = pending && pinList.find((p) => p.id === pending.from)
  const b = pending && pinList.find((p) => p.id === pending.to)
  const sa = a ? worldToScreen({ x: a.pos.u * WORLD_SIZE, y: a.pos.v * WORLD_SIZE }, cam) : null
  const sb = b ? worldToScreen({ x: b.pos.u * WORLD_SIZE, y: b.pos.v * WORLD_SIZE }, cam) : null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5]"
      data-testid="route-layer"
      data-step={step}
      data-from={fromId ?? pending?.from ?? undefined}
    >
      {cam.ready && sa && sb && (
        <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
          <line
            data-testid="route-preview"
            x1={sa.x}
            y1={sa.y}
            x2={sb.x}
            y2={sb.y}
            stroke="#C8892B"
            strokeWidth={4}
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
        </svg>
      )}
      <ToolHint icon={Waypoints} text={routeHint(step)} cam={cam} testId="route-status" textTestId="route-hint" />
    </div>
  )
}
