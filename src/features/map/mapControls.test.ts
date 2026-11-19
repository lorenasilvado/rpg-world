import { describe, expect, it } from 'vitest'
import {
  inRect,
  minimapMapBox,
  minimapToWorld,
  minimapViewCenter,
  minimapViewRect,
  scaleLabel,
  showsZoomDetails,
  zoomPercent,
} from './mapControls'

describe('escala e porcentagem (AC-F2-09)', () => {
  it('a barra de 32 px mostra os km do zoom atual, a partir de sizeKm', () => {
    // Mundo de 800 km em 1024 unidades; 1 px por unidade → 32 px = 25 km.
    expect(scaleLabel(1, 800)).toBe('25 km')
    // Mapa inteiro em 900 px de altura: 800 km em 900 px → 32 px ≈ 28,4 km.
    expect(scaleLabel(900 / 1024, 800)).toBe('28 km')
    // Com zoom alto, abaixo de 10 km, uma casa decimal com vírgula.
    expect(scaleLabel(3.5, 800)).toBe('7,1 km')
    // O tamanho do mundo muda a escala.
    expect(scaleLabel(1, 1600)).toBe('50 km')
  })

  it('a porcentagem é o zoom relativo arredondado', () => {
    expect(zoomPercent(1)).toBe('100%')
    expect(zoomPercent(0.923)).toBe('92%')
    expect(zoomPercent(4)).toBe('400%')
  })

  it('esconde a escala e a porcentagem com menos de 860 px de área livre', () => {
    expect(showsZoomDetails(860)).toBe(true)
    expect(showsZoomDetails(992)).toBe(true)
    expect(showsZoomDetails(859)).toBe(false)
    expect(showsZoomDetails(720)).toBe(false)
  })
})

describe('minimapa (AC-F2-08)', () => {
  it('o mapa quadrado fica inteiro e centrado nos 160 × 100', () => {
    expect(minimapMapBox()).toEqual({ x: 30, y: 0, size: 100, k: 100 / 1024 })
  })

  it('o retângulo da área visível acompanha a vista e é cortado no mapa', () => {
    expect(minimapViewRect({ x: 0, y: 0, width: 1024, height: 1024 })).toEqual({ x: 30, y: 0, width: 100, height: 100 })
    expect(minimapViewRect({ x: 256, y: 512, width: 512, height: 256 })).toEqual({ x: 55, y: 50, width: 50, height: 25 })
    // Mais larga que o mapa (afastado): o retângulo é o mapa inteiro, sem passar dele.
    expect(minimapViewRect({ x: -500, y: -100, width: 2024, height: 1224 })).toEqual({ x: 30, y: 0, width: 100, height: 100 })
  })

  it('converte um ponto do minimapa para o mundo e acha o centro da vista', () => {
    expect(minimapToWorld(80, 50)).toEqual({ x: 512, y: 512 })
    expect(minimapToWorld(30, 0)).toEqual({ x: 0, y: 0 })
    expect(minimapViewCenter({ x: 256, y: 512, width: 512, height: 256 })).toEqual({ x: 80, y: 62.5 })
  })

  it('sabe se o ponto está no retângulo', () => {
    const r = { x: 55, y: 50, width: 50, height: 25 }
    expect(inRect(60, 60, r)).toBe(true)
    expect(inRect(40, 60, r)).toBe(false)
  })
})
