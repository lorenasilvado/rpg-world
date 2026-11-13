import { Container, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js'
import { DECOR, type Decor } from '../../core/types'
import type { UiStore } from '../../state/uiStore'
import { WORLD_SIZE } from '../camera'
import {
  DECOR_FRAMES,
  DECOR_FRAME_OF,
  DECOR_FRAME_SIZE,
  DECOR_SHEET_URL,
  decorWorldSize,
  type DecorKind,
} from '../style/decor'
import { LOD_LEVELS, cullWindow, lodLevel, markVisible, stale, type DecorIcons, type Rect } from './decorCull'

/** Carrega o spritesheet dos ícones (`src/render/style/decor.png`), com mipmaps. */
export async function loadDecorTextures(): Promise<Record<DecorKind, Texture>> {
  const sheet = new Image()
  sheet.src = DECOR_SHEET_URL
  await sheet.decode()
  // Os quadros de 128 px aparecem bem menores: sem mipmaps, os traços serrilham no zoom baixo.
  const source = new ImageSource({ resource: sheet, autoGenerateMipmaps: true, scaleMode: 'linear' })
  const entries = Object.entries(DECOR_FRAMES).map(([kind, f]) => [
    kind,
    new Texture({ source, frame: new Rectangle(f.x, f.y, DECOR_FRAME_SIZE, DECOR_FRAME_SIZE) }),
  ])
  return Object.fromEntries(entries) as Record<DecorKind, Texture>
}

/**
 * Ícones decorativos do mapa: um sprite por ícone do campo que tem quadro no spritesheet, num grupo
 * de render (mover a câmera só muda a transformação do grupo). A cada quadro, `update` aplica o
 * culling e o nível de detalhe (`decorCull.ts`); os sprites só mudam quando a janela de culling
 * deixa de servir (`stale`) ou o nível muda. `visible` liga e desliga a camada inteira.
 */
export class DecorLayer {
  readonly view = new Container({ isRenderGroup: true })
  private textures: Record<DecorKind, Texture>
  private sprites: Sprite[] = []
  private icons: DecorIcons = { x: new Float32Array(0), y: new Float32Array(0), size: new Float32Array(0), always: new Uint8Array(0) }
  private marks = new Uint8Array(0)
  private window: Rect | null = null
  private level = -1
  /** Ícones desenhados depois do culling e do nível de detalhe. */
  drawn = 0

  constructor(textures: Record<DecorKind, Texture>) {
    this.textures = textures
  }

  /** Ícones com quadro no spritesheet. */
  get count(): number {
    return this.sprites.length
  }

  get visible(): boolean {
    return this.view.visible
  }

  set visible(on: boolean) {
    this.view.visible = on
  }

  /**
   * Troca os ícones pelos do campo, num mundo de `width` × `height` unidades (o mapa é o quadrado
   * de `WORLD_SIZE`; o spike usa outro tamanho). Os sprites são reaproveitados.
   */
  setDecor(decor: Decor, width = WORLD_SIZE, height = width) {
    const scale = width / WORLD_SIZE
    const kept: number[] = []
    for (let i = 0; i < decor.kind.length; i++) if (DECOR_FRAME_OF.has(decor.kind[i] as never)) kept.push(i)
    const n = kept.length
    const icons: DecorIcons = { x: new Float32Array(n), y: new Float32Array(n), size: new Float32Array(n), always: new Uint8Array(n) }

    while (this.sprites.length > n) this.sprites.pop()!.destroy()
    for (let j = 0; j < n; j++) {
      const i = kept[j]
      const core = decor.kind[i] as never
      const frame = DECOR_FRAME_OF.get(core)!
      const size = decorWorldSize(frame) * scale
      icons.x[j] = decor.u[i] * width
      icons.y[j] = decor.v[i] * height
      icons.size[j] = size
      icons.always[j] = core === DECOR.peak || core === DECOR.snowPeak ? 1 : 0

      let sprite = this.sprites[j]
      if (!sprite) {
        sprite = new Sprite()
        sprite.anchor.set(0.5, 1)
        this.sprites.push(sprite)
        this.view.addChild(sprite)
      }
      sprite.texture = this.textures[frame]
      sprite.position.set(icons.x[j], icons.y[j])
      sprite.scale.set(size / DECOR_FRAME_SIZE)
      sprite.visible = true
    }
    this.icons = icons
    this.marks = new Uint8Array(n).fill(1)
    this.drawn = n
    this.window = null
    this.level = -1
  }

  /** Culling pela parte do mundo à vista (`view`) e nível de detalhe pelo zoom relativo. */
  update(view: Rect, zoom: number) {
    const level = lodLevel(zoom)
    if (level === this.level && this.window && !stale(this.window, view)) return
    this.level = level
    this.window = cullWindow(view)
    const before = this.marks
    const after = new Uint8Array(before.length)
    this.drawn = markVisible(this.icons, this.window, LOD_LEVELS[level].keep, after)
    for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) this.sprites[i].visible = after[i] === 1
    this.marks = after
  }

  destroy() {
    this.view.destroy({ children: true })
    this.sprites = []
    const textures = Object.values(this.textures)
    for (const t of textures) t.destroy()
    textures[0]?.source.destroy()
  }
}

/**
 * Liga a camada ao estado da interface: `layers.decor` do `ui` mostra ou esconde os ícones, já ao
 * ligar e a cada mudança. Devolve a função que desfaz a ligação.
 */
export function bindDecorLayer(ui: UiStore, decor: DecorLayer): () => void {
  decor.visible = ui.getState().layers.decor
  return ui.subscribe((state, prev) => {
    if (state.layers !== prev.layers) decor.visible = state.layers.decor
  })
}

/**
 * Escreve no `host`, para os testes, a camada (`data-decor-layer`, `on` ou `off`) e os ícones
 * desenhados (`data-decor-drawn`, 0 com a camada desligada). Roda a cada quadro: no StrictMode, o
 * renderer descartado apaga esses atributos, e o quadro seguinte do outro os escreve de novo.
 */
export function writeDecorState(host: HTMLElement, decor: DecorLayer) {
  const drawn = String(decor.visible ? decor.drawn : 0)
  if (host.dataset.decorDrawn !== drawn) host.dataset.decorDrawn = drawn
  const layer = decor.visible ? 'on' : 'off'
  if (host.dataset.decorLayer !== layer) host.dataset.decorLayer = layer
}
