import { Viewport } from 'pixi-viewport'
import { Application, BufferImageSource, Container, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js'
import { terrainPixels, type DecorPlacement } from '../mockup/drawMockup'
import type { MockTerrain } from '../mockup/terrain'
import { DECOR_FRAMES, DECOR_FRAME_SIZE, DECOR_SHEET_URL, DECOR_SIZE, type DecorKind } from '../render/style/decor'
import { CANVAS_BACKGROUND } from '../render/style/palette'
import { MAX_ZOOM, MIN_ZOOM } from './cameraPath'

/** Pixels de mundo por célula do terreno. */
const WORLD_SCALE = 2

export type Scene = { app: Application; viewport: Viewport; world: { width: number; height: number } }

function decorTextures(sheet: HTMLImageElement): Record<DecorKind, Texture> {
  // Os quadros de 128 px aparecem com 26 a 48 px: sem mipmaps, os traços serrilham no zoom baixo.
  const source = new ImageSource({ resource: sheet, autoGenerateMipmaps: true, scaleMode: 'linear' })
  const entries = Object.entries(DECOR_FRAMES).map(([kind, f]) => [
    kind,
    new Texture({ source, frame: new Rectangle(f.x, f.y, DECOR_FRAME_SIZE, DECOR_FRAME_SIZE) }),
  ])
  return Object.fromEntries(entries) as Record<DecorKind, Texture>
}

/** Cena do spike: uma textura de terreno e os sprites, todos do mesmo spritesheet, sem culling. */
export async function createScene(host: HTMLElement, terrain: MockTerrain, decor: DecorPlacement[]): Promise<Scene> {
  const sheet = new Image()
  sheet.src = DECOR_SHEET_URL
  await sheet.decode()

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

  // Grupo de render: mover a câmera só muda a transformação do grupo, sem recalcular cada sprite.
  const icons = new Container({ isRenderGroup: true })
  const textures = decorTextures(sheet)
  for (const d of decor) {
    const sprite = new Sprite(textures[d.kind])
    sprite.anchor.set(0.5, 1)
    sprite.position.set(d.x * WORLD_SCALE, d.y * WORLD_SCALE)
    sprite.scale.set(DECOR_SIZE[d.kind] / DECOR_FRAME_SIZE)
    icons.addChild(sprite)
  }
  viewport.addChild(icons)

  viewport.fitWorld(true)
  viewport.moveCenter(world.width / 2, world.height / 2)
  return { app, viewport, world }
}
