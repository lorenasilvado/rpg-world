import { describe, expect, it } from 'vitest'
import {
  MINIMAP_CARD_COLLAPSED_HEIGHT,
  MINIMAP_CARD_COLLAPSED_HEIGHT_TOUCH,
  MINIMAP_CARD_HEIGHT_TOUCH,
  MINIMAP_CARD_HEIGHT,
  MINIMAP_CARD_WIDTH,
  STACK_BELOW,
  TOAST_BESIDE_FROM,
  TOOLBAR_ABOVE_FROM,
  TOOLBAR_LENGTH,
  TOOLBAR_ROW_FROM,
  ZOOM_FULL_FROM,
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
    // O zoom completo: 2 + 12 + 46 da escala + 44 da porcentagem + 3 × 44; ao lado do minimapa,
    // 16 + 174 + 12 + 236 + 12.
    expect(ZOOM_FULL_MAX_WIDTH).toBe(236)
    expect(ZOOM_FULL_FROM).toBe(450)
  })

  it('a toolbar tem 309 px e cabe deitada na linha a partir de 829 px de área livre', () => {
    // 2 de borda + 2 × 5 de folga + 6 × 44 + 6 × 4 entre os itens + 9 do separador.
    expect(TOOLBAR_LENGTH).toBe(309)
    // 2 × (12 + 236 + 12) + 309: centrada, ela precisa do lado do zoom completo, o maior.
    expect(TOOLBAR_ROW_FROM).toBe(829)
    // 309 + 2 × 16: abaixo disso, nem numa segunda linha.
    expect(TOOLBAR_ABOVE_FROM).toBe(341)
  })

  it('na linha, a toolbar centrada não chega ao zoom completo nem ao minimapa', () => {
    const side = (TOOLBAR_ROW_FROM - TOOLBAR_LENGTH) / 2
    expect(side).toBeGreaterThanOrEqual(ZOOM_SIDE + ZOOM_FULL_MAX_WIDTH + 12)
    expect(side).toBeGreaterThanOrEqual(16 + MINIMAP_CARD_WIDTH + 12)
  })

  it('o zoom completo aparece em 1280 × 800 e 1440 × 900, com a sidebar aberta ou recolhida e o drawer (#137)', () => {
    // 1280: 560 e 832 px de área livre; 1440: 720 e 992.
    for (const width of [560, 832, 720, 992]) expect(width).toBeGreaterThanOrEqual(ZOOM_FULL_FROM)
  })
})

describe('bottomBarLayout: toolbar', () => {
  it('a partir de 829 px, deitada no centro da linha; o toast fica no canto direito acima do zoom', () => {
    expect(bottomBarLayout(829, true)).toMatchObject({ toolbar: 'row', toolbarBottom: 0, toastRight: 12, toastBeside: true, toastBottom: 68 })
    expect(bottomBarLayout(null, true)).toMatchObject({ toolbar: 'row', toolbarBottom: 0, toastRight: 12 })
  })

  it('de 341 a 828 px, deitada numa segunda linha, 12 px acima do mais alto entre o minimapa e o zoom', () => {
    // 1280 com a sidebar e o drawer (560 px): acima do minimapa aberto (140 px).
    expect(bottomBarLayout(560, true)).toMatchObject({ toolbar: 'above', toolbarBottom: 152, toastRight: 12 })
    // 1440 com a sidebar e o drawer (720 px) e o último antes da linha.
    expect(bottomBarLayout(720, true)).toMatchObject({ toolbar: 'above', toolbarBottom: 152 })
    expect(bottomBarLayout(828, true).toolbar).toBe('above')
    expect(bottomBarLayout(341, true).toolbar).toBe('above')
    // Minimapa recolhido (34 px): acima do zoom (56 px).
    expect(bottomBarLayout(560, false).toolbarBottom).toBe(68)
    // Celular 390 (toque): acima do cartão de 152 px.
    expect(bottomBarLayout(390, true, true)).toMatchObject({ toolbar: 'above', toolbarBottom: 164 })
    // 341 a 359: o minimapa empilhado acima do zoom (68 + 140), e a toolbar acima dele.
    expect(bottomBarLayout(359, true)).toMatchObject({ stacked: true, toolbar: 'above', toolbarBottom: 220 })
  })

  it('abaixo de 341 px, em pé acima do zoom; o toast passa para a esquerda dela (12 + 56 + 12)', () => {
    // Tablet 1024 com a sidebar aberta (304 px).
    expect(bottomBarLayout(340, true)).toMatchObject({ toolbar: 'vertical', toolbarBottom: 68, toastRight: 80 })
    expect(bottomBarLayout(304, true, true)).toMatchObject({ toolbar: 'vertical', toolbarBottom: 68, toastRight: 80, stacked: true })
  })
})

describe('bottomBarLayout: toast', () => {
  it('área larga: minimapa na base, toast no canto direito acima do zoom', () => {
    expect(bottomBarLayout(992, true)).toMatchObject({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
    expect(bottomBarLayout(992, true, true).toastBottom).toBe(68)
  })

  it('sem medir (jsdom), o caso largo', () => {
    expect(bottomBarLayout(null, true)).toMatchObject({ stacked: false, minimapBottom: 0, toastBeside: true, toastBottom: 68 })
  })

  it('com a toolbar na segunda linha, o toast fica 12 px acima dela (no canto a partir de 566 px)', () => {
    // 1440 com a sidebar e o drawer (720 px): no canto, acima da toolbar sobre o minimapa aberto.
    expect(bottomBarLayout(720, true)).toMatchObject({ toastBeside: true, toastBottom: 152 + 56 + 12 })
    expect(bottomBarLayout(566, false)).toMatchObject({ toastBeside: true, toastBottom: 68 + 56 + 12 })
    expect(bottomBarLayout(565, true)).toMatchObject({ toastBeside: false, toastBottom: 152 + 56 + 12 })
    expect(bottomBarLayout(390, false)).toMatchObject({ toastBeside: false, toastBottom: 136 })
    expect(bottomBarLayout(390, true, true)).toMatchObject({ toastBeside: false, toastBottom: 164 + 56 + 12 })
    expect(bottomBarLayout(359, true)).toMatchObject({ toastBeside: false, toastBottom: 220 + 56 + 12 })
  })

  it('com a toolbar em pé, o toast ocupa a largura até ela, acima do minimapa empilhado', () => {
    expect(bottomBarLayout(304, false)).toMatchObject({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 114 })
    expect(bottomBarLayout(320, true, true)).toMatchObject({ stacked: true, minimapBottom: 68, toastBeside: false, toastBottom: 232 })
    expect(bottomBarLayout(360, true).stacked).toBe(false)
  })
})
