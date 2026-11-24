import type { Pin } from '../../persistence/types'

const ALLOWED = /^(https?:|mailto:)/i
/** Um esquema qualquer (`javascript:`, `data:`…), ou `//` no começo. */
const HAS_SCHEME = /^([a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * Os caracteres de controle e invisíveis (de largura zero, marcas de direção, separadores de linha,
 * BOM), em faixas de pontos de código: o navegador ignora alguns deles ao ler um endereço, e eles
 * podem esconder um esquema.
 */
const HIDDEN_RANGES: readonly [number, number][] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x2064],
  [0xfeff, 0xfeff],
]

function hasHidden(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (HIDDEN_RANGES.some(([a, b]) => code >= a && code <= b)) return true
  }
  return false
}

/** Os protocolos que o link pode ter, conferidos pelo `URL` do navegador. */
const PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * O endereço do link da descrição (AC-F3-07): só http, https e mailto. Sem esquema, vira https
 * ("exemplo.com" → "https://exemplo.com"); um e-mail solto vira mailto. Outro esquema
 * (`javascript:`, `data:`…), um endereço com espaços ou com caracteres de controle ou invisíveis
 * (que escondem um esquema, como um U+0001 antes de "javascript:") não vale (`null`). No fim, o `URL` do
 * navegador confere o protocolo.
 */
export function normalizeLink(text: string): string | null {
  const href = text.trim()
  if (!href || /\s/.test(href) || hasHidden(href)) return null
  return checked(candidate(href))
}

function candidate(href: string): string | null {
  if (ALLOWED.test(href)) return href.length > href.indexOf(':') + 1 ? href : null
  if (HAS_SCHEME.test(href)) return null
  if (/^[^@/]+@[^@/]+\.[^@/]+$/.test(href)) return `mailto:${href}`
  if (!/^[^/]+\.[^/]+/.test(href)) return null
  return `https://${href}`
}

function checked(href: string | null): string | null {
  if (href === null) return null
  try {
    return PROTOCOLS.has(new URL(href).protocol) ? href : null
  } catch {
    return null
  }
}

/**
 * Se o endereço pode ser link na descrição (o `isAllowedUri` do TipTap): vale para o link digitado na
 * linha do link, o colado, o criado ao digitar e o que vem no HTML salvo ou importado. Só http, https
 * e mailto (`normalizeLink`).
 */
export function isAllowedLink(url: string): boolean {
  return normalizeLink(url) !== null
}

/**
 * A descrição salva ou importada com os links na regra (AC-F3-07): um link fora dela (outro
 * esquema, ou com caracteres de controle ou invisíveis) vira texto, e um sem esquema ganha o https,
 * como o editor faria. Sem nada a mudar, o HTML volta igual (a mesma string).
 */
export function cleanDescriptionLinks(html: string): string {
  if (!/<a[\s>]/i.test(html)) return html
  const template = document.createElement('template')
  template.innerHTML = html
  let changed = false
  for (const a of [...template.content.querySelectorAll('a')]) {
    const href = normalizeLink(a.getAttribute('href') ?? '')
    if (href === null) {
      a.replaceWith(...a.childNodes)
      changed = true
    } else if (href !== a.getAttribute('href')) {
      a.setAttribute('href', href)
      changed = true
    }
  }
  return changed ? template.innerHTML : html
}

/**
 * Os pins do mundo que abre, com os links da descrição na regra (`cleanDescriptionLinks`), para
 * a descrição guardada (e a exportada) não manter um link que o editor não mostra. Um pin sem
 * nada a mudar é o mesmo objeto.
 */
export function pinsWithCleanLinks(pins: readonly Pin[]): Pin[] {
  return pins.map((pin) => {
    const description = cleanDescriptionLinks(pin.description)
    return description === pin.description ? pin : { ...pin, description }
  })
}
