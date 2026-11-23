import { describe, expect, it } from 'vitest'
import { addTag, normalizeTag, removeTag, suggestedTags, TAG_MAX, uniqueTags } from './tags'

describe('tags do pin (AC-F3-08)', () => {
  it('a tag fica sem espaços nas pontas, com os do meio juntados, e até TAG_MAX caracteres', () => {
    expect(normalizeTag('  mortos   vivos ')).toBe('mortos vivos')
    expect(normalizeTag('x'.repeat(50))).toHaveLength(TAG_MAX)
  })

  it('"+ tag" adiciona no fim; vazia ou repetida (sem diferenciar maiúsculas) não entra', () => {
    const tags = ['capital']
    expect(addTag(tags, ' porto ')).toEqual(['capital', 'porto'])
    expect(addTag(tags, '   ')).toBe(tags)
    expect(addTag(tags, 'Capital')).toBe(tags)
  })

  it('o chip remove a tag', () => {
    expect(removeTag(['capital', 'porto'], 'capital')).toEqual(['porto'])
  })

  it('"Usadas no mundo": as tags dos outros pins que este não tem, das mais usadas às menos, até 6', () => {
    const pins = [
      { id: 'a', tags: ['capital', 'porto'] },
      { id: 'b', tags: ['militar', 'porto', 'perigo'] },
      { id: 'c', tags: ['Perigo', 'agrícola', 'mágico'] },
      { id: 'd', tags: ['aliada', 'mortos-vivos', 'capital', 'extra'] },
    ]
    expect(suggestedTags(pins, 'a')).toEqual(['perigo', 'militar', 'agrícola', 'mágico', 'aliada', 'mortos-vivos'])
    expect(suggestedTags(pins, 'a', 2)).toEqual(['perigo', 'militar'])
  })

  it('sem outros pins com tags, não há sugestões', () => {
    expect(suggestedTags([{ id: 'a', tags: ['capital'] }], 'a')).toEqual([])
  })

  it('uniqueTags tira as repetidas (sem diferenciar maiúsculas), com a grafia da primeira vez', () => {
    expect(uniqueTags(['Porto', 'capital', 'porto', 'PORTO', 'capital'])).toEqual(['Porto', 'capital'])
    const tags = ['porto', 'capital']
    expect(uniqueTags(tags)).toBe(tags)
    expect(uniqueTags([])).toEqual([])
  })
})
