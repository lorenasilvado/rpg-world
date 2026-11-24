import { describe, expect, it } from 'vitest'
import type { Pin } from '../../persistence/types'
import { cleanDescriptionLinks, isAllowedLink, normalizeLink, pinsWithCleanLinks } from './links'

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

describe('links com caracteres escondidos (AC-F3-07)', () => {
  it('recusa caracteres de controle e invisíveis que escondem um esquema', () => {
    const c = (code: number) => String.fromCharCode(code)
    const hidden = [
      c(1) + 'javascript:alert(1).x',
      c(0) + 'https://a.com',
      'java' + c(9) + 'script:alert(1)',
      c(0x200b) + 'javascript:alert(1).x',
      'https://a' + c(0x202e) + '.com',
      'a' + c(0xfeff) + '.com',
    ]
    for (const bad of hidden) {
      expect(normalizeLink(bad)).toBeNull()
      expect(isAllowedLink(bad)).toBe(false)
    }
  })
})

describe('links da descrição salva (AC-F3-07)', () => {
  it('um link fora da regra vira texto, e um sem esquema ganha o https', () => {
    const ctrl = String.fromCharCode(1)
    const html =
      '<p>Ver <a href="javascript:alert(1)">mapa</a>, <a href="' + ctrl + 'javascript:x">antigo</a>, ' +
      '<a href="ftp://a.com">ftp</a>, <a href="a.com/x">site</a> e <a href="https://b.com">b</a></p>'
    expect(cleanDescriptionLinks(html)).toBe(
      '<p>Ver mapa, antigo, ftp, <a href="https://a.com/x">site</a> e <a href="https://b.com">b</a></p>',
    )
  })

  it('sem nada a mudar, devolve a mesma string', () => {
    const html = '<p><a href="mailto:a@b.com">e-mail</a> e <strong>texto</strong></p>'
    expect(cleanDescriptionLinks(html)).toBe(html)
    expect(cleanDescriptionLinks('')).toBe('')
  })

  it('pinsWithCleanLinks só troca os pins com link fora da regra', () => {
    const pin = (id: string, description: string): Pin => ({
      id,
      type: 'cidade',
      name: 'X',
      pos: { u: 0, v: 0 },
      icon: { kind: 'builtin', key: 'cidade' },
      description,
      tags: [],
      fields: {},
    })
    const ok = pin('a', '<p><a href="https://a.com">a</a></p>')
    const bad = pin('b', '<p><a href="javascript:x">b</a></p>')
    const [a, b] = pinsWithCleanLinks([ok, bad])
    expect(a).toBe(ok)
    expect(b).toEqual({ ...bad, description: '<p>b</p>' })
  })
})
