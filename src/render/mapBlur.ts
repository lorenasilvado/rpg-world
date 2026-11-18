/**
 * Desfoque da prévia do mapa (design-system.md → Movimento): `blur(3px)` enquanto gera, e nítido em
 * 260 ms, com o easing `ease` do CSS (`cubic-bezier(.25, .1, .25, 1)`). TS puro, sem Pixi: o
 * `MapRenderer` aplica o valor num filtro só do terreno e da decoração, e o que fica acima deles no
 * mapa (pins e rotas) continua nítido.
 */
export const MAP_BLUR_PX = 3
export const MAP_BLUR_MS = 260

/** `ease` do CSS: a curva de Bézier (0,0) (.25,.1) (.25,1) (1,1), resolvida para `x` = tempo. */
export function cssEase(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const [x1, y1, x2, y2] = [0.25, 0.1, 0.25, 1]
  const bez = (u: number, a: number, b: number) => 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u
  // Bisseção no parâmetro da curva até o x bater com o tempo (x é crescente em u).
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (bez(mid, x1, x2) < t) lo = mid
    else hi = mid
  }
  return bez((lo + hi) / 2, y1, y2)
}

/**
 * Animação do desfoque entre dois valores: `from` no início e `to` depois de `MAP_BLUR_MS`. Com
 * movimento reduzido, salta direto para o alvo.
 */
export function createMapBlur(initial = 0) {
  let from = initial
  let to = initial
  let start = 0
  let value = initial
  return {
    /** O valor atual, em px. */
    get value() {
      return value
    },
    /** Muda o alvo (`MAP_BLUR_PX` gerando, 0 nítido), partindo do valor atual. */
    target(next: number, now: number, reducedMotion: boolean) {
      if (next === to) return
      from = value
      to = next
      start = now
      if (reducedMotion) value = to
    },
    /** Avança até `now` (ms); devolve `true` enquanto ainda anima. */
    step(now: number): boolean {
      if (value === to) return false
      const t = (now - start) / MAP_BLUR_MS
      value = t >= 1 ? to : from + (to - from) * cssEase(t)
      return value !== to
    },
  }
}
