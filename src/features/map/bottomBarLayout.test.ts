import { describe, expect, it } from 'vitest'
import {
  MINIMAP_CARD_COLLAPSED_HEIGHT,
  MINIMAP_CARD_COLLAPSED_HEIGHT_TOUCH,
  MINIMAP_CARD_HEIGHT_TOUCH,
  MINIMAP_CARD_HEIGHT,
  MINIMAP_CARD_WIDTH,
  STACK_BELOW,
  TOAST_BESIDE_FROM,
  TOOLBAR_LENGTH,
  TOOLBAR_ROW_FROM,
  ZOOM_FULL_MAX_WIDTH,
  ZOOM_SIDE,
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

  it('a toolbar tem 309 px e cabe deitada a partir de 713 px de área livre', () => {
    // 2 de borda + 2 × 5 de folga + 6 × 44 + 6 × 4 entre os itens + 9 do separador.
    expect(TOOLBAR_LENGTH).toBe(309)
    // 2 × (16 + 174 + 12) + 309.
    expect(TOOLBAR_ROW_FROM).toBe(713)
  })

  it('com o zoom completo (a partir de 860 px), a toolbar centrada também não chega a ele', () => {
    const side = (860 - TOOLBAR_LENGTH) / 2
    expect(side).toBeGreaterThanOrEqual(ZOOM_SIDE + ZOOM_FULL_MAX_WIDTH + 12)
  })
})

describe('bottomBarLayout: toolbar', () => {
  it('a partir de 713 px, deitada no centro da linha; o toast fica no canto direito', () => {
    expect(bottomBarLayout(713, true)).toMatchObject({ toolbarVertical: false, toastRight: 12, toastBeside: true })
    expect(bottomBarLayout(720, true)).toMatchObject({ toolbarVertical: false, toastRight: 12 })
    expect(bottomBarLayout(null, true)).toMatchObject({ toolbarVertical: false, toastRight: 12 })
  })

  it('abaixo de 713 px, em pé acima do zoom; o toast passa para a esquerda dela (12 + 56 + 12)', () => {
    expect(bottomBarLayout(712, true)).toMatchObject({ toolbarVertical: true, toastRight: 80, toastBeside: true })
    // Celular 390 e tablet com a sidebar aberta (304 px).
    expect(bottomBarLayout(390, true, true)).toMatchObject({ toolbarVertical: true, toastRight: 80, toastBeside: false })
    expect(bottomBarLayout(304, true, true)).toMatchObject({ toolbarVertical: true, toastRight: 80, stacked: true })
  })
})

describe('bottomBarLayout', () => {
  it('área larga: minimapa na base, toast no canto direito acima do zoom', () => {
    expect(bottomBarLayout(720, true)).toMatchObject({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
    // Com a toolbar em pé (abaixo de 713 px), o toast precisa de 566 px à esquerda dela: 634 px.
    expect(bottomBarLayout(634, false)).toMatchObject({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
    expect(bottomBarLayout(633, false).toastBeside).toBe(false)
  })

  it('sem medir (jsdom), o caso largo', () => {
    expect(bottomBarLayout(null, true)).toMatchObject({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
  })

  it('abaixo de 566 px: o toast na largura, acima do minimapa aberto ou do zoom', () => {
    expect(bottomBarLayout(565, true)).toMatchObject({ stacked: false, minimapBottom: 0, toastBeside: false, toastBottom: 152 })
    // Recolhido (34 px), o zoom (56 px) é o mais alto.
    expect(bottomBarLayout(390, false)).toMatchObject({ stacked: false, minimapBottom: 0, toastBeside: false, toastBottom: 68 })
  })

  it('abaixo de 360 px: o minimapa sobe acima do zoom, e o toast acima dele', () => {
    expect(bottomBarLayout(359, true)).toMatchObject({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 220 })
    expect(bottomBarLayout(304, false)).toMatchObject({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 114 })
    expect(bottomBarLayout(360, true).stacked).toBe(false)
  })

  it('em tela de toque, o toast sobe junto com o cabeçalho mais alto do minimapa', () => {
    expect(bottomBarLayout(390, true, true)).toMatchObject({ stacked: false, minimapBottom: 0, toastBeside: false, toastBottom: 164 })
    expect(bottomBarLayout(320, true, true)).toMatchObject({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 232 })
    // Recolhido (46 px), o zoom (56 px) ainda é o mais alto.
    expect(bottomBarLayout(390, false, true).toastBottom).toBe(68)
    // No canto direito, o toast fica acima do zoom, com ou sem toque.
    expect(bottomBarLayout(720, true, true).toastBottom).toBe(68)
  })
})
