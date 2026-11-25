/**
 * Leva o foco do teclado ao mapa (o Mostrar do aviso de pins sobre a água, que some com o clique): o
 * mapa fica focável só até perder o foco, para o clique nele continuar sem focá-lo.
 */
export function focusMap(el: HTMLElement | null) {
  if (!el) return
  el.tabIndex = -1
  el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true })
  el.focus()
}
