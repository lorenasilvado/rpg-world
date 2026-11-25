import { BlurFilter, Container, Graphics, GraphicsContext, ImageSource, Rectangle, Sprite, Text, Texture } from 'pixi.js'
import type { Pin } from '../../persistence/types'
import { pinImageId, type PinImages } from '../../state/pinImages'
import { PIN_TYPES, pinType, type PinType } from '../../state/pinTypes'
import type { PinsState } from '../../state/pinsStore'
import { PIN_SIZE_PX, PIN_VIEWBOX, drawPin, type PinInk } from '../style/pinShapes'
import {
  PIN_DRAG_ALPHA,
  PIN_DRAG_LIFT_PX,
  PIN_DRAG_SHADOW,
  PIN_HEIGHT_PX,
  PIN_HOVER_SCALE,
  PIN_SHRINK_MS,
  dropFrame,
  drawOrder,
  pinToWorld,
  pulseFrame,
  shrinkFrame,
  showLabel,
} from './pinMath'
import { GROUP_HALO_PX, GROUP_LIFT_PX, GROUP_SIZE_PX, createPinGrouper, type PinGroup, type PinTypeLayers } from './pinGroups'

/** Texturas dos pins, uma por tipo. */
export type PinTextures = ReadonlyMap<PinType, Texture>

/** Quantas vezes o desenho do pin é maior que na tela: nítido em telas de alta densidade e no hover. */
const TEXTURE_SCALE = 4
/** Folga entre os quadros do spritesheet (os mipmaps não misturam um pin com o vizinho). */
const GAP = 8

/** Cor do anel de seleção (design-system.md → Pins → Selecionado). */
const RING = 0xc8892b

/** Cor da marca tracejada no chão do pin arrastado (`--ink` do tema claro). */
const MARK = 0x2b2420

/** Cor do fundo do grupo (`#F7F1E3`) e do contorno e do contador (`#2B2420`), no design system. */
const GROUP_FILL = 0xf7f1e3
const GROUP_INK = 0x2b2420

/**
 * O desenho do grupo, igual para todos (um só para a camada): a sombra (`0 3px 8px` com `--ink` a
 * 35%, em anéis que somem para fora), o halo âmbar de 3 px a 60% e o círculo de 38 px com a borda de
 * 2 px.
 */
function groupContext(): GraphicsContext {
  const r = GROUP_SIZE_PX / 2
  const c = new GraphicsContext()
  for (let k = 4; k >= 1; k--) c.circle(0, 3, r + k * 2).fill({ color: GROUP_INK, alpha: 0.35 / 5 })
  c.circle(0, 0, r + GROUP_HALO_PX).fill({ color: RING, alpha: 0.6 })
  c.circle(0, 0, r - 1).fill(GROUP_FILL).stroke({ width: 2, color: GROUP_INK })
  return c
}

type GroupView = { root: Container; count: Text; n: number }

/** A elipse 40 × 16 do chão, tracejada (o Pixi não tem traço tracejado): 16 traços e 16 vãos. */
function dashedEllipse(): Graphics {
  const g = new Graphics()
  const dashes = 16
  const step = (Math.PI * 2) / (dashes * 2)
  for (let i = 0; i < dashes; i++) {
    const a0 = i * 2 * step
    g.moveTo(20 * Math.cos(a0), 8 * Math.sin(a0))
    for (let k = 1; k <= 4; k++) {
      const a = a0 + (step * k) / 4
      g.lineTo(20 * Math.cos(a), 8 * Math.sin(a))
    }
  }
  return g.stroke({ width: 1.5, color: MARK, alpha: 0.7 })
}

/**
 * Desenha os 7 pins (`style/pinShapes.ts`) num canvas, lado a lado, e os envia para a GPU, com
 * mipmaps. Sem o contexto 2D do canvas, a promessa é rejeitada.
 */
