import type { MapInsets } from '../render/MapRenderer'

/**
 * A partir de 768 px, a sidebar e o drawer ficam fixos sobre o mapa: o mapa cabe entre eles.
 * Abaixo disso, eles são painéis sobrepostos e o mapa usa a tela toda.
 */
export function panelInsets(): MapInsets {
  if (!window.matchMedia('(min-width: 768px)').matches) return { left: 0, right: 0, top: 0, bottom: 0 }
  const css = getComputedStyle(document.documentElement)
  const px = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0
  return { left: px('--sidebar-width'), right: px('--drawer-width'), top: 0, bottom: 0 }
}
