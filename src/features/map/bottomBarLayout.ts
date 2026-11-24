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
/** Margem do minimapa (e do toast, quando ocupa a largura) à esquerda. */
export const BAR_SIDE = 16
/** Margem do controle de zoom e do toast à direita (alinhados com a barra de ações do topo). */
export const ZOOM_SIDE = 12

/** Borda dos cartões (minimapa e zoom). */
export const PANEL_BORDER = 1
/** Cabeçalho "Minimapa" com mouse. */
export const MINIMAP_HEADER_HEIGHT = 32
/** Cabeçalho "Minimapa" em tela de toque: a área de toque mínima do design system. */
export const MINIMAP_HEADER_HEIGHT_TOUCH = 44
/** Folga do cartão do minimapa em volta da superfície (dos lados e embaixo). */
export const MINIMAP_PADDING = 6
export const MINIMAP_CARD_WIDTH = MINIMAP_WIDTH + 2 * MINIMAP_PADDING + 2 * PANEL_BORDER

/** Altura do cabeçalho do minimapa: maior em tela de toque. */
export function minimapHeaderHeight(touch = false): number {
  return touch ? MINIMAP_HEADER_HEIGHT_TOUCH : MINIMAP_HEADER_HEIGHT
}

/** Altura do cartão do minimapa, aberto ou recolhido (só o cabeçalho). */
export function minimapCardHeight(open: boolean, touch = false): number {
  return minimapHeaderHeight(touch) + (open ? MINIMAP_HEIGHT + MINIMAP_PADDING : 0) + 2 * PANEL_BORDER
}

/** Com mouse: o cartão aberto e recolhido. */
export const MINIMAP_CARD_HEIGHT = minimapCardHeight(true)
export const MINIMAP_CARD_COLLAPSED_HEIGHT = minimapCardHeight(false)
/** Em tela de toque: o cartão aberto e recolhido. */
export const MINIMAP_CARD_HEIGHT_TOUCH = minimapCardHeight(true, true)
export const MINIMAP_CARD_COLLAPSED_HEIGHT_TOUCH = minimapCardHeight(false, true)

/** Altura do controle de zoom. */
export const ZOOM_BAR_HEIGHT = 56
/** Folga do controle de zoom dos lados. */
export const ZOOM_BAR_PADDING = 6
/** Botão do zoom em tela de toque (a área de toque mínima); com mouse, 40 px de largura. */
export const ZOOM_BUTTON_TOUCH = 44
/** O controle de zoom compacto (só −, + e centralizar) no maior caso, o de toque. */
export const ZOOM_COMPACT_MAX_WIDTH = 2 * PANEL_BORDER + 2 * ZOOM_BAR_PADDING + 3 * ZOOM_BUTTON_TOUCH

/**
 * Toolbar de ferramentas (design-system.md → Ferramenta da toolbar): 6 ferramentas de 44 px, 4 px
 * entre elas, um separador antes de Camadas (1 px com 4 px de margem dos lados) e 5 px de folga nas
 * pontas. Na linha, fica deitada e centrada; em pé, tem a largura `TOOLBAR_THICKNESS`.
 */
export const TOOLBAR_TOOLS = 6
export const TOOLBAR_BUTTON = 44
export const TOOLBAR_GAP = 4
export const TOOLBAR_PADDING = 5
export const TOOLBAR_SEPARATOR = 1 + 2 * 4
export const TOOLBAR_THICKNESS = 56
/** Comprimento da toolbar (a largura deitada, a altura em pé): 309 px. */
export const TOOLBAR_LENGTH =
  2 * PANEL_BORDER + 2 * TOOLBAR_PADDING + TOOLBAR_TOOLS * TOOLBAR_BUTTON + TOOLBAR_TOOLS * TOOLBAR_GAP + TOOLBAR_SEPARATOR

/**
 * Larguras fixas da escala (a barra de 32 px com 8 e 6 px de folga) e da porcentagem no controle de
 * zoom: o rótulo não muda a largura do controle, e `ZOOM_FULL_FROM` e `TOOLBAR_ROW_FROM` valem
 * para qualquer zoom.
 */
export const ZOOM_SCALE_WIDTH = 46
export const ZOOM_PERCENT_WIDTH = 44

/** Controle de zoom completo (escala e porcentagem), no maior caso, o de toque. */
export const ZOOM_FULL_MAX_WIDTH =
  2 * PANEL_BORDER + 2 * ZOOM_BAR_PADDING + ZOOM_SCALE_WIDTH + ZOOM_PERCENT_WIDTH + 3 * ZOOM_BUTTON_TOUCH

/** Largura do toast quando fica no canto direito. */
export const TOAST_WIDTH = 352

/**
 * Altura de um toast com ação (o botão de 44 px e 8 px de folga em cima e embaixo): com dois toasts à
 * vista, o segundo fica `TOAST_HEIGHT + BAR_GAP` acima do primeiro.
 */
export const TOAST_HEIGHT = 60

/** Abaixo desta largura da área livre, o minimapa e o zoom compacto não cabem lado a lado. */
export const STACK_BELOW = BAR_SIDE + MINIMAP_CARD_WIDTH + BAR_GAP + ZOOM_COMPACT_MAX_WIDTH + ZOOM_SIDE
/**
 * A partir desta largura da área livre, o zoom completo (escala e porcentagem) cabe ao lado do
 * minimapa: 450 px. Abaixo, o controle de zoom fica compacto (só −, + e centralizar).
 */
