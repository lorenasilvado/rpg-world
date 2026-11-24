import { describe, expect, it } from 'vitest'
import { tagKey, uniqueTags } from './pinTags'

describe('tags do pin no estado', () => {
  it('tagKey não diferencia maiúsculas', () => {
    expect(tagKey('Porto')).toBe(tagKey('PORTO'))
    expect(tagKey('Porto')).not.toBe(tagKey('Portos'))
  })

  it('uniqueTags tira as repetidas (sem diferenciar maiúsculas), com a grafia da primeira vez', () => {
    expect(uniqueTags(['Porto', 'capital', 'porto', 'PORTO', 'capital'])).toEqual(['Porto', 'capital'])
    const tags = ['porto', 'capital']
    expect(uniqueTags(tags)).toBe(tags)
    expect(uniqueTags([])).toEqual([])
  })
})