export async function loadPinTextures(): Promise<PinTextures> {
  const w = PIN_SIZE_PX * TEXTURE_SCALE
  const h = Math.ceil(PIN_HEIGHT_PX * TEXTURE_SCALE)
  const width = PIN_TYPES.length * (w + GAP)
  const height = h + GAP
  const { canvas, ctx } = pinCanvas(width, height)
  PIN_TYPES.forEach((t, i) => {
    ctx.save()
    ctx.translate(i * (w + GAP), 0)
    drawPin(ctx, t.id, w)
    ctx.restore()
  })
  const source = new ImageSource({ resource: canvas, autoGenerateMipmaps: true, scaleMode: 'linear' })
  const textures = new Map<PinType, Texture>()
  PIN_TYPES.forEach((t, i) => {
    textures.set(t.id, new Texture({ source, frame: new Rectangle(i * (w + GAP), 0, w, h) }))
  })
  return textures
}

function pinCanvas(width: number, height: number): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: PinInk } {
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d') as unknown as PinInk | null
  if (!ctx) throw new Error('sem o contexto 2D para desenhar os pins')
  return { canvas, ctx }
}

/** A textura do Personalizado com a imagem enviada no círculo (uma por imagem). */
async function imagePinTexture(blob: Blob): Promise<Texture> {
  const bitmap = await createImageBitmap(blob)
  try {
    const w = PIN_SIZE_PX * TEXTURE_SCALE
    const h = Math.ceil(PIN_HEIGHT_PX * TEXTURE_SCALE)
    const { canvas, ctx } = pinCanvas(w, h)
    drawPin(ctx, 'custom', w, undefined, { source: bitmap, width: bitmap.width, height: bitmap.height })
    return new Texture({ source: new ImageSource({ resource: canvas, autoGenerateMipmaps: true, scaleMode: 'linear' }) })
  } finally {
    bitmap.close()
  }
}

/** Destrói as texturas de `loadPinTextures` e o spritesheet delas. */
export function destroyPinTextures(textures: PinTextures) {
  const all = [...textures.values()]
  for (const t of all) t.destroy()
  all[0]?.source.destroy()
}

type PinView = {
  root: Container
  pulse: Graphics
  ring: Graphics
  /** A marca tracejada no chão, só no arrasto. */
  mark: Graphics
  body: Container
  /** A sombra do desenho, só no arrasto. */
  shadow: Sprite
  sprite: Sprite
  label: Text | null
  name: string
  /** A textura à vista: o tipo, ou `image:<id>` para o Personalizado com a imagem enviada. */
  texture: string
  /** Quando o pin novo apareceu (`null`: sem quique). */
  bornAt: number | null
}

/** Todos os tipos à vista. */
const ALL_TYPES: PinTypeLayers = Object.fromEntries(PIN_TYPES.map((t) => [t.id, true])) as Record<PinType, boolean>

/** O que a camada lê do `pinsStore`. */
export type PinLayerState = Pick<PinsState, 'pins' | 'selectedId' | 'hoveredId' | 'newPinId' | 'dragging'>

