import { Graphics } from 'pixi.js'
import type { Pin, Road } from '../../persistence/types'
import { ROAD_HALO, dashPolyline, roadLine, strokeOrder, type UV, type XY } from './roadMath'

/** O que a camada lê dos pins: as posições, com o pin arrastado na posição do arrasto. */
export type RoadPinsState = { pins: readonly Pin[]; dragging: { id: string; pos: UV } | null }

/** Px na tela entre dois pontos da curva amostrada. */
const SAMPLE_PX = 2

/**
 * A camada das estradas no mapa (estradas.md, AC-F5-01): estrada, trilha e rota marítima com os
 * traços do design system (`ROAD_STROKES`), na curva suavizada pelos pontos da estrada, acima do
 * terreno e da decoração (fora do desfoque) e abaixo dos pins. As larguras e os tracejados são em
 * px na tela, em qualquer zoom: a camada redesenha quando a escala muda. Os contornos de todas as
 * estradas vão antes dos traços de cima (`strokeOrder`): nos cruzamentos, nenhum contorno corta outro
 * traço. A ponta ligada a um pin
 * fica na posição dele, e acompanha o arrasto (`sync` com o `dragging` dos pins). A estrada selecionada
 * ganha o halo âmbar (`ROAD_HALO`, AC-F5-06), por baixo dos traços.
 */
export class RoadLayer {
  readonly view = new Graphics()
  private roads: readonly Road[] = []
  private selectedId: string | null = null
  private pins: RoadPinsState = { pins: [], dragging: null }
  private dirty = true
  private drawnScale = 0
  /** Estradas desenhadas no último quadro (as de menos de 2 pontos não têm traço). */
  count = 0

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

  /** Redesenha se as estradas, os pins ou a escala (px da tela por unidade do mundo) mudaram. */
  frame(scale: number) {
    if (!this.view.visible || scale <= 0) return
    if (!this.dirty && scale === this.drawnScale) return
    this.dirty = false
    this.drawnScale = scale
    const g = this.view
    g.clear()
    const byId = new Map(this.pins.pins.map((p) => [p.id, p.pos]))
    const dragging = this.pins.dragging
    const pinPos = (id: string) => (dragging && dragging.id === id ? dragging.pos : byId.get(id))
    const lines = new Map<Road, XY[]>()
    for (const road of this.roads) {
      const line = roadLine(road, pinPos, SAMPLE_PX / scale)
      if (line.length >= 2) lines.set(road, line)
    }
    // O halo da estrada selecionada (AC-F5-06) fica por baixo de todos os traços.
    const selected = this.roads.find((r) => r.id === this.selectedId)
    const halo = selected && lines.get(selected)
    if (halo) {
      g.moveTo(halo[0].x, halo[0].y)
      for (let i = 1; i < halo.length; i++) g.lineTo(halo[i].x, halo[i].y)
      g.stroke({ width: ROAD_HALO.width / scale, color: ROAD_HALO.color, alpha: ROAD_HALO.alpha, cap: 'round', join: 'round' })
    }
    for (const { road, stroke } of strokeOrder([...lines.keys()])) {
      const line = lines.get(road)!
      const parts = stroke.dash ? dashPolyline(line, stroke.dash[0] / scale, stroke.dash[1] / scale) : [line]
      for (const part of parts) {
        g.moveTo(part[0].x, part[0].y)
        for (let i = 1; i < part.length; i++) g.lineTo(part[i].x, part[i].y)
      }
      if (parts.length > 0) g.stroke({ width: stroke.width / scale, color: stroke.color, cap: 'round', join: 'round' })
    }
    this.count = lines.size
  }

  destroy() {
    this.view.destroy()
  }
}
