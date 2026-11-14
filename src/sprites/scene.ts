import { Viewport } from 'pixi-viewport'
import { Application, BufferImageSource, Sprite, Texture } from 'pixi.js'
import type { Decor } from '../core/types'
import { terrainPixels, type DecorPlacement } from '../mockup/drawMockup'
import type { MockTerrain } from '../mockup/terrain'
import { DecorLayer, loadDecorTextures } from '../render/layers/DecorLayer'
import { worldView } from '../render/layers/decorCull'
import { DECOR_FRAME_OF, type DecorKind } from '../render/style/decor'
import { CANVAS_BACKGROUND } from '../render/style/palette'
import { MAX_ZOOM, MIN_ZOOM } from './cameraPath'

/** Pixels de mundo por célula do terreno. */
const WORLD_SCALE = 2

export type Scene = {
  app: Application
  viewport: Viewport
  world: { width: number; height: number }
  /** Ícones desenhados depois do culling e do nível de detalhe, no último quadro. */
  drawn(): number
  /** Zoom relativo do último quadro (1× = o terreno inteiro na tela), o que o nível de detalhe usa. */
  zoom(): number
}

/** Tipo do núcleo de cada quadro do spritesheet (o inverso de `DECOR_FRAME_OF`). */
const CORE_KIND = new Map([...DECOR_FRAME_OF].map(([core, frame]) => [frame, core]))

/** Os ícones do spike no formato do núcleo (de 0 a 1 no terreno), para a `DecorLayer`. */
export function toDecor(placements: readonly DecorPlacement[], terrain: { width: number; height: number }): Decor {
  const n = placements.length
  const decor: Decor = { u: new Float32Array(n), v: new Float32Array(n), kind: new Uint8Array(n) }
  placements.forEach((d, i) => {
    decor.u[i] = d.x / terrain.width
    decor.v[i] = d.y / terrain.height
    decor.kind[i] = CORE_KIND.get(d.kind as DecorKind)!
  })
  return decor
}

/**
 * Cena da medição: uma textura de terreno e os ícones na camada de decoração do editor
 * (`DecorLayer`), com o culling e o nível de detalhe dela (#48). O zoom relativo do nível de
 * detalhe é o do editor: 1× é o terreno inteiro na tela.
 */
export async function createScene(host: HTMLElement, terrain: MockTerrain, decor: DecorPlacement[]): Promise<Scene> {
  const textures = await loadDecorTextures()

  const app = new Application()
  await app.init({
    preference: 'webgl',
    resizeTo: window,
    background: CANVAS_BACKGROUND,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })
  app.canvas.classList.add('block')
  host.appendChild(app.canvas)

  const world = { width: terrain.width * WORLD_SCALE, height: terrain.height * WORLD_SCALE }
  const viewport = new Viewport({
    screenWidth: app.screen.width,
    screenHeight: app.screen.height,
    worldWidth: world.width,
    worldHeight: world.height,
    events: app.renderer.events,
    ticker: app.ticker,
    passiveWheel: false,
  })
  viewport
    .drag()
    .pinch()
    // O navegador entrega a pinça do touchpad como wheel com ctrlKey.
    .wheel({ trackpadPinch: true, trackpadPinchSpeed: 2.5 })
    .decelerate()
    .clampZoom({ minScale: MIN_ZOOM, maxScale: MAX_ZOOM })
    .clamp({ direction: 'all', underflow: 'center' })
  app.stage.addChild(viewport)
  app.renderer.on('resize', (w: number, h: number) => viewport.resize(w, h))

  const terrainTexture = new Texture({
    source: new BufferImageSource({
      resource: terrainPixels(terrain),
      width: terrain.width,
      height: terrain.height,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
    }),
  })
  const ground = new Sprite(terrainTexture)
  ground.scale.set(WORLD_SCALE)
  viewport.addChild(ground)

  const icons = new DecorLayer(textures)
  icons.setDecor(toDecor(decor, terrain), world.width, world.height)
  viewport.addChild(icons.view)
  let zoom = 1
  viewport.on('frame-end', () => {
    const scale = viewport.scale.x
    const fit = Math.min(app.screen.width / world.width, app.screen.height / world.height)
    zoom = scale / fit
    icons.update(worldView({ x: viewport.x, y: viewport.y, scale }, app.screen), zoom)
  })

  viewport.fitWorld(true)
  viewport.moveCenter(world.width / 2, world.height / 2)
  return { app, viewport, world, drawn: () => icons.drawn, zoom: () => zoom }
}
