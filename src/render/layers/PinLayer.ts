import { Container, Graphics, ImageSource, Rectangle, Sprite, Text, Texture } from 'pixi.js'
import type { Pin } from '../../persistence/types'
import { PIN_TYPES, pinType, type PinType } from '../../state/pinTypes'
import type { PinsState } from '../../state/pinsStore'
import { PIN_SIZE_PX, PIN_VIEWBOX, drawPin, type PinInk } from '../style/pinShapes'
import {
  PIN_DRAG_ALPHA,
  PIN_DRAG_LIFT_PX,
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
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d') as unknown as PinInk | null
  if (!ctx) throw new Error('sem o contexto 2D para desenhar os pins')
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
  sprite: Sprite
  label: Text | null
  name: string
  type: PinType
  /** Quando o pin novo apareceu (`null`: sem quique). */
  bornAt: number | null
}

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
 * opacidade .6, 14 px acima do chão e a marca tracejada no chão. O pin que sai da lista (excluído,
 * AC-F3-05) encolhe em 180 ms antes de sumir (com movimento reduzido, some na hora); se ele volta
 * nesse meio-tempo (Desfazer), o encolher para.
 *
 * A camada passa a ser dona das texturas que recebe (as de `loadPinTextures`): o `destroy` as
 * destrói.
 */
export class PinLayer {
  readonly view = new Container()
  private textures: PinTextures
  private views = new Map<string, PinView>()
  private state: PinLayerState = { pins: [], selectedId: null, hoveredId: null, newPinId: null, dragging: null }
  /** Pins que saíram da lista e estão encolhendo, com o instante da saída. */
  private leaving = new Map<string, { view: PinView; at: number }>()
  /** Pins que já estavam no mapa: só um pin novo de verdade quica. */
  private seen = new Set<string>()
  private selectedAt = 0
  private labels = 0

  constructor(textures: PinTextures) {
    this.textures = textures
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
      // No primeiro `sync`, os pins do mundo reaberto já estavam lá: nenhum quica.
      for (const pin of state.pins) this.seen.add(pin.id)
    }
    if (state.pins !== prev.pins || dragChanged || state.selectedId !== prev.selectedId || state.hoveredId !== prev.hoveredId) {
      this.view.removeChildren()
      for (const { view } of this.leaving.values()) this.view.addChild(view.root)
      for (const pin of drawOrder(state.pins, state.selectedId, state.hoveredId, state.dragging?.id ?? null)) {
        const v = this.views.get(pin.id)
        if (v) this.view.addChild(v.root)
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
    let labels = 0
    for (const [id, v] of this.views) {
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

  destroy() {
    this.view.destroy({ children: true })
    this.views.clear()
    this.leaving.clear()
    destroyPinTextures(this.textures)
  }

  private place(pin: Pin, bornAt: number | null) {
    const type = pinType(pin.type)
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
      const sprite = new Sprite(this.textures.get(type))
      sprite.anchor.set(0.5, 1)
      sprite.width = PIN_SIZE_PX
      sprite.height = (PIN_SIZE_PX * PIN_VIEWBOX.height) / PIN_VIEWBOX.width
      body.addChild(sprite)
      root.addChild(mark, pulse, ring, body)
      v = { root, pulse, ring, mark, body, sprite, label: null, name: pin.name, type, bornAt }
      this.views.set(pin.id, v)
    }
    const drag = this.state.dragging
    const p = pinToWorld(drag?.id === pin.id ? drag.pos : pin.pos)
    v.root.position.set(p.x, p.y)
    if (v.type !== type) {
      v.type = type
      v.sprite.texture = this.textures.get(type) ?? Texture.EMPTY
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
