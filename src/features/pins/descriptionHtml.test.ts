import { describe, expect, it } from 'vitest'
import { descriptionHtml, trimEmptyParagraphs } from './descriptionHtml'

describe('HTML salvo da descrição (AC-F3-07)', () => {
  it('tira os parágrafos vazios do fim, e só os do fim', () => {
    expect(trimEmptyParagraphs('<p>a</p><p></p><p></p>')).toBe('<p>a</p>')
    expect(trimEmptyParagraphs('<p>a</p><p></p><p>b</p>')).toBe('<p>a</p><p></p><p>b</p>')
    expect(trimEmptyParagraphs('<ul><li><p>x</p></li></ul><p></p>')).toBe('<ul><li><p>x</p></li></ul>')
  })

  it('a descrição vazia é salva como texto vazio', () => {
    expect(descriptionHtml({ isEmpty: true, getHTML: () => '<p></p>' })).toBe('')
    expect(descriptionHtml({ isEmpty: false, getHTML: () => '<h2>T</h2><p></p>' })).toBe('<h2>T</h2>')
  })
})