export const ZOOM_FULL_FROM = BAR_SIDE + MINIMAP_CARD_WIDTH + BAR_GAP + ZOOM_FULL_MAX_WIDTH + ZOOM_SIDE
/** A partir desta largura, o toast cabe no canto direito sem chegar ao minimapa. */
export const TOAST_BESIDE_FROM = BAR_SIDE + MINIMAP_CARD_WIDTH + BAR_GAP + TOAST_WIDTH + ZOOM_SIDE

/**
 * A partir desta largura da área livre, a toolbar cabe deitada no centro da linha, sem chegar ao
 * minimapa nem ao zoom completo: 829 px. Centrada, ela precisa de cada lado do maior entre o
 * minimapa e o zoom completo (com as margens e o `BAR_GAP`), e o zoom completo é o maior.
 */
export const TOOLBAR_ROW_FROM =
  2 * Math.max(BAR_SIDE + MINIMAP_CARD_WIDTH + BAR_GAP, BAR_GAP + ZOOM_FULL_MAX_WIDTH + ZOOM_SIDE) + TOOLBAR_LENGTH

/**
 * A partir desta largura da área livre, a toolbar cabe deitada e centrada com `BAR_SIDE` de cada
 * lado: 341 px. Abaixo dela (e de `TOOLBAR_ROW_FROM`), fica deitada numa segunda linha; abaixo
 * desta, em pé.
 */
export const TOOLBAR_ABOVE_FROM = TOOLBAR_LENGTH + 2 * BAR_SIDE

/** Onde fica a toolbar: na linha, deitada numa segunda linha acima dela, ou em pé acima do zoom. */
export type ToolbarPlace = 'row' | 'above' | 'vertical'

export type BottomBarLayout = {
  /** O minimapa fica acima do zoom, em vez de ao lado. */
  stacked: boolean
  /** Base do minimapa, a partir da base da linha. */
  minimapBottom: number
  /** O toast fica no canto direito (com `TOAST_WIDTH`); senão, na largura da área. */
  toastBeside: boolean
  /** Base do toast, a partir da base da linha. */
  toastBottom: number
  /** Distância do toast à direita da linha (passa para a esquerda da toolbar em pé). */
  toastRight: number
  /** Onde fica a toolbar (`ToolbarPlace`). */
  toolbar: ToolbarPlace
  /** Base da toolbar, a partir da base da linha. */
  toolbarBottom: number
}

/**
 * Onde ficam o minimapa, a toolbar e o toast na linha inferior, pela largura da área livre
 * (`width`, a da própria linha; `null` enquanto não foi medida, como no jsdom: o caso largo). Com
 * `touch` (tela de toque), o cabeçalho do minimapa é mais alto, e o que fica acima dele sobe junto.
 *
 * - Abaixo de `STACK_BELOW`, o minimapa sobe para `BAR_GAP` acima do zoom.
 * - Toolbar: a partir de `TOOLBAR_ROW_FROM`, deitada no centro da linha. Abaixo, a partir de
 *   `TOOLBAR_ABOVE_FROM`, deitada e centrada numa segunda linha, `BAR_GAP` acima do mais alto entre
 *   o minimapa (aberto ou recolhido) e o zoom. Abaixo disso, em pé, `BAR_GAP` acima do zoom e
 *   alinhada à direita dele.
 * - A partir de `TOAST_BESIDE_FROM` (mais a toolbar em pé, quando ela está ali), o toast fica no
 *   canto direito; senão, ocupa a largura da área (até a toolbar em pé). Ele fica `BAR_GAP` acima
 *   da toolbar na segunda linha; senão, acima do zoom (no canto) ou do mais alto entre o minimapa e
 *   o zoom (na largura).
 */
export function bottomBarLayout(width: number | null, minimapOpen: boolean, touch = false): BottomBarLayout {
  const stacked = width !== null && width < STACK_BELOW
  const minimapBottom = stacked ? ZOOM_BAR_HEIGHT + BAR_GAP : 0
  const minimapTop = minimapBottom + minimapCardHeight(minimapOpen, touch)
  const rowTop = Math.max(minimapTop, ZOOM_BAR_HEIGHT)
  const toolbar: ToolbarPlace =
    width === null || width >= TOOLBAR_ROW_FROM ? 'row' : width >= TOOLBAR_ABOVE_FROM ? 'above' : 'vertical'
  const toolbarBottom = toolbar === 'row' ? 0 : toolbar === 'above' ? rowTop + BAR_GAP : ZOOM_BAR_HEIGHT + BAR_GAP
  const toolbarSpace = toolbar === 'vertical' ? TOOLBAR_THICKNESS + BAR_GAP : 0
  const toastRight = ZOOM_SIDE + toolbarSpace
  const toastBeside = width === null || width - toolbarSpace >= TOAST_BESIDE_FROM
  const toastBottom =
    toolbar === 'above' ? toolbarBottom + TOOLBAR_THICKNESS + BAR_GAP : (toastBeside ? ZOOM_BAR_HEIGHT : rowTop) + BAR_GAP
  return { stacked, minimapBottom, toastBeside, toastBottom, toastRight, toolbar, toolbarBottom }
}
