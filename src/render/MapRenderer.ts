import { Application } from 'pixi.js'
import type { WorldStore } from '../state/worldStore'
import { TerrainLayer } from './layers/TerrainLayer'
import { CANVAS_BACKGROUND } from './style/palette'

/** Faixas da área do mapa cobertas por painéis, em px CSS: o mapa cabe no que sobra. */
export type MapInsets = { left: number; right: number; top: number; bottom: number }

export type MapRenderer = {
  /** Recalcula o enquadramento (ex.: os painéis mudaram). */
  refit(): void
  destroy(): void
}

/**
 * Renderer do mapa (PixiJS): cria o app no `host`, desenha o terreno e só lê o estado. Quando chega
 * um campo novo no `worldStore`, a textura do terreno é trocada. Fora do mapa fica o fundo do
 * canvas (`#1F4E79`). Sem câmera ainda: o mapa inteiro cabe na área livre, centrado.
 *
 * Expõe no `host` o tamanho do campo desenhado em `data-terrain-size` e o retângulo do mapa na tela
 * em `data-map-rect` (x, y, largura, altura em px CSS), para os testes.
 */
export async function createMapRenderer(
  host: HTMLElement,
  world: WorldStore,
  insets: () => MapInsets = () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
): Promise<MapRenderer> {
  const app = new Application()
  await app.init({
    preference: 'webgl',
    resizeTo: host,
    background: CANVAS_BACKGROUND,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: false,
  })
  app.canvas.classList.add('block')
  app.canvas.dataset.testid = 'map-canvas'
  host.appendChild(app.canvas)

  const terrain = new TerrainLayer()
  app.stage.addChild(terrain.view)

  const fit = () => {
    if (!terrain.size) return
    const pad = insets()
    const w = Math.max(1, app.screen.width - pad.left - pad.right)
    const h = Math.max(1, app.screen.height - pad.top - pad.bottom)
    const side = Math.min(w, h)
    const x = pad.left + (w - side) / 2
    const y = pad.top + (h - side) / 2
    terrain.view.position.set(x, y)
    terrain.view.width = side
    terrain.view.height = side
    host.dataset.mapRect = [x, y, side, side].map((v) => Math.round(v)).join(',')
  }

  const show = () => {
    const { field, seed } = world.getState()
    if (!field) return
    terrain.setField(field, seed)
    host.dataset.terrainSize = String(terrain.size)
    fit()
  }

  show()
  const unsubscribe = world.subscribe((state, prev) => {
    if (state.field !== prev.field) show()
  })
  app.renderer.on('resize', fit)

  return {
    refit: fit,
    destroy() {
      unsubscribe()
      app.renderer.off('resize', fit)
      terrain.destroy()
      app.destroy({ removeView: true }, { children: true })
      delete host.dataset.terrainSize
      delete host.dataset.mapRect
    },
  }
}
