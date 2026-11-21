import { describe, expect, it } from 'vitest'
import { scaleLabel } from './mapControls'
import { addMeasurePoint, clampToWorld, distanceKm, formatKm, measureHint, screenToWorld, worldToScreen } from './measure'

describe('Medir distância: cálculo (AC-F2-13)', () => {
  it('a distância usa a largura do mundo em km (sizeKm)', () => {
    // O mundo padrão tem 800 km em 1024 unidades: a largura toda dá 800 km.
    expect(distanceKm({ x: 0, y: 0 }, { x: 1024, y: 0 }, 800)).toBe(800)
    expect(distanceKm({ x: 0, y: 512 }, { x: 512, y: 512 }, 800)).toBe(400)
    // 3-4-5: diagonal.
    expect(distanceKm({ x: 100, y: 100 }, { x: 100 + 3 * 64, y: 100 + 4 * 64 }, 800)).toBeCloseTo(250)
    // Outro tamanho de mundo muda a distância na mesma proporção.
    expect(distanceKm({ x: 0, y: 0 }, { x: 512, y: 0 }, 2000)).toBe(1000)
  })

  it('bate com a barra de escala: a medida de 32 px na tela é o texto da escala', () => {
    for (const scale of [0.7, 1.4, 3.5, 12]) {
      const a = screenToWorld(400, 300, { scale, view: { x: 100, y: 50 }, origin: { x: 320, y: 0 } })
      const b = screenToWorld(432, 300, { scale, view: { x: 100, y: 50 }, origin: { x: 320, y: 0 } })
      expect(formatKm(distanceKm(a, b, 800))).toBe(scaleLabel(scale, 800))
    }
  })

  it('o texto segue a escala: inteiro de 10 km para cima, uma casa decimal (vírgula) abaixo', () => {
    expect(formatKm(412.6)).toBe('413 km')
    expect(formatKm(10)).toBe('10 km')
    expect(formatKm(9.96)).toBe('10 km')
    expect(formatKm(7.25)).toBe('7,3 km')
    expect(formatKm(3)).toBe('3 km')
    expect(formatKm(0)).toBe('0 km')
  })

  it('tela e mundo: ida e volta pela câmera', () => {
    const cam = { scale: 2, view: { x: 200, y: 300 }, origin: { x: 320, y: 0 } }
    expect(screenToWorld(320, 0, cam)).toEqual({ x: 200, y: 300 })
    expect(screenToWorld(420, 50, cam)).toEqual({ x: 250, y: 325 })
    expect(worldToScreen({ x: 250, y: 325 }, cam)).toEqual({ x: 420, y: 50 })
  })

  it('um clique fora do mapa marca a borda mais próxima', () => {
    expect(clampToWorld({ x: -40, y: 1100 })).toEqual({ x: 0, y: 1024 })
    expect(clampToWorld({ x: 300, y: 400 })).toEqual({ x: 300, y: 400 })
  })

  it('dois cliques marcam as pontas; o terceiro recomeça', () => {
    const a = { x: 1, y: 1 }
    const b = { x: 2, y: 2 }
    const c = { x: 3, y: 3 }
    expect(addMeasurePoint([], a)).toEqual([a])
    expect(addMeasurePoint([a], b)).toEqual([a, b])
    expect(addMeasurePoint([a, b], c)).toEqual([c])
  })

  it('a dica pede os dois pontos, e depois do primeiro, o ponto final', () => {
    expect(measureHint([])).toBe('Clique em dois pontos para medir')
    expect(measureHint([{ x: 0, y: 0 }])).toBe('Clique no ponto final')
    expect(measureHint([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe('Clique em dois pontos para medir')
  })
})
