import type { MapInsets } from '../render/MapRenderer'

/**
 * A partir de 768 px de largura e 500 px de altura, a sidebar e o drawer ficam fixos; abaixo de
 * qualquer um dos dois, são painéis sobrepostos (AC-F2-14). É o corte da variante `desk:` do CSS.
 */
export const DESKTOP_QUERY = '(min-width: 768px) and (min-height: 500px)'

/** Tela baixa (menos de 500 px de altura, como o celular deitado): a variante `short:` do CSS. */
export const SHORT_QUERY = '(max-height: 499px)'

/**
 * A partir de 768 px (com 500 px de altura), a sidebar fica fixa sobre o mapa: a área livre vai dela até a borda direita
 * (a sidebar recolhida, `sidebarCollapsed`, cobre só 48 px). O drawer só aparece com um pin
 * selecionado e não muda a área livre (nem o zoom): fica em `drawer`, para centrar o pin à esquerda
 * dele. Abaixo de 768 px, sidebar e drawer são painéis sobrepostos e o mapa usa a tela toda.
 */
export function panelInsets(sidebarCollapsed = false): MapInsets {
  if (!window.matchMedia(DESKTOP_QUERY).matches) return { left: 0, right: 0, top: 0, bottom: 0 }
  const css = getComputedStyle(document.documentElement)
  const px = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0
  const left = px(sidebarCollapsed ? '--sidebar-collapsed-width' : '--sidebar-width')
  return { left, right: 0, top: 0, bottom: 0, drawer: px('--drawer-width') }
}