/**
 * Os pins no mapa (pins.md, AC-F3-01 a AC-F3-03): um grupo por pin, na posição (u, v) do mundo, com
 * a escala desfeita a cada quadro (`frame`), para o pin ter sempre 32 px na tela, com a âncora na
 * base central. Cada grupo tem, de baixo para cima, a pulsação e o anel de seleção (elipse 40 × 16
 * âmbar, no chão), o desenho do tipo e o rótulo com o nome (Cinzel 700 13/16, contorno claro de
 * 2 px), que aparece a partir do zoom 1,5×, no hover e na seleção. O pin sob o mouse e o selecionado
 * ficam 1,1× maiores e por cima dos outros.
 *
 * O pin recém-criado (`newPinId`, na primeira vez em que aparece) quica em 460 ms; com movimento
 * reduzido, não há quique nem pulsação. A camada fica fora do desfoque da geração.
 *
 * O pin arrastado (`dragging`, AC-F3-04) fica na posição do arrasto, por cima de todos, com
 * opacidade .6, 14 px acima do chão, a sombra do desenho 12 px abaixo dele (o `drop-shadow` do design
 * system, com o desfoque de 8 px) e a marca tracejada no chão. O pin que sai da lista (excluído,
 * AC-F3-05) encolhe em 180 ms antes de sumir (com movimento reduzido, some na hora); se ele volta
 * nesse meio-tempo (Desfazer), o encolher para.
 *
 * O Personalizado com a imagem enviada (`images`, AC-F3-11) ganha uma textura própria, com a imagem
 * no círculo; enquanto ela não chega (o blob ainda vem do banco), o pin mostra o círculo hachurado.
 * Quem guarda a camada chama `imagesChanged` quando chega uma imagem nova. Uma imagem que não deu
 * para desenhar fica com o círculo hachurado, e a camada não tenta de novo. A textura de uma imagem
 * que nenhum pin usa mais (trocada, removida) é destruída; se o desfazer a traz de volta, ela é
 * desenhada de novo a partir do blob.
 *
 * Os tipos desligados em Camadas (`setLayers`, AC-F3-15) não aparecem, menos o pin selecionado. Com
 * o zoom abaixo de 0,8×, os pins à vista a menos de 34 px uns dos outros na tela viram grupos
 * (`pinGroups.ts`, AC-F3-14): somem, e no ponto médio deles aparece o círculo do grupo (38 px,
 * `#F7F1E3`, borda de 2 px, halo âmbar) com o contador (Nunito 800 15), abaixo dos pins soltos. O
 * selecionado e o arrastado nunca entram num grupo.
 *
 * A camada passa a ser dona das texturas que recebe (as de `loadPinTextures`) e das que cria para as
 * imagens: o `destroy` as destrói.
 */
export class PinLayer {
  readonly view = new Container()
  /** Os pins soltos, acima dos grupos. */
  private pinsView = new Container()
  private groupsView = new Container()
  private groupLook: GraphicsContext | null = null
  private groupViews: GroupView[] = []
  private grouper = createPinGrouper<Pin>()
  private layers: PinTypeLayers = ALL_TYPES
  private groupList: readonly PinGroup[] = []
  private shown = 0
  private textures: PinTextures
  private views = new Map<string, PinView>()
  /**
   * O desfoque da sombra do arrasto, um só para a camada (só o pin arrastado mostra a sombra). O
   * desvio padrão é metade do raio do CSS.
   */
  private shadowBlur = new BlurFilter({ strength: PIN_DRAG_SHADOW.blur / 2, quality: 2 })
  private state: PinLayerState = { pins: [], selectedId: null, hoveredId: null, newPinId: null, dragging: null }
  /** Pins que saíram da lista e estão encolhendo, com o instante da saída. */
  private leaving = new Map<string, { view: PinView; at: number }>()
  /** Pins que já estavam no mapa: só um pin novo de verdade quica. */
  private seen = new Set<string>()
  private selectedAt = 0
  private labels = 0
  private images: PinImages | null
  /** As texturas das imagens enviadas, pelo id da imagem. */
  private imageTextures = new Map<string, Texture>()
  /** As imagens cuja textura está sendo desenhada. */
  private drawing = new Set<string>()
  /**
   * As imagens que não deu para desenhar: o pin fica com o círculo hachurado, sem tentar de novo a
   * cada mudança (hover, seleção, arrasto), nem repetir o aviso.
   */
  private failed = new Set<string>()
  private destroyed = false

  constructor(textures: PinTextures, images: PinImages | null = null) {
    this.textures = textures
    this.images = images
    this.view.addChild(this.groupsView, this.pinsView)
  }

  /** Os tipos de pin ligados em Camadas (`layers` do `uiStore`). */
  setLayers(layers: PinTypeLayers) {
    this.layers = layers
  }

  /** Os grupos do último quadro, com os pins e o ponto médio no mundo. */
  get groups(): readonly PinGroup[] {
    return this.groupList
  }

