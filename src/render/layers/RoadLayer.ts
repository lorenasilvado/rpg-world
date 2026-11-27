import { Graphics } from 'pixi.js'
import type { Pin, Road } from '../../persistence/types'
import { WORLD_SIZE } from '../camera'
import { covers, cullWindow, type Rect } from './decorCull'
import { ROAD_HALO, curveSegments, dashPolyline, roadLine, roadPoints, strokeOrder, type UV, type XY } from './roadMath'

/** O que a camada lê dos pins: as posições, com o pin arrastado na posição do arrasto. */
export type RoadPinsState = { pins: readonly Pin[]; dragging: { id: string; pos: UV } | null }

/** Px na tela entre dois pontos da curva amostrada. */
const SAMPLE_PX = 4

/**
 * Px na tela por unidade local da camada. O Pixi divide cada arco das pontas e junções redondas em
 * `15·θ·√raio/π` segmentos, com o raio em unidades locais: em unidades do mundo, uma ponta de 3,5 px
 * tinha de 15 a 45, conforme o zoom. Com 16 px por unidade, ela tem uns 6, e a corda fica a menos de
 * 0,1 px do arco (AC-F5-16).
 */
export const TESS_PX = 16

/**
 * Durante o zoom, quanto a escala pode se afastar da do último desenho (fator) antes de redesenhar.
 * Até lá, os traços escalam com o mapa (no máximo 12% mais largos ou mais finos); no quadro em que a
 * escala para, a camada redesenha com as larguras exatas (AC-F5-16).
 *
 * "Parou" é a escala igual por um quadro: na roda do mouse, a escala fica parada entre um entalhe e
 * outro, e as estradas à vista são redesenhadas a cada entalhe, no meio do gesto. É de propósito:
 * cada entalhe muda o zoom em uns 19%, mais que a folga, então ele redesenharia de qualquer jeito, e
 * esperar mais quadros só deixaria o traço com a largura errada entre os entalhes. A folga vale para
 * a pinça e o Ctrl+roda do touchpad, que mudam a escala de pouco em pouco a cada quadro.
 */
export const ZOOM_DRIFT = 1.12

/**
 * A camada das estradas no mapa (estradas.md, AC-F5-01): estrada, trilha e rota marítima com os
 * traços do design system (`ROAD_STROKES`), na curva suavizada pelos pontos da estrada, acima do
 * terreno e da decoração (fora do desfoque) e abaixo dos pins. As larguras e os tracejados são em
 * px na tela, em qualquer zoom: a camada redesenha quando a escala para ou se afasta mais de
 * `ZOOM_DRIFT` da do último desenho. Os contornos de todas as
 * estradas vão antes dos traços de cima (`strokeOrder`): nos cruzamentos, nenhum contorno corta outro
 * traço. A ponta ligada a um pin
 * fica na posição dele, e acompanha o arrasto (`sync` com o `dragging` dos pins). A estrada selecionada
 * ganha o halo âmbar (`ROAD_HALO`, AC-F5-06), por baixo dos traços.
 *
 * O desenho é feito em unidades locais de `TESS_PX` px da tela (`view.scale` = `TESS_PX` / escala).
 * Só as estradas que cruzam a janela de culling (a vista com folga, `cullWindow`) são desenhadas: com
 * 300 estradas, redesenhar todas a cada quadro de zoom passava de 30 ms no zoom de perto (AC-F5-16).
 * A camada também redesenha quando a vista sai da janela do último desenho.
 */
export class RoadLayer {
  readonly view = new Graphics()
  private roads: readonly Road[] = []
  private selectedId: string | null = null
  private pins: RoadPinsState = { pins: [], dragging: null }
  private dirty = true
  private drawnScale = 0
  /** A escala do quadro anterior: igual à de agora, o zoom parou. */
  private lastScale = 0
  /** A janela do último desenho; `null`: todas as estradas (sem vista). */
  private window: Rect | null = null
  /** Estradas com traço no último desenho, à vista ou não (as de menos de 2 pontos não têm). */
  count = 0
  /** Estradas desenhadas no último desenho: as que cruzam a janela de culling. */
  drawn = 0

  constructor() {
    this.view.label = 'roads'
  }

  /** Troca as estradas ou os pins (posições e arrasto); o próximo quadro redesenha. */
  sync(roads: readonly Road[], pins: RoadPinsState, selectedId: string | null = null) {
    if (roads === this.roads && selectedId === this.selectedId && pins.pins === this.pins.pins && pins.dragging === this.pins.dragging) return
    this.roads = roads
    this.selectedId = selectedId
    this.pins = { pins: pins.pins, dragging: pins.dragging }
    this.dirty = true
  }

