import { Container, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js'
import { DECOR, type Decor } from '../../core/types'
import type { UiStore } from '../../state/uiStore'
import { WORLD_SIZE } from '../camera'
import {
  DECOR_VARIANTS,
  DECOR_WORLD_SIZE,
  INK_ANCHOR,
  INK_FRAME_PX,
  INK_KINDS,
  INK_SHEET,
  decorVariant,
  drawDecorSheet,
  inkFrame,
  type Ink,
} from '../style/decorInk'
import { LOD_LEVELS, cullWindow, lodLevel, markVisible, stale, type DecorIcons, type Rect } from './decorCull'

/** Texturas dos ícones: para cada tipo do núcleo (`DECOR`), uma por variação. */
export type DecorTextures = ReadonlyMap<number, readonly Texture[]>

/** Canvas do spritesheet: `OffscreenCanvas` onde existe, senão um `<canvas>` fora da página. */
function sheetCanvas(): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(INK_SHEET.width, INK_SHEET.height)
  const canvas = document.createElement('canvas')
  canvas.width = INK_SHEET.width
  canvas.height = INK_SHEET.height
  return canvas
}

/**
 * Desenha o spritesheet dos ícones no estilo Medieval (`style/decorInk.ts`) num canvas e o envia
 * para a GPU, com mipmaps. Sem o contexto 2D do canvas, a promessa é rejeitada.
 */
export async function loadDecorTextures(): Promise<DecorTextures> {
  const canvas = sheetCanvas()
  const ctx = canvas.getContext('2d') as Ink | null
  if (!ctx) throw new Error('sem o contexto 2D para desenhar os ícones')
  drawDecorSheet(ctx)
  // Os quadros aparecem bem menores: sem mipmaps, os traços serrilham no zoom baixo.
  const source = new ImageSource({ resource: canvas, autoGenerateMipmaps: true, scaleMode: 'linear' })
  const textures = new Map<number, Texture[]>()
  for (const kind of INK_KINDS) {
    const variants: Texture[] = []
    for (let v = 0; v < DECOR_VARIANTS; v++) {
      const f = inkFrame(kind, v)
      variants.push(new Texture({ source, frame: new Rectangle(f.x, f.y, INK_FRAME_PX, INK_FRAME_PX) }))
    }
    textures.set(kind, variants)
  }
  return textures
}

/** Destrói as texturas de `loadDecorTextures` e o spritesheet delas. */
export function destroyDecorTextures(textures: DecorTextures) {
  const all = [...textures.values()].flat()
  for (const t of all) t.destroy()
  all[0]?.source.destroy()
}

/**
 * Ícones decorativos do mapa: um sprite por ícone do campo que tem desenho no spritesheet, num grupo
 * de render (mover a câmera só muda a transformação do grupo). A cada quadro, `update` aplica o
 * culling e o nível de detalhe (`decorCull.ts`); os sprites só mudam quando a janela de culling
 * deixa de servir (`stale`) ou o nível muda. `visible` liga e desliga a camada inteira.
 *
 * A camada passa a ser dona das texturas que recebe (as de `loadDecorTextures`): o `destroy` as
 * destrói, junto com o spritesheet delas. Quem cria a camada não deve reaproveitá-las depois.
 */
export class DecorLayer {
  readonly view = new Container({ isRenderGroup: true })
  private textures: DecorTextures
  private sprites: Sprite[] = []
  private icons: DecorIcons = { x: new Float32Array(0), y: new Float32Array(0), size: new Float32Array(0), always: new Uint8Array(0) }
  private marks = new Uint8Array(0)
  private window: Rect | null = null
  private level = -1
  private drawnCount = 0

  constructor(textures: DecorTextures) {
    this.textures = textures
  }

  /** Ícones desenhados depois do culling e do nível de detalhe. */
  get drawn(): number {
    return this.drawnCount
  }

  /** Ícones com desenho no spritesheet. */
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
    for (let i = 0; i < decor.kind.length; i++) if (this.textures.has(decor.kind[i])) kept.push(i)
    const n = kept.length
    const icons: DecorIcons = { x: new Float32Array(n), y: new Float32Array(n), size: new Float32Array(n), always: new Uint8Array(n) }
    const size = DECOR_WORLD_SIZE * scale

    while (this.sprites.length > n) this.sprites.pop()!.destroy()
    for (let j = 0; j < n; j++) {
      const i = kept[j]
      const core = decor.kind[i]
      icons.x[j] = decor.u[i] * width
      icons.y[j] = decor.v[i] * height
      icons.size[j] = size
      icons.always[j] = core === DECOR.peak || core === DECOR.snowPeak ? 1 : 0

      let sprite = this.sprites[j]
      if (!sprite) {
        sprite = new Sprite()
        sprite.anchor.set(INK_ANCHOR.x, INK_ANCHOR.y)
        this.sprites.push(sprite)
        this.view.addChild(sprite)
      }
      sprite.texture = this.textures.get(core)![decorVariant(decor.u[i], decor.v[i])]
      sprite.position.set(icons.x[j], icons.y[j])
      sprite.scale.set(size / INK_FRAME_PX)
      sprite.visible = true
    }
    this.icons = icons
    this.marks = new Uint8Array(n).fill(1)
    this.drawnCount = n
    this.window = null
    this.level = -1
  }

  /**
   * O quadro da câmera: com a camada ligada, aplica `update`; desligada, não recalcula nada. Ao
   * religar, o primeiro quadro confere a janela de culling contra a vista daquele momento, então um
   * pan feito com a camada desligada não deixa ícones errados à vista.
   */
  frame(view: Rect, zoom: number) {
    if (this.visible) this.update(view, zoom)
  }

  /** Culling pela parte do mundo à vista (`view`) e nível de detalhe pelo zoom relativo. */
  update(view: Rect, zoom: number) {
    const level = lodLevel(zoom)
    if (level === this.level && this.window && !stale(this.window, view)) return
    this.level = level
    this.window = cullWindow(view)
    const before = this.marks
    const after = new Uint8Array(before.length)
    this.drawnCount = markVisible(this.icons, this.window, LOD_LEVELS[level].keep, after, INK_ANCHOR.y)
    for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) this.sprites[i].visible = after[i] === 1
    this.marks = after
  }

  /** Destrói os sprites, as texturas recebidas e o spritesheet delas (a camada é a dona). */
  destroy() {
    this.view.destroy({ children: true })
    this.sprites = []
    destroyDecorTextures(this.textures)
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
