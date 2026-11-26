import { Viewport } from 'pixi-viewport'
import type { Application } from 'pixi.js'
import {
  CAMERA_TWEEN_MS,
  KEY_PAN_STEP,
  WORLD_SIZE,
  clampTransform,
  easeCamera,
  fitView,
  inDialog,
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
  /** A faixa à direita que o drawer aberto cobre (px CSS): os limites de pan e o centro do pin contam com ela. */
  private cover = 0
  /**
   * O drawer fechou (a faixa nova): enquanto o mapa não está dentro dos limites sem ele, a faixa antiga
   * continua valendo, e a câmera desliza de volta (`settle`). Só no fim a faixa sai.
   */
  private pendingCover: number | null = null
  /** Um arrasto ou uma pinça em curso: a volta aos limites espera o gesto (e a inércia) acabar. */
  private gesture = false

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

    // Um gesto interrompe o deslizamento. Com o drawer recém-fechado, a volta aos limites recomeça de
    // onde o mapa ficou ao soltar (ou ao parar de se mover), sem saltar no meio do gesto.
    const cancel = () => {
      this.tween = null
    }
    const gestureStart = () => {
      this.gesture = true
      cancel()
    }
    const gestureEnd = () => {
      this.gesture = false
      this.settle()
    }
    this.viewport.on('drag-start', gestureStart)
    this.viewport.on('pinch-start', gestureStart)
    this.viewport.on('drag-end', gestureEnd)
    this.viewport.on('pinch-end', gestureEnd)
    this.viewport.on('wheel-start', cancel)
    this.viewport.on('moved-end', this.settle)
    this.viewport.on('moved', this.clamp)
    this.viewport.on('frame-end', this.frame)
    document.addEventListener('keydown', this.onKeyDown)
  }

  /** O primeiro campo chegou: abre no mapa inteiro. Campos seguintes não mexem na câmera. */
  showWorld() {
    if (this.fitted) return
    this.fitted = true
    this.jump(fitView(this.area))
  }

  /**
   * O drawer abriu (`px`, a largura dele) ou fechou (0). Ao abrir, os limites de pan passam a deixar
   * o mapa ir para a esquerda até a borda do drawer. Ao fechar, se o mapa estava além dos limites sem
   * ele, a câmera desliza de volta (350 ms; com movimento reduzido, salta); senão, fica onde está.
   */
  setRightCover(px: number) {
    if (px >= this.cover || !this.fitted) {
      this.pendingCover = null
      this.cover = px
      return
    }
    // Um deslizamento em curso (até o pin) termina primeiro; a volta aos limites vem depois dele.
    this.pendingCover = px
    this.settle()
  }

  /**
   * A câmera ainda vai andar sozinha: um deslizamento em curso, ou a volta aos limites do drawer que
   * acabou de fechar. O deslizamento é medido no tempo, e a posição só muda a cada quadro: com os
   * quadros atrasados, a posição parada não quer dizer que a câmera parou.
   */
  get moving(): boolean {
    return this.tween !== null || this.pendingCover !== null
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
    this.settle()
  }

  center() {
    this.moveTo(fitView(this.area))
  }

  /**
   * Zoom no centro da área livre, deslizando (os botões + e − e as teclas). Toques seguidos somam a
   * partir do destino do deslizamento em curso.
   */
  zoomBy(factor: number) {
    const base = this.tween?.to ?? this.currentView()
    const { min, max } = zoomLimits(this.area)
    this.moveTo({ ...base, scale: Math.min(max, Math.max(min, base.scale * factor)) })
  }

  /** Põe o ponto do mundo (cx, cy) no centro da área livre na hora (o minimapa), sem mudar o zoom. */
  centerOn(cx: number, cy: number) {
    if (!this.fitted) return
    this.tween = null
    this.viewport.plugins.get('decelerate')?.reset()
    this.jump({ cx, cy, scale: this.viewport.scale.x })
    this.settle()
  }

  /**
   * Leva o ponto do mundo (cx, cy) ao centro da área livre, sem mudar o zoom, deslizando em 350 ms
   * (com movimento reduzido, salta), até onde os limites de pan deixam. Com o drawer aberto
   * (`setRightCover`), o ponto vai ao centro do que sobra à esquerda dele.
   */
  panTo(cx: number, cy: number) {
    if (!this.fitted) return
    const base = this.tween?.to ?? this.currentView()
    this.moveTo({ cx: cx + this.cover / 2 / base.scale, cy, scale: base.scale })
  }

  /**
   * Foca o ponto do mundo (cx, cy): leva-o ao centro da área livre deslizando, como o `panTo`, e
   * aproxima até `minZoom` (zoom relativo) se a câmera está mais longe (Centralizar do drawer). Mais
   * perto, o zoom fica. Com o drawer aberto, como no `panTo`.
   */
  focusOn(cx: number, cy: number, minZoom: number) {
    if (!this.fitted) return
    const base = this.tween?.to ?? this.currentView()
    const { min, max } = zoomLimits(this.area)
    const scale = Math.min(max, Math.max(min, base.scale, minZoom * fitView(this.area).scale))
    this.moveTo({ cx: cx + this.cover / 2 / scale, cy, scale })
  }

  /** Segura o pan enquanto `held` (o arrasto de um pin); a pinça e a roda continuam. */
  holdPan(held: boolean) {
    if (held) {
      this.viewport.plugins.pause('drag')
      this.viewport.plugins.get('decelerate')?.reset()
    } else {
      this.viewport.plugins.resume('drag')
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.onKeyDown)
    this.reducedMotion.removeEventListener('change', this.applyMotion)
    this.viewport.off('moved', this.clamp)
    this.viewport.off('frame-end', this.frame)
    this.viewport.off('moved-end', this.settle)
    // Antes do app: o viewport tira a própria função do ticker, que o app.destroy apaga.
    this.viewport.removeFromParent()
    this.viewport.destroy()
  }

  private currentView(): View {
    return toView({ x: this.viewport.x, y: this.viewport.y, scale: this.viewport.scale.x }, this.area)
  }

  /**
   * Com o drawer recém-fechado (`pendingCover`) e a câmera parada (sem deslizamento nem gesto): se o
   * mapa já está dentro dos limites sem o drawer, a faixa sai; senão, ele desliza de volta (350 ms; com
   * movimento reduzido, salta), e a faixa sai no fim. Interrompido (um gesto, o minimapa, a tela
   * mudou), recomeça de onde o mapa ficou.
   */
  private settle = () => {
    if (this.pendingCover === null || this.tween || this.gesture) return
    const px = this.pendingCover
    const now = this.currentView()
    const target = toView(clampTransform(toTransform(now, this.area), this.area, WORLD_SIZE, px), this.area)
    const inside = Math.abs(target.cx - now.cx) * now.scale < 0.5 && Math.abs(target.cy - now.cy) * now.scale < 0.5
    if (inside || this.reducedMotion.matches) {
      this.cover = px
      this.pendingCover = null
      if (!inside) this.jump(target)
      return
    }
    this.viewport.plugins.get('decelerate')?.reset()
    this.tween = { from: now, to: target, start: performance.now(), duration: CAMERA_TWEEN_MS }
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
    const target = toView(clampTransform(toTransform(view, this.area), this.area, WORLD_SIZE, this.cover), this.area)
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
      if (k >= 1) {
        this.tween = null
        this.settle()
      }
    }
    const clamped = this.clamp()
    this.onChange(clamped, relativeZoom(clamped.scale, this.area))
  }

  /**
   * Aplica os limites. Também roda no `moved` do arrasto e da pinça, antes de a inércia guardar a
   * posição: senão ela mede a velocidade com posições além do limite e, ao soltar contra a borda,
   * joga o mapa para o lado oposto.
   */
  private clamp = (): Transform => {
    const now = { x: this.viewport.x, y: this.viewport.y, scale: this.viewport.scale.x }
    const clamped = clampTransform(now, this.area, WORLD_SIZE, this.cover)
    if (clamped.x !== now.x || clamped.y !== now.y || clamped.scale !== now.scale) {
      this.set(clamped)
      // Bateu no limite: a inércia para nesse eixo, em vez de empurrar a borda; no outro, continua.
      const decelerate = this.viewport.plugins.get('decelerate', true)
      if (decelerate) {
        if (clamped.x !== now.x) decelerate.x = 0
        if (clamped.y !== now.y) decelerate.y = 0
      }
    }
    return clamped
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.fitted || e.defaultPrevented || this.host.inert || isFieldTarget(e.target) || inDialog(e.target)) return
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
      this.zoomBy(action.factor)
    }
  }
}
