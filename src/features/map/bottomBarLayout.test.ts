import { describe, expect, it } from 'vitest'
import {
  MINIMAP_CARD_COLLAPSED_HEIGHT,
  MINIMAP_CARD_HEIGHT,
  MINIMAP_CARD_WIDTH,
  STACK_BELOW,
  TOAST_BESIDE_FROM,
  ZOOM_COMPACT_MAX_WIDTH,
  bottomBarLayout,
} from './bottomBarLayout'

describe('medidas da linha inferior', () => {
  it('derivam do minimapa (160 × 100), do zoom e do toast', () => {
    expect(MINIMAP_CARD_WIDTH).toBe(174)
    expect(MINIMAP_CARD_HEIGHT).toBe(140)
    expect(MINIMAP_CARD_COLLAPSED_HEIGHT).toBe(34)
    expect(ZOOM_COMPACT_MAX_WIDTH).toBe(146)
    // 16 + 174 + 12 + 146 + 12 e 16 + 174 + 12 + 352 + 16.
    expect(STACK_BELOW).toBe(360)
    expect(TOAST_BESIDE_FROM).toBe(570)
  })
})

describe('bottomBarLayout', () => {
  it('área larga: minimapa na base, toast no canto direito acima do zoom', () => {
    expect(bottomBarLayout(720, true)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
    expect(bottomBarLayout(570, false)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
  })

  it('sem medir (jsdom), o caso largo', () => {
    expect(bottomBarLayout(null, true)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
  })

  it('abaixo de 570 px: o toast na largura, acima do minimapa aberto ou do zoom', () => {
    expect(bottomBarLayout(569, true)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: false, toastBottom: 152 })
    // Recolhido (34 px), o zoom (56 px) é o mais alto.
    expect(bottomBarLayout(390, false)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: false, toastBottom: 68 })
  })

  it('abaixo de 360 px: o minimapa sobe acima do zoom, e o toast acima dele', () => {
    expect(bottomBarLayout(359, true)).toEqual({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 220 })
    expect(bottomBarLayout(304, false)).toEqual({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 114 })
    expect(bottomBarLayout(360, true).stacked).toBe(false)
  })
})