  /** Quantos pins soltos estavam à vista no último quadro (fora dos grupos e dos tipos escondidos). */
  get shownCount() {
    return this.shown
  }

  /** Chegou uma imagem enviada (`PinImages`): os pins que a usam ganham a textura dela. */
  imagesChanged() {
    for (const pin of this.state.pins) {
      const id = pinImageId(pin)
      if (id) this.requestImage(id)
    }
  }

  /** Quantos pins estão no mapa (sem os que encolhem ao sair). */
  get count() {
    return this.views.size
  }

  /** Quantos pins excluídos ainda estão encolhendo. */
  get leavingCount() {
    return this.leaving.size
  }

  /** Quantos rótulos estavam à vista no último quadro. */
  get labelCount() {
    return this.labels
  }

  /**
   * Largura na tela, em px CSS, de um pin parado (sem hover nem seleção), com a câmera em `scale`;
   * `null` sem pins.
   */
  screenWidth(scale: number): number | null {
    const v = this.views.values().next().value
    return v ? v.sprite.width * v.root.scale.x * scale : null
  }

  /** Acompanha os pins e a seleção do `pinsStore`. */
  sync(state: PinLayerState, now: number) {
    const prev = this.state
    this.state = state
    if (state.selectedId !== prev.selectedId) this.selectedAt = now
    const dragChanged = state.dragging !== prev.dragging
    if (state.pins !== prev.pins || dragChanged) {
      const ids = new Set(state.pins.map((p) => p.id))
      for (const [id, v] of this.views) {
        if (ids.has(id)) continue
        this.views.delete(id)
        this.leaving.set(id, { view: v, at: now })
      }
      for (const pin of state.pins) this.place(pin, state.newPinId === pin.id && !this.seen.has(pin.id) ? now : null)
      this.releaseUnusedImages()
      // No primeiro `sync`, os pins do mundo reaberto já estavam lá: nenhum quica.
      for (const pin of state.pins) this.seen.add(pin.id)
    }
    if (state.pins !== prev.pins || dragChanged || state.selectedId !== prev.selectedId || state.hoveredId !== prev.hoveredId) {
      this.pinsView.removeChildren()
      for (const { view } of this.leaving.values()) this.pinsView.addChild(view.root)
      for (const pin of drawOrder(state.pins, state.selectedId, state.hoveredId, state.dragging?.id ?? null)) {
        const v = this.views.get(pin.id)
        if (v) this.pinsView.addChild(v.root)
      }
    }
  }

  /**
   * A cada quadro: desfaz a escala da câmera (`scale`, px por unidade do mundo), mostra os rótulos
   * pelo `zoom` relativo e anima o quique e a pulsação.
   */
  frame(scale: number, zoom: number, now: number, reducedMotion: boolean) {
    const { selectedId, hoveredId, dragging } = this.state
    for (const [id, { view, at }] of this.leaving) {
      if (reducedMotion || now - at >= PIN_SHRINK_MS) {
        view.root.destroy({ children: true })
        this.leaving.delete(id)
        continue
      }
      const k = shrinkFrame(now - at)
      view.root.scale.set(k.scale / scale)
      view.root.alpha = k.alpha
    }
    const grouping = this.grouper(this.state.pins, this.layers, scale, zoom, selectedId, dragging?.id ?? null)
    const visible = new Set(grouping.shown.map((p) => p.id))
    for (const id of grouping.grouped) visible.delete(id)
    this.drawGroups(grouping.groups, scale)
    this.shown = visible.size
    let labels = 0
    for (const [id, v] of this.views) {
      v.root.visible = visible.has(id)
      if (!v.root.visible) continue
      v.root.scale.set(1 / scale)
      v.root.alpha = 1
      const dragged = dragging?.id === id
      const selected = id === selectedId
      const hovered = id === hoveredId
      const big = selected || hovered ? PIN_HOVER_SCALE : 1
      let drop = { dy: 0, sx: 1, sy: 1, alpha: 1 }
      if (v.bornAt !== null) {
        if (reducedMotion) v.bornAt = null
        else {
          drop = dropFrame(now - v.bornAt)
          if (now - v.bornAt >= 460) v.bornAt = null
        }
      }
      v.body.position.set(0, drop.dy - (dragged ? PIN_DRAG_LIFT_PX : 0))
      v.body.scale.set(drop.sx * big, drop.sy * big)
      v.body.alpha = drop.alpha * (dragged ? PIN_DRAG_ALPHA : 1)
      v.mark.visible = dragged
      v.shadow.visible = dragged
      v.ring.visible = selected
      v.pulse.visible = selected && !reducedMotion
      if (v.pulse.visible) {
        const p = pulseFrame(now - this.selectedAt)
        v.pulse.scale.set(p.scale)
        v.pulse.alpha = p.alpha
      }
      const label = showLabel(zoom, hovered, selected) && !dragged
      if (label && !v.label) {
        v.label = makeLabel(v.name)
        v.root.addChild(v.label)
      }
      if (v.label) v.label.visible = label
      if (label) labels++
    }
    this.labels = labels
  }

