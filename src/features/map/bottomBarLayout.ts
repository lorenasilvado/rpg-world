/**
 * Medidas da linha inferior do editor (design-system.md → Layout do Editor), num lugar só: o
 * minimapa, o controle de zoom e o toast usam estas constantes no estilo, e `bottomBarLayout` decide
 * a partir delas onde cada um fica. Os E2E conferem que as caixas na tela batem com elas (por isso
 * este módulo não importa nada: os E2E o leem direto).
 */

/** Tamanho da superfície do minimapa (design-system.md → Layout do Editor). */
export const MINIMAP_WIDTH = 160
export const MINIMAP_HEIGHT = 100

/** Distância da linha à base da tela. */
export const BAR_BOTTOM = 16
/** Folga entre os elementos da linha (e entre o toast e o que fica abaixo dele). */
export const BAR_GAP = 12
/** Margem do minimapa à esquerda e do toast dos dois lados. */
export const BAR_SIDE = 16
/** Margem do controle de zoom à direita (alinhado com a barra de ações do topo). */
export const ZOOM_SIDE = 12

/** Borda dos cartões (minimapa e zoom). */
export const PANEL_BORDER = 1
/** Cabeçalho "Minimapa". */
export const MINIMAP_HEADER_HEIGHT = 32
/** Folga do cartão do minimapa em volta da superfície (dos lados e embaixo). */
export const MINIMAP_PADDING = 6
export const MINIMAP_CARD_WIDTH = MINIMAP_WIDTH + 2 * MINIMAP_PADDING + 2 * PANEL_BORDER
export const MINIMAP_CARD_HEIGHT = MINIMAP_HEADER_HEIGHT + MINIMAP_HEIGHT + MINIMAP_PADDING + 2 * PANEL_BORDER
/** Recolhido, fica só o cabeçalho. */
export const MINIMAP_CARD_COLLAPSED_HEIGHT = MINIMAP_HEADER_HEIGHT + 2 * PANEL_BORDER

/** Altura do controle de zoom. */
export const ZOOM_BAR_HEIGHT = 56
/** Folga do controle de zoom dos lados. */
export const ZOOM_BAR_PADDING = 6
/** Botão do zoom em tela de toque (a área de toque mínima); com mouse, 40 px de largura. */
export const ZOOM_BUTTON_TOUCH = 44
/** O controle de zoom compacto (só −, + e centralizar) no maior caso, o de toque. */
export const ZOOM_COMPACT_MAX_WIDTH = 2 * PANEL_BORDER + 2 * ZOOM_BAR_PADDING + 3 * ZOOM_BUTTON_TOUCH

/** Largura do toast quando fica no canto direito. */
export const TOAST_WIDTH = 352

/** Abaixo desta largura da área livre, o minimapa e o zoom compacto não cabem lado a lado. */
export const STACK_BELOW = BAR_SIDE + MINIMAP_CARD_WIDTH + BAR_GAP + ZOOM_COMPACT_MAX_WIDTH + ZOOM_SIDE
/** A partir desta largura, o toast cabe no canto direito sem chegar ao minimapa. */
export const TOAST_BESIDE_FROM = BAR_SIDE + MINIMAP_CARD_WIDTH + BAR_GAP + TOAST_WIDTH + BAR_SIDE

export type BottomBarLayout = {
  /** O minimapa fica acima do zoom, em vez de ao lado. */
  stacked: boolean
  /** Base do minimapa, a partir da base da linha. */
  minimapBottom: number
  /** O toast fica no canto direito (com `TOAST_WIDTH`); senão, na largura da área. */
  toastBeside: boolean
  /** Base do toast, a partir da base da linha. */
  toastBottom: number
}

/**
 * Onde ficam o minimapa e o toast na linha inferior, pela largura da área livre (`width`, a da
 * própria linha; `null` enquanto não foi medida, como no jsdom: o caso largo).
 *
 * - Abaixo de `STACK_BELOW`, o minimapa sobe para `BAR_GAP` acima do zoom.
 * - A partir de `TOAST_BESIDE_FROM`, o toast fica no canto direito, `BAR_GAP` acima do zoom.
 *   Abaixo, ele ocupa a largura e fica `BAR_GAP` acima do mais alto entre o minimapa (aberto ou
 *   recolhido) e o zoom.
 */
export function bottomBarLayout(width: number | null, minimapOpen: boolean): BottomBarLayout {
  const stacked = width !== null && width < STACK_BELOW
  const minimapBottom = stacked ? ZOOM_BAR_HEIGHT + BAR_GAP : 0
  const minimapTop = minimapBottom + (minimapOpen ? MINIMAP_CARD_HEIGHT : MINIMAP_CARD_COLLAPSED_HEIGHT)
  const toastBeside = width === null || width >= TOAST_BESIDE_FROM
  const toastBottom = (toastBeside ? ZOOM_BAR_HEIGHT : Math.max(minimapTop, ZOOM_BAR_HEIGHT)) + BAR_GAP
  return { stacked, minimapBottom, toastBeside, toastBottom }
}
