import { describe, expect, it } from 'vitest'
import { isAllowedLink, normalizeLink } from './links'

describe('link da descrição (AC-F3-07)', () => {
  it('aceita http, https e mailto como vieram', () => {
    expect(normalizeLink(' https://exemplo.com/a ')).toBe('https://exemplo.com/a')
    expect(normalizeLink('http://exemplo.com')).toBe('http://exemplo.com')
    expect(normalizeLink('mailto:mestre@exemplo.com')).toBe('mailto:mestre@exemplo.com')
  })

  it('sem esquema, vira https; um e-mail solto vira mailto', () => {
    expect(normalizeLink('exemplo.com/wiki')).toBe('https://exemplo.com/wiki')
    expect(normalizeLink('mestre@exemplo.com')).toBe('mailto:mestre@exemplo.com')
  })

  it('recusa outros esquemas, espaços e texto que não é endereço', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//exemplo.com', 'dois termos', 'palavra', 'https:']) {
      expect(normalizeLink(bad)).toBeNull()
    }
  })
})

describe('links aceitos pelo editor (AC-F3-07)', () => {
  it('aceita http, https, mailto e endereço sem esquema; recusa ftp, tel, sms e javascript', () => {
    for (const ok of ['https://a.com', 'http://a.com', 'mailto:a@b.com', 'a.com/x']) expect(isAllowedLink(ok)).toBe(true)
    for (const bad of ['ftp://a.com', 'ftps://a.com', 'tel:+5511999990000', 'sms:123', 'javascript:alert(1)']) expect(isAllowedLink(bad)).toBe(false)
  })
})
