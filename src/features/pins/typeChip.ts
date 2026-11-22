/**
 * As cores da etiqueta do tipo no drawer: a cor do pin com o texto legível (contraste AA de 4,5:1,
 * design-system.md → Contraste). Texto branco sobre a sombra do tipo; se não alcança, a tinta
 * `#2B2420` sobre a base (NPC e Ponto de interesse, claros demais para o branco).
 */
export function typeChipColors({ base, shade }: { base: string; shade: string }): { background: string; color: string } {
  return contrast(shade, '#FFFFFF') >= 4.5 ? { background: shade, color: '#FFFFFF' } : { background: base, color: '#2B2420' }
}

/** Contraste WCAG entre duas cores `#RRGGBB`. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
