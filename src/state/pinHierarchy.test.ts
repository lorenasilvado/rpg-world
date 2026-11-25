import { describe, expect, it } from 'vitest'
import type { Pin } from '../persistence/types'
import { canBeParent, childrenOf, parentOptions, validParents } from './pinHierarchy'

const pin = (id: string, parentId?: string): Pin => ({
  id,
  type: 'cidade',
  name: id,
  pos: { u: 0.5, v: 0.5 },
  icon: { kind: 'builtin', key: 'cidade' },
  description: '',
  tags: [],
  fields: {},
  ...(parentId !== undefined ? { parentId } : {}),
})

// reino › cidade › vila, e um castelo solto.
const world = [pin('reino'), pin('cidade', 'reino'), pin('vila', 'cidade'), pin('castelo')]

describe('hierarquia dos pins (AC-F3-12)', () => {
  it('o pai pode ser qualquer pin, menos o próprio e os descendentes dele', () => {
    expect(parentOptions(world, 'reino').map((p) => p.id)).toEqual(['castelo'])
    expect(parentOptions(world, 'cidade').map((p) => p.id)).toEqual(['reino', 'castelo'])
    expect(parentOptions(world, 'vila').map((p) => p.id)).toEqual(['reino', 'cidade', 'castelo'])
    expect(parentOptions(world, 'castelo').map((p) => p.id)).toEqual(['reino', 'cidade', 'vila'])
  })

  it('canBeParent recusa o próprio pin, um descendente e um pin que não existe; sem pai sempre pode', () => {
    expect(canBeParent(world, 'reino', 'reino')).toBe(false)
    expect(canBeParent(world, 'reino', 'vila')).toBe(false)
    expect(canBeParent(world, 'reino', 'nenhum')).toBe(false)
    expect(canBeParent(world, 'vila', 'reino')).toBe(true)
    expect(canBeParent(world, 'reino', null)).toBe(true)
  })

  it('childrenOf lista os filhos diretos, na ordem da lista', () => {
    const more = [...world, pin('aldeia', 'reino')]
    expect(childrenOf(more, 'reino').map((p) => p.id)).toEqual(['cidade', 'aldeia'])
    expect(childrenOf(more, 'vila')).toEqual([])
  })
})

describe('validParents (mundo salvo ou importado)', () => {
  it('sem nada a corrigir, a mesma lista', () => {
    expect(validParents(world)).toBe(world)
  })

  it('tira o pai que não existe e o próprio pin, sem deixar o campo', () => {
    const out = validParents([pin('a', 'sumiu'), pin('b', 'b'), pin('c', 'a')])
    expect(out.map((p) => p.parentId)).toEqual([undefined, undefined, 'a'])
    expect('parentId' in out[0]).toBe(false)
  })

  it('desfaz um ciclo no pin que o fecha, e um pin pendurado no ciclo continua com o pai', () => {
    // a › b › c › a, e d pendurado em c.
    const out = validParents([pin('d', 'c'), pin('a', 'c'), pin('b', 'a'), pin('c', 'b')])
    expect(out.map((p) => [p.id, p.parentId])).toEqual([
      ['d', 'c'],
      ['a', undefined],
      ['b', 'a'],
      ['c', 'b'],
    ])
  })
})