  /** A camada à vista (o interruptor "Estradas" de Camadas). */
  setVisible(on: boolean) {
    this.view.visible = on
  }

  /**
   * Chamada a cada quadro. Redesenha se as estradas ou os pins mudaram, se a parte do mundo à vista
   * (`view`, em unidades do mundo) saiu da janela do último desenho, ou se a escala (px da tela por
   * unidade do mundo) é outra e parou (igual à do quadro anterior) ou se afastou mais de `ZOOM_DRIFT`
   * da do último desenho. Sem `view`, desenha todas.
   */
  frame(scale: number, view?: Rect) {
    const settled = scale === this.lastScale
    this.lastScale = scale
    if (!this.view.visible || scale <= 0) return
    const moved = view !== undefined && (this.window === null || !covers(this.window, view))
    const drift = Math.max(scale / this.drawnScale, this.drawnScale / scale)
    const rescale = scale !== this.drawnScale && (settled || drift > ZOOM_DRIFT)
    if (!this.dirty && !rescale && !moved) return
    this.dirty = false
    this.drawnScale = scale
    const window = view ? cullWindow(view) : null
    this.window = window
    const g = this.view
    g.clear()
    // Unidades locais por unidade do mundo: o traço de `w` px tem `w / TESS_PX` unidades.
    const k = scale / TESS_PX
    g.scale.set(1 / k)
    const byId = new Map(this.pins.pins.map((p) => [p.id, p.pos]))
    const dragging = this.pins.dragging
    const pinPos = (id: string) => (dragging && dragging.id === id ? dragging.pos : byId.get(id))
    // A folga do traço mais largo (o halo), para a estrada logo fora da janela não sumir pela metade.
    const pad = ROAD_HALO.width / scale
    const lines = new Map<Road, XY[]>()
    let count = 0
    for (const road of this.roads) {
      if (road.points.length < 2) continue
      count++
      if (window && !crosses(curveBounds(roadPoints(road, pinPos)), window, pad)) continue
      const line = roadLine(road, pinPos, SAMPLE_PX / scale)
      if (line.length >= 2) lines.set(road, line.map((p) => ({ x: p.x * k, y: p.y * k })))
    }
    // O halo da estrada selecionada (AC-F5-06) fica por baixo de todos os traços.
    const selected = this.roads.find((r) => r.id === this.selectedId)
    const halo = selected && lines.get(selected)
    if (halo) {
      g.moveTo(halo[0].x, halo[0].y)
      for (let i = 1; i < halo.length; i++) g.lineTo(halo[i].x, halo[i].y)
      g.stroke({ width: ROAD_HALO.width / TESS_PX, color: ROAD_HALO.color, alpha: ROAD_HALO.alpha, cap: 'round', join: 'round' })
    }
    for (const { road, stroke } of strokeOrder([...lines.keys()])) {
      const line = lines.get(road)!
      const parts = stroke.dash ? dashPolyline(line, stroke.dash[0] / TESS_PX, stroke.dash[1] / TESS_PX) : [line]
      for (const part of parts) {
        g.moveTo(part[0].x, part[0].y)
        for (let i = 1; i < part.length; i++) g.lineTo(part[i].x, part[i].y)
      }
      if (parts.length > 0) g.stroke({ width: stroke.width / TESS_PX, color: stroke.color, cap: 'round', join: 'round' })
    }
    this.count = count
    this.drawn = lines.size
  }

  destroy() {
    this.view.destroy()
  }
}

/**
 * O retângulo que contém a curva da estrada, em unidades do mundo: o dos pontos e dos pontos de
 * controle das cúbicas (a cúbica fica dentro do polígono de controle).
 */
export function curveBounds(points: readonly UV[]): Rect {
  const xy = points.map((p) => ({ x: p.u * WORLD_SIZE, y: p.v * WORLD_SIZE }))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const add = (p: XY) => {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  xy.forEach(add)
  for (const seg of curveSegments(xy)) {
    add(seg.c1)
    add(seg.c2)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** O retângulo `r`, com `pad` de folga de cada lado, cruza a `window`. */
function crosses(r: Rect, window: Rect, pad: number): boolean {
  return (
    r.x - pad <= window.x + window.width &&
    r.x + r.width + pad >= window.x &&
    r.y - pad <= window.y + window.height &&
    r.y + r.height + pad >= window.y
  )
}