  /** Põe os círculos dos grupos (reaproveitados de um quadro para o outro) no ponto médio de cada um. */
  private drawGroups(groups: readonly PinGroup[], scale: number) {
    this.groupList = groups
    if (groups.length && !this.groupLook) this.groupLook = groupContext()
    while (this.groupViews.length < groups.length) {
      const root = new Container()
      const body = new Container()
      body.position.set(0, -GROUP_LIFT_PX)
      const count = new Text({
        text: '',
        style: { fontFamily: 'Nunito, system-ui, sans-serif', fontWeight: '800', fontSize: 15, fill: '#2B2420' },
      })
      count.anchor.set(0.5)
      // O texto nítido no zoom do grupo e em telas de alta densidade.
      count.resolution = Math.max(2, globalThis.devicePixelRatio || 1)
      body.addChild(new Graphics(this.groupLook ?? undefined), count)
      root.addChild(body)
      this.groupsView.addChild(root)
      this.groupViews.push({ root, count, n: 0 })
    }
    this.groupViews.forEach((g, i) => {
      const group = groups[i]
      g.root.visible = group !== undefined
      if (!group) return
      g.root.position.set(group.x, group.y)
      g.root.scale.set(1 / scale)
      if (g.n !== group.ids.length) {
        g.n = group.ids.length
        g.count.text = String(g.n)
      }
    })
  }

  destroy() {
    this.view.destroy({ children: true })
    this.groupLook?.destroy()
    this.shadowBlur.destroy()
    this.views.clear()
    this.leaving.clear()
    destroyPinTextures(this.textures)
    for (const t of this.imageTextures.values()) t.destroy(true)
    this.imageTextures.clear()
    this.destroyed = true
  }

  /** Quantas texturas de imagens enviadas estão na GPU. */
  get imageTextureCount() {
    return this.imageTextures.size
  }

  /**
   * Destrói as texturas das imagens que nenhum pin usa (um pin que encolhe ao sair ainda pode
   * usar a sua: ela fica até ele sumir).
   */
  private releaseUnusedImages() {
    if (this.imageTextures.size === 0) return
    const inUse = new Set<string>()
    for (const v of [...this.views.values(), ...[...this.leaving.values()].map((l) => l.view)]) {
      if (v.texture.startsWith('image:')) inUse.add(v.texture.slice('image:'.length))
    }
    for (const [id, texture] of this.imageTextures) {
      if (inUse.has(id)) continue
      this.imageTextures.delete(id)
      texture.destroy(true)
    }
  }

