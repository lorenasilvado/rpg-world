import { Application } from 'pixi.js'
import { createUiStore, type UiStore } from '../state/uiStore'
import type { WorldStore } from '../state/worldStore'
import { MapCamera } from './MapCamera'
import { WORLD_SIZE, mapRect, type Area } from './camera'
import { DecorLayer, bindDecorLayer, loadDecorTextures, writeDecorState } from './layers/DecorLayer'
import { TerrainLayer } from './layers/TerrainLayer'
import { worldView } from './layers/decorCull'
import { CANVAS_BACKGROUND } from './style/palette'

/** Faixas da área do mapa cobertas por painéis, em px CSS: o mapa cabe no que sobra. */
export type MapInsets = { left: number; right: number; top: number; bottom: number }

export type MapRenderer = {
  /** Recalcula a área livre (ex.: os painéis mudaram), mantendo o centro e o zoom. */
  refit(): void
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
 * Expõe no `host`, para os testes: o tamanho do campo desenhado em `data-terrain-size`, o
 * retângulo do mapa na tela em `data-map-rect` (x, y, largura, altura em px CSS, arredondados) e o
 * zoom relativo em `data-zoom` (1 = mapa inteiro na área livre); da decoração, os ícones com quadro
 * no spritesheet em `data-decor-total`, os desenhados depois do culling e do nível de detalhe em
 * `data-decor-drawn` e a camada em `data-decor-layer` (`on` ou `off`). Se o spritesheet não carrega,
 * o mapa segue só com o terreno: a decoração fica `off`, com 0 ícones, e o console avisa.
 */
export async function createMapRenderer(
  host: HTMLElement,
  world: WorldStore,
  insets: () => MapInsets = () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
  ui: UiStore = createUiStore(),
): Promise<MapRenderer> {
  const app = new Application()
  const [textures] = await Promise.all([
    // A decoração é opcional: sem o spritesheet, o mapa aparece só com o terreno.
    loadDecorTextures().catch((error: unknown) => {
      console.warn('Não foi possível carregar os ícones da decoração; o mapa segue sem eles', error)
      return null
    }),
    app.init({
      preference: 'webgl',
      resizeTo: host,
      background: CANVAS_BACKGROUND,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    }),
  ])
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
  const camera = new MapCamera(app, host, freeArea, (t, zoom) => {
    if (!terrain.size) return
    if (decor) {
      decor.frame(worldView(t, freeArea()), zoom)
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
  })
  app.stage.addChild(camera.viewport)
  camera.viewport.addChild(terrain.view)
  if (decor) camera.viewport.addChild(decor.view)

  const unsubscribeUi = decor ? bindDecorLayer(ui, decor) : () => {}

  const show = () => {
    const { field, seed } = world.getState()
    if (!field) return
    terrain.setField(field, seed)
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
  })
  const onResize = (w: number, h: number) => camera.resize(w, h)
  app.renderer.on('resize', onResize)

  return {
    refit: () => camera.resize(app.screen.width, app.screen.height),
    destroy() {
      unsubscribe()
      unsubscribeUi()
      app.renderer.off('resize', onResize)
      camera.destroy()
      terrain.destroy()
      decor?.destroy()
      app.destroy({ removeView: true }, { children: true })
      delete host.dataset.terrainSize
      delete host.dataset.mapRect
      delete host.dataset.zoom
      delete host.dataset.decorTotal
      delete host.dataset.decorDrawn
      delete host.dataset.decorLayer
    },
  }
}
