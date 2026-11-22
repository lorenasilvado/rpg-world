import { Application, BlurFilter, Container, type Ticker } from 'pixi.js'
import { createCameraStore, type CameraControls, type CameraStore } from '../state/cameraStore'
import { createPinsStore, type PinsState, type PinsStore } from '../state/pinsStore'
import { createUiStore, type UiStore } from '../state/uiStore'
import { isGenerating, type WorldStore } from '../state/worldStore'
import { MapCamera } from './MapCamera'
import { KEY_ZOOM_STEP, WORLD_SIZE, mapRect, type Area } from './camera'
import { DecorLayer, bindDecorLayer, destroyDecorTextures, loadDecorTextures, writeDecorState } from './layers/DecorLayer'
import { PinLayer, destroyPinTextures, loadPinTextures } from './layers/PinLayer'
import { pinToWorld } from './layers/pinMath'
import { TerrainLayer } from './layers/TerrainLayer'
import { worldView } from './layers/decorCull'
import { createMapBlur, MAP_BLUR_PX } from './mapBlur'
import { CANVAS_BACKGROUND } from './style/palette'

/** Faixas da área do mapa cobertas por painéis, em px CSS: o mapa cabe no que sobra. */
export type MapInsets = { left: number; right: number; top: number; bottom: number }

export type MapRenderer = {
  /** Recalcula a área livre (ex.: os painéis mudaram), mantendo o centro e o zoom. */
  refit(): void
  /**
   * Os comandos da câmera, que quem guarda o renderer registra no `cameraStore` (os renderers falsos
   * dos testes do jsdom não têm).
   */
  controls?: CameraControls
  destroy(): void
}

/**
 * Renderer do mapa (PixiJS): cria o app no `host`, desenha o terreno e os ícones decorativos e só
 * lê o estado. Quando chega um campo novo no `worldStore`, a textura do terreno e os ícones são
 * trocados, sem mexer na câmera. A cada quadro, a decoração passa pelo culling (pela área livre:
 * a sidebar e o drawer fixos cobrem o resto) e pelo nível de detalhe (`DecorLayer`), e a camada
 * aparece ou some conforme `layers.decor` do `ui`. Fora do mapa fica o fundo do canvas
 * (`#1F4E79`). A câmera (`MapCamera`) abre com o mapa inteiro centrado na área livre (a tela menos
 * os `insets`).
 *
 * Enquanto gera (`isGenerating`), o terreno e a decoração ficam borrados (3 px) e voltam a ficar
 * nítidos em 260 ms (`mapBlur.ts`; com movimento reduzido, na hora). O desfoque é um filtro só do
 * grupo `base` (terreno e decoração): o que for desenhado acima dele (pins e rotas) fica nítido.
 *
 * Expõe no `host`, para os testes: o tamanho do campo desenhado em `data-terrain-size`, o
 * retângulo do mapa na tela em `data-map-rect` (x, y, largura, altura em px CSS, arredondados) e o
 * zoom relativo em `data-zoom` (1 = mapa inteiro na área livre), o desfoque atual do terreno em px
 * em `data-map-blur` (de 0 a 3, uma casa decimal); da decoração, os ícones com desenho
 * no spritesheet em `data-decor-total`, os desenhados depois do culling e do nível de detalhe em
 * `data-decor-drawn` e a camada em `data-decor-layer` (`on` ou `off`). Se o spritesheet não é desenhado,
 * o mapa segue só com o terreno: a decoração fica `off`, com 0 ícones, mesmo com `layers.decor`
 * ligada no `ui`, e o console avisa.
 *
 * Os pins do `pins` (`PinLayer`) ficam acima do terreno e da decoração, fora do desfoque, com 32 px
 * na tela em qualquer zoom. Selecionar um pin (`selectedId`) leva a câmera até ele, no centro da
 * área livre (deslizando em 350 ms, ou na hora com movimento reduzido). Para os testes, o `host`
 * expõe os pins no mapa em `data-pins`, os rótulos à vista em `data-pin-labels`, o selecionado em
 * `data-pin-selected` e a largura de um pin na tela, em px, em `data-pin-size`. Sem o desenho dos
 * pins (sem o contexto 2D), o mapa segue sem eles, e o console avisa.
 *
 * A câmera aparece para a interface no `cameraState` (`cameraStore.ts`): a cada quadro em que muda,
 * o zoom e a parte visível do mundo. Os comandos de zoom, centralizar e centrar num ponto ficam em
 * `controls`: quem guarda o renderer os registra no store (um renderer descartado antes de ficar
 * pronto, como no StrictMode, não pode apagar os do que ficou).
 */