  /** Desenha a textura da imagem `id`, se o blob já chegou, e a põe nos pins que a usam. */
  private requestImage(id: string) {
    if (this.imageTextures.has(id) || this.drawing.has(id) || this.failed.has(id)) return
    const blob = this.images?.blob(id)
    if (!blob || typeof createImageBitmap !== 'function') return
    this.drawing.add(id)
    imagePinTexture(blob).then(
      (texture) => {
        this.drawing.delete(id)
        if (this.destroyed) {
          texture.destroy(true)
          return
        }
        this.imageTextures.set(id, texture)
        for (const pin of this.state.pins) if (pinImageId(pin) === id) this.place(pin, null)
      },
      (error: unknown) => {
        this.drawing.delete(id)
        this.failed.add(id)
        console.warn('Não foi possível desenhar a imagem do pin; ele fica com o círculo hachurado', error)
      },
    )
  }

  /** A textura do pin: a da imagem enviada, se já existe, ou a do tipo. */
  private textureOf(pin: Pin): { key: string; texture: Texture } {
    const type = pinType(pin.type)
    const id = pinImageId(pin)
    if (id) {
      const texture = this.imageTextures.get(id)
      if (texture) return { key: `image:${id}`, texture }
      this.requestImage(id)
    }
    return { key: type, texture: this.textures.get(type) ?? Texture.EMPTY }
  }

  private place(pin: Pin, bornAt: number | null) {
    const look = this.textureOf(pin)
    let v = this.views.get(pin.id)
    // Voltou enquanto encolhia (Desfazer logo depois de excluir): o mesmo desenho, sem encolher.
    const back = this.leaving.get(pin.id)
    if (!v && back) {
      this.leaving.delete(pin.id)
      v = back.view
      this.views.set(pin.id, v)
    }
    if (!v) {
      const root = new Container()
      const pulse = new Graphics().ellipse(0, 0, 20, 8).stroke({ width: 2, color: RING })
      const ring = new Graphics().ellipse(0, 0, 20, 8).fill({ color: RING, alpha: 0.3 }).stroke({ width: 2.5, color: RING })
      const mark = dashedEllipse()
      mark.visible = false
      const body = new Container()
      const sprite = new Sprite(look.texture)
      sprite.anchor.set(0.5, 1)
      sprite.width = PIN_SIZE_PX
      sprite.height = (PIN_SIZE_PX * PIN_VIEWBOX.height) / PIN_VIEWBOX.width
      const shadow = new Sprite(look.texture)
      shadow.anchor.set(0.5, 1)
      shadow.width = sprite.width
      shadow.height = sprite.height
      shadow.position.set(0, PIN_DRAG_SHADOW.dy)
      shadow.tint = PIN_DRAG_SHADOW.color
      shadow.alpha = PIN_DRAG_SHADOW.alpha
      shadow.filters = [this.shadowBlur]
      shadow.visible = false
      body.addChild(shadow, sprite)
      root.addChild(mark, pulse, ring, body)
      v = { root, pulse, ring, mark, body, shadow, sprite, label: null, name: pin.name, texture: look.key, bornAt }
      this.views.set(pin.id, v)
    }
    const drag = this.state.dragging
    const p = pinToWorld(drag?.id === pin.id ? drag.pos : pin.pos)
    v.root.position.set(p.x, p.y)
    if (v.texture !== look.key) {
      v.texture = look.key
      v.sprite.texture = look.texture
      v.shadow.texture = look.texture
    }
    if (v.name !== pin.name) {
      v.name = pin.name
      if (v.label) v.label.text = pin.name
    }
  }
}

/** O rótulo do pin: o nome em Cinzel 700 13/16, `#2B2420`, com contorno claro de 2 px, 5 px abaixo da âncora. */
function makeLabel(name: string): Text {
  const label = new Text({
    text: name,
    style: {
      fontFamily: 'Cinzel, serif',
      fontWeight: '700',
      fontSize: 13,
      lineHeight: 16,
      fill: '#2B2420',
      stroke: { color: '#F7F1E3', width: 4, join: 'round' },
    },
  })
  label.anchor.set(0.5, 0)
  label.position.set(0, 5)
  return label
}
