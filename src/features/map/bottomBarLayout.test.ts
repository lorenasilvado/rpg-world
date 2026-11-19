import { describe, expect, it } from 'vitest'
import {
  MINIMAP_CARD_COLLAPSED_HEIGHT,
  MINIMAP_CARD_COLLAPSED_HEIGHT_TOUCH,
  MINIMAP_CARD_HEIGHT_TOUCH,
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
    // Em tela de toque, o cabeçalho tem 44 px (a área de toque mínima).
    expect(MINIMAP_CARD_HEIGHT_TOUCH).toBe(152)
    expect(MINIMAP_CARD_COLLAPSED_HEIGHT_TOUCH).toBe(46)
    expect(ZOOM_COMPACT_MAX_WIDTH).toBe(146)
    // 16 + 174 + 12 + 146 + 12 e 16 + 174 + 12 + 352 + 12.
    expect(STACK_BELOW).toBe(360)
    expect(TOAST_BESIDE_FROM).toBe(566)
  })
})

describe('bottomBarLayout', () => {
  it('área larga: minimapa na base, toast no canto direito acima do zoom', () => {
    expect(bottomBarLayout(720, true)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
    expect(bottomBarLayout(566, false)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
  })

  it('sem medir (jsdom), o caso largo', () => {
    expect(bottomBarLayout(null, true)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
  })

  it('abaixo de 566 px: o toast na largura, acima do minimapa aberto ou do zoom', () => {
    expect(bottomBarLayout(565, true)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: false, toastBottom: 152 })
    // Recolhido (34 px), o zoom (56 px) é o mais alto.
    expect(bottomBarLayout(390, false)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: false, toastBottom: 68 })
  })

  it('abaixo de 360 px: o minimapa sobe acima do zoom, e o toast acima dele', () => {
    expect(bottomBarLayout(359, true)).toEqual({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 220 })
    expect(bottomBarLayout(304, false)).toEqual({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 114 })
    expect(bottomBarLayout(360, true).stacked).toBe(false)
  })

  it('em tela de toque, o toast sobe junto com o cabeçalho mais alto do minimapa', () => {
    expect(bottomBarLayout(390, true, true)).toEqual({ stacked: false, minimapBottom: 0, toastBeside: false, toastBottom: 164 })
    expect(bottomBarLayout(320, true, true)).toEqual({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 232 })
    // Recolhido (46 px), o zoom (56 px) ainda é o mais alto.
    expect(bottomBarLayout(390, false, true).toastBottom).toBe(68)
    // No canto direito, o toast fica acima do zoom, com ou sem toque.
    expect(bottomBarLayout(720, true, true).toastBottom).toBe(68)
  })
})
