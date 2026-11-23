import Link from '@tiptap/extension-link'
import { isAllowedLink, normalizeLink } from './links'

/**
 * O link da descrição (AC-F3-07): o `Link` do TipTap com só http, https e mailto em todo caminho
 * (digitado, colado, criado ao digitar, salvo ou importado), pelo `isAllowedUri`. Ao ler um HTML
 * (o salvo, o colado ou o importado), o `href` também é normalizado: sem esquema, vira https
 * ("a.com/x" → "https://a.com/x"), e não fica como link relativo.
 */
export const DescriptionLink = Link.extend({
  addAttributes() {
    const parent = this.parent?.() ?? {}
    return {
      ...parent,
      href: {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeLink(element.getAttribute('href') ?? ''),
      },
    }
  },
}).configure({
  openOnClick: false,
  autolink: true,
  defaultProtocol: 'https',
  isAllowedUri: (url) => isAllowedLink(url),
})
