import type { MapInsets } from '../render/MapRenderer'

/** A partir desta largura, a sidebar e o drawer ficam fixos (abaixo dela, são painéis sobrepostos). */
export const DESKTOP_QUERY = '(min-width: 768px)'

/**
 * A partir de 768 px, a sidebar e o drawer ficam fixos sobre o mapa: o mapa cabe entre eles. A
 * sidebar recolhida (`sidebarCollapsed`) cobre só 48 px. Abaixo de 768 px, eles são painéis
 * sobrepostos e o mapa usa a tela toda.
 */
export function panelInsets(sidebarCollapsed = false): MapInsets {
  if (!window.matchMedia(DESKTOP_QUERY).matches) return { left: 0, right: 0, top: 0, bottom: 0 }
  const css = getComputedStyle(document.documentElement)
  const px = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0
  const left = px(sidebarCollapsed ? '--sidebar-collapsed-width' : '--sidebar-width')
  return { left, right: px('--drawer-width'), top: 0, bottom: 0 }
}
