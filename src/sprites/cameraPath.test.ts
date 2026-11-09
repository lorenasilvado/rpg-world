import { describe, expect, it } from 'vitest'
import { cameraAt, MAX_ZOOM, MIN_ZOOM, PATH_MAX_ZOOM, PATH_MIN_ZOOM } from './cameraPath'

const WORLD = { width: 2048, height: 1280 }
const samples = Array.from({ length: 1801 }, (_, i) => (i * 1000) / 60)

describe('cameraAt', () => {
  it('começa no menor zoom, com o mapa inteiro à vista', () => {
    expect(cameraAt(0, WORLD).scale).toBeCloseTo(PATH_MIN_ZOOM)
  })

  it('percorre a faixa toda de zoom dentro dos limites', () => {
    const scales = samples.map((t) => cameraAt(t, WORLD).scale)
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(MIN_ZOOM)
    expect(Math.max(...scales)).toBeLessThanOrEqual(MAX_ZOOM)
    expect(Math.max(...scales)).toBeCloseTo(PATH_MAX_ZOOM, 2)
  })

  it('o centro fica dentro do mapa', () => {
    for (const t of samples) {
      const { x, y } = cameraAt(t, WORLD)
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(WORLD.width)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(WORLD.height)
    }
  })

  it('é contínua: sem saltos entre um quadro e o seguinte', () => {
    for (let i = 1; i < samples.length; i++) {
      const a = cameraAt(samples[i - 1], WORLD)
      const b = cameraAt(samples[i], WORLD)
      expect(Math.abs(b.x - a.x)).toBeLessThan(10)
      expect(Math.abs(b.y - a.y)).toBeLessThan(10)
      expect(b.scale / a.scale).toBeLessThan(1.02)
      expect(b.scale / a.scale).toBeGreaterThan(0.98)
    }
  })
})
