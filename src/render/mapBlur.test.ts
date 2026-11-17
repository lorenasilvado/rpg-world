import { describe, expect, it } from 'vitest'
import { createMapBlur, cssEase, MAP_BLUR_MS, MAP_BLUR_PX } from './mapBlur'

describe('cssEase', () => {
  it('vai de 0 a 1, crescente, como o `ease` do CSS', () => {
    expect(cssEase(0)).toBe(0)
    expect(cssEase(1)).toBe(1)
    // Valores de referência do `ease` (cubic-bezier(.25,.1,.25,1)).
    expect(cssEase(0.25)).toBeCloseTo(0.4085, 3)
    expect(cssEase(0.5)).toBeCloseTo(0.8024, 3)
    let prev = 0
    for (let i = 1; i <= 20; i++) {
      const v = cssEase(i / 20)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('Desfoque da prévia (AC-F1-18)', () => {
  it('borra e fica nítido em 260 ms, partindo do valor atual', () => {
    const blur = createMapBlur()
    blur.target(MAP_BLUR_PX, 0, false)
    expect(blur.step(MAP_BLUR_MS / 2)).toBe(true)
    expect(blur.value).toBeGreaterThan(0)
    expect(blur.value).toBeLessThan(MAP_BLUR_PX)
    expect(blur.step(MAP_BLUR_MS)).toBe(false)
    expect(blur.value).toBe(MAP_BLUR_PX)

    blur.target(0, 1000, false)
    blur.step(1000 + 100)
    const mid = blur.value
    expect(mid).toBeGreaterThan(0)
    // Volta a gerar no meio da animação: parte de onde estava, sem saltar.
    blur.target(MAP_BLUR_PX, 1100, false)
    blur.step(1100)
    expect(blur.value).toBeCloseTo(mid, 10)
    blur.step(1100 + MAP_BLUR_MS)
    expect(blur.value).toBe(MAP_BLUR_PX)
  })

  it('com movimento reduzido, salta direto para o alvo', () => {
    const blur = createMapBlur()
    blur.target(MAP_BLUR_PX, 0, true)
    expect(blur.value).toBe(MAP_BLUR_PX)
    expect(blur.step(1)).toBe(false)
    blur.target(0, 5, true)
    expect(blur.value).toBe(0)
  })
})
