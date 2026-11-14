/**
 * Culling e nível de detalhe da decoração (TS puro, sem Pixi), usados pela `DecorLayer`.
 *
 * - **Nível de detalhe:** abaixo de 0,8× de zoom relativo, o mapa mostra uma fração dos ícones
 *   (metade até 0,55×, um quarto abaixo disso). Montanhas e montanhas nevadas ficam sempre, porque
 *   desenham o relevo. Cada ícone tem uma ordem fixa (`decorRank`), então afastar só tira ícones e
 *   aproximar devolve os mesmos, sem trocar uns pelos outros.
 * - **Culling:** só ficam visíveis os ícones que cruzam uma janela em volta da vista, maior que ela
 *   (`CULL_MARGIN` de cada lado). Enquanto a tela não sai da janela, não fica bem menor que ela
 *   (aproximar além de `CULL_REZOOM`) e o nível não muda, nada é recalculado, então o pan não mexe
 *   nos sprites a cada quadro.
 */

export type Rect = { x: number; y: number; width: number; height: number }

/** Ícones em unidades do mundo, com o pé em (x, y) e o tamanho do quadrado de cada um. */
export type DecorIcons = { x: Float32Array; y: Float32Array; size: Float32Array; always: Uint8Array }

/** Níveis de detalhe, do mais perto ao mais longe: a partir de `minZoom`, fica a fração `keep`. */
export const LOD_LEVELS: ReadonlyArray<{ minZoom: number; keep: number }> = [
  { minZoom: 0.8, keep: 1 },
  { minZoom: 0.55, keep: 0.5 },
  { minZoom: 0, keep: 0.25 },
]

/** Folga da janela de culling, em fração da tela, de cada lado. */
export const CULL_MARGIN = 0.25

/** Aproximar mais que este fator desde o último cálculo refaz a janela, menor. */
export const CULL_REZOOM = 1.25

/** Nível de detalhe (índice em `LOD_LEVELS`) para o zoom relativo. */
export function lodLevel(zoom: number): number {
  const i = LOD_LEVELS.findIndex((l) => zoom >= l.minZoom)
  return i < 0 ? LOD_LEVELS.length - 1 : i
}

/**
 * Ordem do ícone `i` de 0 a 1, pela sequência da razão áurea: os ícones vêm de cima para baixo,
 * e frações seguidas dessa sequência ficam espalhadas por igual, então qualquer fração dos ícones
 * cobre o mapa inteiro, sem faixas vazias.
 */
export function decorRank(i: number): number {
  const r = (i + 1) * 0.6180339887498949
  return r - Math.floor(r)
}

/**
 * Parte do mundo à vista: o retângulo `screen` da tela (em px; no editor, a área livre, já que a
 * sidebar e o drawer fixos cobrem o resto) na transformação da câmera.
 */
export function worldView(t: { x: number; y: number; scale: number }, screen: Rect): Rect {
  return {
    x: (screen.x - t.x) / t.scale,
    y: (screen.y - t.y) / t.scale,
    width: screen.width / t.scale,
    height: screen.height / t.scale,
  }
}

/** Janela de culling: a vista com `margin` de folga de cada lado. */
export function cullWindow(view: Rect, margin = CULL_MARGIN): Rect {
  const dx = view.width * margin
  const dy = view.height * margin
  return { x: view.x - dx, y: view.y - dy, width: view.width + 2 * dx, height: view.height + 2 * dy }
}

/** A `view` cabe inteira na `window`. */
export function covers(window: Rect, view: Rect): boolean {
  return (
    view.x >= window.x &&
    view.y >= window.y &&
    view.x + view.width <= window.x + window.width &&
    view.y + view.height <= window.y + window.height
  )
}

/** A janela não serve mais para a `view`: ela saiu da janela, ou a câmera aproximou demais. */
export function stale(window: Rect, view: Rect, margin = CULL_MARGIN): boolean {
  return !covers(window, view) || view.width * (1 + 2 * margin) * CULL_REZOOM < window.width
}

/**
 * Marca em `out` (1 = desenha) os ícones que ficam no nível `keep` e cruzam a `window`, com o pé
 * na base central do quadrado. Devolve quantos ficaram.
 */
export function markVisible(icons: DecorIcons, window: Rect, keep: number, out: Uint8Array): number {
  const left = window.x
  const right = window.x + window.width
  const top = window.y
  const bottom = window.y + window.height
  let count = 0
  for (let i = 0; i < icons.x.length; i++) {
    const s = icons.size[i]
    const x = icons.x[i]
    const y = icons.y[i]
    const show =
      (icons.always[i] === 1 || decorRank(i) < keep) &&
      x + s / 2 >= left &&
      x - s / 2 <= right &&
      y >= top &&
      y - s <= bottom
    out[i] = show ? 1 : 0
    if (show) count++
  }
  return count
}
