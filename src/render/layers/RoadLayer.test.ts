import { describe, expect, it, vi } from 'vitest'
import type { Road } from '../../persistence/types'
import { WORLD_SIZE } from '../camera'
import { RoadLayer, TESS_PX, ZOOM_DRIFT, curveBounds } from './RoadLayer'
import { ROAD_HALO, ROAD_STROKES } from './roadMath'

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

/**
 * Os traços do quadro: cor, largura (em px na tela: a local vezes a escala da camada e a do mapa) e
 * opacidade de cada `stroke`, na ordem. Nenhum, se o quadro não redesenhou.
 */
function strokes(layer: RoadLayer, scale: number, view?: Parameters<RoadLayer['frame']>[1]) {
  const spy = vi.spyOn(layer.view, 'stroke')
  layer.frame(scale, view)
  const out = spy.mock.calls.map(([s]) => {
    const style = s as { color: number; width: number; alpha?: number }
    return { color: style.color, width: style.width * layer.view.scale.x * scale, alpha: style.alpha ?? 1 }
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
    expect(strokes(layer, 2)[0].width).toBeCloseTo(ROAD_HALO.width)

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

/** Uma estrada horizontal curta em `v`, de `u` a `u + 0.05`. */
const at = (id: string, u: number, v: number): Road => ({ id, name: id, kind: 'road', points: [{ u, v }, { u: u + 0.05, v }] })

describe('RoadLayer: desempenho com muitas estradas (AC-F5-16)', () => {
  it('desenha em unidades locais de TESS_PX px: as larguras na tela são as do design system em qualquer zoom', () => {
    const layer = new RoadLayer()
    for (const scale of [0.4, 1, 3.5]) {
      // Uma lista nova a cada escala: o quadro redesenha.
      layer.sync([road(`a${scale}`)], NO_PINS)
      const drawn = strokes(layer, scale)
      expect(drawn.map((s) => s.width)).toEqual(ROAD_STROKES.road.map((s) => expect.closeTo(s.width, 6)))
      expect(layer.view.scale.x).toBeCloseTo(TESS_PX / scale)
    }
    layer.destroy()
  })

  it('com a vista, desenha só as estradas que cruzam a janela de culling, e conta todas', () => {
    const layer = new RoadLayer()
    // Escala 1: a vista é um quadrado de 100 unidades no canto; a janela tem 25 de folga de cada lado.
    layer.sync([at('dentro', 0.02, 0.05), at('perto', 0.11, 0.05), at('longe', 0.6, 0.6)], NO_PINS)
    layer.frame(1, { x: 0, y: 0, width: 100, height: 100 })
    expect(layer.count).toBe(3)
    expect(layer.drawn).toBe(2)
    // Sem vista (o PNG, os testes), todas.
    layer.sync([at('dentro', 0.02, 0.05), at('longe', 0.6, 0.6)], NO_PINS)
    layer.frame(1)
    expect(layer.drawn).toBe(2)
    layer.destroy()
  })

  it('a vista que sai da janela do último desenho redesenha; dentro dela, não', () => {
    const layer = new RoadLayer()
    layer.sync([at('a', 0.02, 0.05), at('b', 0.5, 0.05)], NO_PINS)
    expect(strokes(layer, 1, { x: 0, y: 0, width: 100, height: 100 }).length).toBeGreaterThan(0)
    expect(layer.drawn).toBe(1)
    // Um pan pequeno: a vista continua na janela (de -25 a 125).
    expect(strokes(layer, 1, { x: 20, y: 0, width: 100, height: 100 })).toEqual([])
    // Um pan até a estrada b: redesenha, com ela.
    expect(strokes(layer, 1, { x: 0.45 * WORLD_SIZE, y: 0, width: 100, height: 100 }).length).toBeGreaterThan(0)
    expect(layer.drawn).toBe(1)
    layer.destroy()
  })

  it('no meio do zoom, redesenha só quando a escala se afasta mais de ZOOM_DRIFT; quando ela para, com as larguras exatas', () => {
    const layer = new RoadLayer()
    layer.sync([road('a')], NO_PINS)
    expect(strokes(layer, 1).length).toBeGreaterThan(0)
    // Zoom contínuo, de pouco em pouco: dentro da folga, nada muda.
    expect(strokes(layer, 1.04)).toEqual([])
    expect(strokes(layer, 1.08)).toEqual([])
    // A escala parou (igual à do quadro anterior): redesenha na exata.
    const settled = strokes(layer, 1.08)
    expect(settled.map((s) => s.width)).toEqual(ROAD_STROKES.road.map((s) => expect.closeTo(s.width, 6)))
    expect(strokes(layer, 1.08)).toEqual([])
    // Um passo maior que a folga: redesenha logo.
    expect(strokes(layer, 1.08 * ZOOM_DRIFT * 1.01).length).toBeGreaterThan(0)
    expect(ZOOM_DRIFT).toBe(1.12)
    layer.destroy()
  })

  it('na roda do mouse, redesenha a cada entalhe: o passo passa da folga, e a escala para entre um e outro', () => {
    const layer = new RoadLayer()
    layer.sync([road('a')], NO_PINS)
    layer.frame(1)
    // Um entalhe muda o zoom em uns 19%, e a escala fica igual até o próximo.
    let scale = 1
    for (let notch = 0; notch < 3; notch++) {
      scale *= 1.19
      expect(strokes(layer, scale).length, `entalhe ${notch + 1}`).toBeGreaterThan(0)
      expect(strokes(layer, scale), `entre o entalhe ${notch + 1} e o próximo`).toEqual([])
    }
    layer.destroy()
  })

  it('a estrada ou o pin que muda redesenha no quadro seguinte, mesmo no meio do zoom', () => {
    const layer = new RoadLayer()
    layer.sync([road('a')], NO_PINS)
    layer.frame(1)
    layer.frame(1.04)
    layer.sync([road('a'), road('b')], NO_PINS)
    expect(strokes(layer, 1.06).length).toBeGreaterThan(0)
    layer.destroy()
  })
})

describe('curveBounds', () => {
  it('contém os pontos e os pontos de controle da curva, em unidades do mundo', () => {
    const r = curveBounds([{ u: 0.1, v: 0.5 }, { u: 0.2, v: 0.4 }, { u: 0.3, v: 0.5 }])
    expect(r.x).toBeCloseTo(0.1 * WORLD_SIZE)
    expect(r.x + r.width).toBeCloseTo(0.3 * WORLD_SIZE)
    // A curva passa pelo ponto do meio, com os controles na altura dele: o retângulo vai de 0,4 a 0,5.
    expect(r.y).toBeLessThanOrEqual(0.4 * WORLD_SIZE + 1e-9)
    expect(r.y + r.height).toBeCloseTo(0.5 * WORLD_SIZE)
  })
})
