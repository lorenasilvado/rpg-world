import { describe, expect, it } from 'vitest'
import type { Pin } from '../../persistence/types'
import { searchPins } from './searchPins'

const pin = (id: string, name: string, tags: string[] = []): Pin => ({
  id,
  type: 'cidade',
  name,
  pos: { u: 0.5, v: 0.5 },
  icon: { kind: 'builtin', key: 'cidade' },
  description: '',
  tags,
  fields: {},
})

const names = (pins: Pin[], q: string) => searchPins(pins, q).results.map((r) => r.pin.name)

describe('searchPins (AC-F3-16)', () => {
  const pins = [
    pin('1', 'Valdora', ['capital', 'porto']),
    pin('2', 'Porto Velho'),
    pin('3', 'Ávila', ['aldeia']),
    pin('4', 'Torre do Mago', ['ruína', 'arcano']),
    pin('5', 'Brejo Fundo', ['vila portuária']),
  ]

  it('acha por nome e por tag, sem diferenciar maiúsculas nem acentos', () => {
    expect(names(pins, 'avila')).toEqual(['Ávila'])
    expect(names(pins, 'VALDORA')).toEqual(['Valdora'])
    expect(names(pins, 'ruina')).toEqual(['Torre do Mago'])
    expect(names(pins, '  mago ')).toEqual(['Torre do Mago'])
  })

  it('o nome que começa pelo texto vem antes do nome que o tem no meio, e os dois antes da tag', () => {
    // "Porto Velho" pelo nome; Valdora pela tag "porto" (começa); Brejo Fundo pela tag "vila portuária" (no meio).
    expect(names(pins, 'port')).toEqual(['Porto Velho', 'Valdora', 'Brejo Fundo'])
    expect(names(pins, 'al')).toEqual(['Valdora', 'Ávila'])
  })

  it('no mesmo nível, em ordem alfabética', () => {
    expect(names([pin('a', 'Zimbra'), pin('b', 'Arvoredo'), pin('c', 'Mirante')], 'r')).toEqual(['Arvoredo', 'Mirante', 'Zimbra'])
  })

  it('devolve as tags que bateram (nenhuma, se só o nome bateu)', () => {
    const { results } = searchPins(pins, 'port')
    expect(results.map((r) => r.tags)).toEqual([[], ['porto'], ['vila portuária']])
    expect(searchPins([pin('x', 'Porto', ['porto'])], 'port').results[0].tags).toEqual(['porto'])
  })

  it('texto vazio não acha nada', () => {
    expect(searchPins(pins, '   ')).toEqual({ results: [], total: 0 })
  })

  it('corta no limite e diz o total', () => {
    const many = Array.from({ length: 60 }, (_, i) => pin(`p${i}`, `Vila ${String(i).padStart(2, '0')}`))
    const { results, total } = searchPins(many, 'vila', 50)
    expect(results).toHaveLength(50)
    expect(total).toBe(60)
    expect(results[0].pin.name).toBe('Vila 00')
  })
})
