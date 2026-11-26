import { describe, expect, it, vi } from 'vitest'
import type { Road } from '../../persistence/types'
import { RoadLayer } from './RoadLayer'
import { ROAD_HALO } from './roadMath'

const road = (id: string, kind: Road['kind'] = 'road'): Road => ({
  id,
  name: id,
  kind,
  points: [
    { u: 0.1, v: 0.1 },
    { u: 0.3, v: 0.2 },
  ],
})

const NO_PINS = { pins: [], dragging: null }

/** Os traços do último quadro: cor, largura e opacidade de cada `stroke`, na ordem. */
function strokes(layer: RoadLayer, scale: number) {
  const spy = vi.spyOn(layer.view, 'stroke')
  layer.frame(scale)
  const out = spy.mock.calls.map(([s]) => {
    const style = s as { color: number; width: number; alpha?: number }
    return { color: style.color, width: style.width, alpha: style.alpha ?? 1 }
  })
  spy.mockRestore()
  return out
}

describe('RoadLayer: halo da estrada selecionada (AC-F5-06)', () => {
  it('sem seleção, não há halo; com a estrada selecionada, o halo vem antes de todos os traços', () => {
    const layer = new RoadLayer()
    const roads = [road('a'), road('b', 'trail')]
    layer.sync(roads, NO_PINS)
    expect(strokes(layer, 1).some((s) => s.color === ROAD_HALO.color)).toBe(false)

    layer.sync(roads, NO_PINS, 'b')
    const drawn = strokes(layer, 1)
    expect(drawn[0]).toEqual({ color: ROAD_HALO.color, width: ROAD_HALO.width, alpha: ROAD_HALO.alpha })
    expect(drawn.filter((s) => s.color === ROAD_HALO.color)).toHaveLength(1)
    expect(ROAD_HALO).toEqual({ color: 0xc8892b, width: 13, alpha: 0.55 })
    layer.destroy()
  })

  it('o halo tem 13 px na tela em qualquer zoom e sai ao tirar a seleção', () => {
    const layer = new RoadLayer()
    const roads = [road('a')]
    layer.sync(roads, NO_PINS, 'a')
    expect(strokes(layer, 2)[0].width).toBeCloseTo(ROAD_HALO.width / 2)

    layer.sync(roads, NO_PINS, null)
    expect(strokes(layer, 2).some((s) => s.color === ROAD_HALO.color)).toBe(false)
    layer.destroy()
  })

  it('a seleção de uma estrada que não está na lista não desenha halo', () => {
    const layer = new RoadLayer()
    layer.sync([road('a')], NO_PINS, 'sumiu')
    expect(strokes(layer, 1).some((s) => s.color === ROAD_HALO.color)).toBe(false)
    layer.destroy()
  })
})
