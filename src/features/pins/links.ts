const ALLOWED = /^(https?:|mailto:)/i
/** Um esquema qualquer (`javascript:`, `data:`…), ou `//` no começo. */
const HAS_SCHEME = /^([a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * O endereço do link da descrição (AC-F3-07): só http, https e mailto. Sem esquema, vira https
 * ("exemplo.com" → "https://exemplo.com"); um e-mail solto vira mailto. Outro esquema
 * (`javascript:`, `data:`…) ou um endereço com espaços não vale (`null`).
 */
export function normalizeLink(text: string): string | null {
  const href = text.trim()
  if (!href || /\s/.test(href)) return null
  if (ALLOWED.test(href)) return href.length > href.indexOf(':') + 1 ? href : null
  if (HAS_SCHEME.test(href)) return null
  if (/^[^@/]+@[^@/]+\.[^@/]+$/.test(href)) return `mailto:${href}`
  if (!/^[^/]+\.[^/]+/.test(href)) return null
  return `https://${href}`
}
