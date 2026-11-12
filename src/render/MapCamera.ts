import { Viewport } from 'pixi-viewport'
import type { Application } from 'pixi.js'
import {
  CAMERA_TWEEN_MS,
  KEY_PAN_STEP,
  WORLD_SIZE,
  clampTransform,
  easeCamera,
  fitView,
  isFieldTarget,
  keyAction,
  lerpView,
  relativeZoom,
  toTransform,
  toView,
  zoomLimits,
  type Area,
  type Transform,
  type View,
} from './camera'

type Tween = { from: View; to: View; start: number; duration: number }

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Câmera do mapa: pixi-viewport com pan por arrasto (mouse e toque) e inércia, zoom no cursor
 * pela roda, pinça (toque e touchpad) e os atalhos de teclado. Os limites (`camera.ts`) valem a
 * cada quadro: zoom de 0,4× a 4× do enquadramento, e o mapa sempre visível na área livre.
 *
 * Com `prefers-reduced-motion: reduce`, sem inércia e os atalhos saltam direto, sem deslizar.
 * O teclado é ouvido no `document`, menos quando o foco está num campo ou o mapa está `inert`.
 */
export class MapCamera {
  readonly viewport: Viewport
  private area: Area
  private tween: Tween | null = null
  private reducedMotion: MediaQueryList
  private fitted = false
  private host: HTMLElement
  private freeArea: () => Area
  private onChange: (t: Transform, zoom: number) => void

  constructor(app: Application, host: HTMLElement, freeArea: () => Area, onChange: (t: Transform, zoom: number) => void) {
    this.host = host
    this.freeArea = freeArea
    this.onChange = onChange
    this.area = freeArea()
    this.viewport = new Viewport({
      screenWidth: app.screen.width,
      screenHeight: app.screen.height,
      worldWidth: WORLD_SIZE,
      worldHeight: WORLD_SIZE,
      events: app.renderer.events,
      ticker: app.ticker,
      passiveWheel: false,
    })
    this.viewport
      .drag()
      .pinch()
      // O navegador entrega a pinça do touchpad como wheel com ctrlKey.
      .wheel({ trackpadPinch: true, trackpadPinchSpeed: 2.5 })
      .decelerate()
    this.applyZoomLimits()

    this.reducedMotion = window.matchMedia(REDUCED_MOTION)
    this.applyMotion()
    this.reducedMotion.addEventListener('change', this.applyMotion)

    const cancel = () => {
      this.tween = null
    }
    this.viewport.on('drag-start', cancel)
    this.viewport.on('pinch-start', cancel)
    this.viewport.on('wheel-start', cancel)
    this.viewport.on('frame-end', this.frame)
    document.addEventListener('keydown', this.onKeyDown)
  }

  /** O primeiro campo chegou: abre no mapa inteiro. Campos seguintes não mexem na câmera. */
  showWorld() {
    if (this.fitted) return
    this.fitted = true
    this.jump(fitView(this.area))
  }

  /** A tela ou os painéis mudaram: mantém o ponto no centro da área livre e o zoom relativo. */
  resize(width: number, height: number) {
    const before = this.currentView()
    const zoom = relativeZoom(before.scale, this.area)
    this.viewport.resize(width, height, WORLD_SIZE, WORLD_SIZE)
    this.area = this.freeArea()
    this.applyZoomLimits()
    if (!this.fitted) return
    this.tween = null
    this.jump({ cx: before.cx, cy: before.cy, scale: zoom * fitView(this.area).scale })
  }

  center() {
    this.moveTo(fitView(this.area))
  }

  destroy() {
    document.removeEventListener('keydown', this.onKeyDown)
    this.reducedMotion.removeEventListener('change', this.applyMotion)
    this.viewport.off('frame-end', this.frame)
    // Antes do app: o viewport tira a própria função do ticker, que o app.destroy apaga.
    this.viewport.removeFromParent()
    this.viewport.destroy()
  }

  private currentView(): View {
    return toView({ x: this.viewport.x, y: this.viewport.y, scale: this.viewport.scale.x }, this.area)
  }

  private applyZoomLimits() {
    const { min, max } = zoomLimits(this.area)
    this.viewport.clampZoom({ minScale: min, maxScale: max })
  }

  private applyMotion = () => {
    if (this.reducedMotion.matches) this.viewport.plugins.pause('decelerate')
    else this.viewport.plugins.resume('decelerate')
  }

  /** Vai para `view`: desliza em 350 ms, ou salta com movimento reduzido. */
  private moveTo(view: View) {
    const target = toView(clampTransform(toTransform(view, this.area), this.area), this.area)
    if (this.reducedMotion.matches) {
      this.tween = null
      this.jump(target)
      return
    }
    this.viewport.plugins.get('decelerate')?.reset()
    this.tween = { from: this.currentView(), to: target, start: performance.now(), duration: CAMERA_TWEEN_MS }
  }

  private jump(view: View) {
    this.set(toTransform(view, this.area))
    this.frame()
  }

  private set(t: Transform) {
    this.viewport.scale.set(t.scale)
    this.viewport.position.set(t.x, t.y)
  }

  /** A cada quadro, depois dos plugins: avança o deslizamento e aplica os limites. */
  private frame = () => {
    if (this.tween) {
      const { from, to, start, duration } = this.tween
      const k = Math.min(1, (performance.now() - start) / duration)
      this.set(toTransform(lerpView(from, to, easeCamera(k)), this.area))
      if (k >= 1) this.tween = null
    }
    const now = { x: this.viewport.x, y: this.viewport.y, scale: this.viewport.scale.x }
    const clamped = clampTransform(now, this.area)
    if (clamped.x !== now.x || clamped.y !== now.y || clamped.scale !== now.scale) {
      this.set(clamped)
      // Bateu no limite: a inércia para, em vez de empurrar a borda.
      this.viewport.plugins.get('decelerate')?.reset()
    }
    this.onChange(clamped, relativeZoom(clamped.scale, this.area))
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.fitted || e.defaultPrevented || this.host.inert || isFieldTarget(e.target)) return
    const action = keyAction(e)
    if (!action) return
    e.preventDefault()
    // Teclas seguidas (ou segurar a tecla) somam a partir do destino do deslizamento em curso.
    const base = this.tween?.to ?? this.currentView()
    if (action.type === 'center') {
      this.center()
    } else if (action.type === 'pan') {
      const step = (KEY_PAN_STEP * Math.min(this.area.width, this.area.height)) / base.scale
      this.moveTo({ ...base, cx: base.cx + action.dx * step, cy: base.cy + action.dy * step })
    } else {
      // Zoom no centro da área livre.
      const { min, max } = zoomLimits(this.area)
      this.moveTo({ ...base, scale: Math.min(max, Math.max(min, base.scale * action.factor)) })
    }
  }
}