export async function createMapRenderer(
  host: HTMLElement,
  world: WorldStore,
  insets: () => MapInsets = () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
  ui: UiStore = createUiStore(),
  cameraState: CameraStore = createCameraStore(),
  pins: PinsStore = createPinsStore(),
): Promise<MapRenderer> {
  const app = new Application()
  // A decoração é opcional: sem o spritesheet, o mapa aparece só com o terreno.
  const loading = loadDecorTextures().catch((error: unknown) => {
    console.warn('Não foi possível carregar os ícones da decoração; o mapa segue sem eles', error)
    return null
  })
  const loadingPins = loadPinTextures().catch((error: unknown) => {
    console.warn('Não foi possível desenhar os pins; o mapa segue sem eles', error)
    return null
  })
  try {
    await app.init({
      preference: 'webgl',
      resizeTo: host,
      background: CANVAS_BACKGROUND,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    })
  } catch (error) {
    // Sem renderer não há mapa: libera o que já foi carregado e repassa o erro.
    const loaded = await loading
    if (loaded) destroyDecorTextures(loaded)
    const loadedPins = await loadingPins
    if (loadedPins) destroyPinTextures(loadedPins)
    app.destroy()
    throw error
  }
  const textures = await loading
  const pinTextures = await loadingPins
  app.canvas.classList.add('block')
  app.canvas.dataset.testid = 'map-canvas'
  host.appendChild(app.canvas)

  const freeArea = (): Area => {
    const pad = insets()
    return {
      x: pad.left,
      y: pad.top,
      width: Math.max(1, app.screen.width - pad.left - pad.right),
      height: Math.max(1, app.screen.height - pad.top - pad.bottom),
    }
  }

  // Antes da câmera: a função de mudança dela lê o terreno.
  const terrain = new TerrainLayer()
  const decor = textures ? new DecorLayer(textures) : null
  const pinLayer = pinTextures ? new PinLayer(pinTextures) : null
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const camera = new MapCamera(app, host, freeArea, (t, zoom) => {
    if (!terrain.size) return
    const area = freeArea()
    const view = worldView(t, area)
    cameraState.getState().update({ zoom, scale: t.scale, view, origin: { x: area.x, y: area.y } })
    if (decor) {
      decor.frame(view, zoom)
      writeDecorState(host, decor)
    } else {
      if (host.dataset.decorLayer !== 'off') host.dataset.decorLayer = 'off'
      if (host.dataset.decorDrawn !== '0') host.dataset.decorDrawn = '0'
    }
    const rect = mapRect(t)
    const value = [rect.x, rect.y, rect.width, rect.height].map((v) => Math.round(v)).join(',')
    if (host.dataset.mapRect !== value) host.dataset.mapRect = value
    const z = zoom.toFixed(3)
    if (host.dataset.zoom !== z) host.dataset.zoom = z
    if (pinLayer) {
      pinLayer.frame(t.scale, zoom, performance.now(), reducedMotion())
      writePinState(host, pinLayer, pins.getState(), t.scale)
    }
  })
  app.stage.addChild(camera.viewport)
  // Terreno e decoração num grupo: o desfoque da prévia vale só para ele.
  const base = new Container()
  base.addChild(terrain.view)
  if (decor) base.addChild(decor.view)
  camera.viewport.addChild(base)
  // Os pins ficam acima do grupo borrado: nítidos durante a geração.
  if (pinLayer) {
    camera.viewport.addChild(pinLayer.view)
    pinLayer.sync(pins.getState(), performance.now())
  }
  const unsubscribePins = pins.subscribe((state, prev) => {
    pinLayer?.sync(state, performance.now())
    if (state.selectedId !== prev.selectedId && state.selectedId !== null) {
      const pin = state.pins.find((p) => p.id === state.selectedId)
      if (pin) {
        const p = pinToWorld(pin.pos)
        camera.panTo(p.x, p.y)
      }
    }
  })

  // O filtro roda a cada quadro enquanto gera, junto com o worker de geração: 2 passadas por eixo
  // em meia resolução custam o mesmo que o quadro nítido (com `quality: 4` em resolução cheia, o
  // quadro borrado custava 2,4× mais, e sem GPU a geração atrasava). Num desfoque de 3 px, a meia
  // resolução não aparece.
  const blurFilter = new BlurFilter({ strength: MAP_BLUR_PX, quality: 2, resolution: 0.5 })
  const blur = createMapBlur()
  let filtered = false
  const applyBlur = () => {
    blurFilter.strength = blur.value
    // Sem desfoque, sem filtro: não custa uma passada a mais por quadro.
    const on = blur.value > 0
    if (on !== filtered) {
      base.filters = on ? [blurFilter] : []
      filtered = on
    }
    const px = blur.value.toFixed(1)
    if (host.dataset.mapBlur !== px) host.dataset.mapBlur = px
  }
  const onBlurTick = (ticker: Ticker) => {
    if (!blur.step(ticker.lastTime)) app.ticker.remove(onBlurTick)
    applyBlur()
  }
  const updateBlur = (instant = false) => {
    blur.target(isGenerating(world.getState()) ? MAP_BLUR_PX : 0, app.ticker.lastTime, instant || reducedMotion())
    applyBlur()
    app.ticker.remove(onBlurTick)
    app.ticker.add(onBlurTick)
  }
  updateBlur(true)

  const unsubscribeUi = decor ? bindDecorLayer(ui, decor) : () => {}

  const show = () => {
    const { field, terrainRgba } = world.getState()
    if (!field || !terrainRgba) return
    terrain.setField(field, terrainRgba)
    // A prévia 256² e o mapa 1024² ocupam o mesmo quadrado do mundo.
    terrain.view.width = WORLD_SIZE
    terrain.view.height = WORLD_SIZE
    decor?.setDecor(field.decor)
    host.dataset.decorTotal = String(decor?.count ?? 0)
    host.dataset.terrainSize = String(terrain.size)
    camera.showWorld()
  }

  show()
  const unsubscribe = world.subscribe((state, prev) => {
    if (state.field !== prev.field) show()
    if (isGenerating(state) !== isGenerating(prev)) updateBlur()
  })
  const onResize = (w: number, h: number) => camera.resize(w, h)
  app.renderer.on('resize', onResize)

  return {
    refit: () => camera.resize(app.screen.width, app.screen.height),
    controls: {
      zoomIn: () => camera.zoomBy(KEY_ZOOM_STEP),
      zoomOut: () => camera.zoomBy(1 / KEY_ZOOM_STEP),
      center: () => camera.center(),
      centerOn: (x, y) => camera.centerOn(x, y),
    },
    destroy() {
      unsubscribe()
      unsubscribeUi()
      unsubscribePins()
      app.ticker.remove(onBlurTick)
      app.renderer.off('resize', onResize)
      camera.destroy()
      terrain.destroy()
      decor?.destroy()
      pinLayer?.destroy()
      blurFilter.destroy()
      app.destroy({ removeView: true }, { children: true })
      delete host.dataset.terrainSize
      delete host.dataset.mapRect
      delete host.dataset.zoom
      delete host.dataset.mapBlur
      delete host.dataset.decorTotal
      delete host.dataset.decorDrawn
      delete host.dataset.decorLayer
      delete host.dataset.pins
      delete host.dataset.pinLabels
      delete host.dataset.pinSelected
      delete host.dataset.pinDragging
      delete host.dataset.pinsLeaving
      delete host.dataset.pinSize
    },
  }
}

/**
 * Escreve no `host`, para os testes, os pins no mapa, os rótulos à vista, o selecionado, o arrastado,
 * os excluídos que ainda encolhem e a largura de um pin na tela.
 */
function writePinState(host: HTMLElement, layer: PinLayer, state: Pick<PinsState, 'selectedId' | 'dragging'>, scale: number) {
  const set = (key: 'pins' | 'pinLabels' | 'pinSelected' | 'pinDragging' | 'pinsLeaving' | 'pinSize', value: string) => {
    if (host.dataset[key] !== value) host.dataset[key] = value
  }
  set('pins', String(layer.count))
  set('pinLabels', String(layer.labelCount))
  set('pinSelected', state.selectedId ?? '')
  set('pinDragging', state.dragging?.id ?? '')
  set('pinsLeaving', String(layer.leavingCount))
  const size = layer.screenWidth(scale)
  set('pinSize', size === null ? '' : size.toFixed(1))
}
