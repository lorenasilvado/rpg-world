import { describe, expect, it, vi } from 'vitest'
import type { Pin } from '../persistence/types'
import { clampPos, copyName, createPinsStore, nextPinType } from './pinsStore'

const saved = (id: string, type: string): Pin => ({
  id,
  type,
  name: id,
  pos: { u: 0.5, v: 0.5 },
  icon: { kind: 'builtin', key: type },
  description: '',
  tags: [],
  fields: {},
})

describe('pinsStore (AC-F3-01, AC-F3-03)', () => {
  it('o primeiro pin do mundo é uma Cidade "Novo pin" na posição clicada, já selecionado e novo', () => {
    let n = 0
    const pins = createPinsStore([], { newId: () => `p${++n}` })
    const pin = pins.getState().addPin({ u: 0.25, v: 0.75 })
    expect(pin).toEqual({
      id: 'p1',
      type: 'cidade',
      name: 'Novo pin',
      pos: { u: 0.25, v: 0.75 },
      icon: { kind: 'builtin', key: 'cidade' },
      description: '',
      tags: [],
      fields: {},
    })
    expect(pins.getState()).toMatchObject({ pins: [pin], selectedId: 'p1', newPinId: 'p1' })
  })

  it('o pin novo é do último tipo usado no mundo', () => {
    expect(nextPinType([])).toBe('cidade')
    expect(nextPinType([saved('a', 'vila'), saved('b', 'masmorra')])).toBe('masmorra')
    const pins = createPinsStore([saved('a', 'npc')])
    expect(pins.getState().addPin({ u: 0, v: 0 }).type).toBe('npc')
  })

  it('selecionar outro pin deixa de tratar o novo como novo; Esc (select null) fecha', () => {
    const pins = createPinsStore([saved('a', 'vila')], { newId: () => 'b' })
    pins.getState().addPin({ u: 0.1, v: 0.1 })
    pins.getState().select('a')
    expect(pins.getState()).toMatchObject({ selectedId: 'a', newPinId: null })
    pins.getState().select(null)
    expect(pins.getState().selectedId).toBeNull()
  })

  it('não seleciona um pin que não existe', () => {
    const pins = createPinsStore([saved('a', 'vila')])
    pins.getState().select('x')
    expect(pins.getState().selectedId).toBeNull()
  })

  it('renomear troca a lista (o salvamento grava) só quando o nome muda; o hover não mexe nos pins', () => {
    const pins = createPinsStore([saved('a', 'vila')])
    const listener = vi.fn()
    pins.subscribe(listener)
    const before = pins.getState().pins
    pins.getState().rename('a', 'a')
    expect(listener).not.toHaveBeenCalled()
    pins.getState().rename('a', 'Valdora')
    expect(pins.getState().pins[0].name).toBe('Valdora')
    expect(pins.getState().pins).not.toBe(before)
    const after = pins.getState().pins
    pins.getState().setHovered('a')
    expect(pins.getState().hoveredId).toBe('a')
    expect(pins.getState().pins).toBe(after)
  })
})

describe('arrastar e excluir (AC-F3-04, AC-F3-05)', () => {
  it('o arrasto guarda a posição presa entre 0 e 1 e só muda a lista ao soltar', () => {
    const pins = createPinsStore([saved('a', 'vila')])
    const before = pins.getState().pins
    pins.getState().dragTo('a', { u: 1.4, v: -0.2 })
    expect(pins.getState().dragging).toEqual({ id: 'a', pos: { u: 1, v: 0 } })
    expect(pins.getState().pins).toBe(before)
    pins.getState().endDrag(true)
    expect(pins.getState().pins[0]).toEqual({ ...before[0], pos: { u: 1, v: 0 } })
    expect(pins.getState().dragging).toBeNull()
  })

  it('soltar sem confirmar devolve o pin; arrastar um pin que não existe não faz nada', () => {
    const pins = createPinsStore([saved('a', 'vila')])
    const before = pins.getState().pins
    pins.getState().dragTo('a', { u: 0.1, v: 0.1 })
    pins.getState().endDrag(false)
    expect(pins.getState().pins).toBe(before)
    pins.getState().dragTo('x', { u: 0.1, v: 0.1 })
    expect(pins.getState().dragging).toBeNull()
  })

  it('excluir tira o pin da lista e da seleção, do hover e do pin novo, e devolve o pin', () => {
    const pins = createPinsStore([saved('a', 'vila')], { newId: () => 'n' })
    pins.getState().addPin({ u: 0.2, v: 0.2 })
    pins.getState().setHovered('n')
    const n = pins.getState().pins[1]
    expect(pins.getState().removePin('n')).toBe(n)
    expect(pins.getState()).toMatchObject({ selectedId: null, hoveredId: null, newPinId: null })
    expect(pins.getState().pins.map((p) => p.id)).toEqual(['a'])
    expect(pins.getState().removePin('n')).toBeNull()
  })

  it('clampPos prende u e v entre 0 e 1', () => {
    expect(clampPos({ u: -1, v: 2 })).toEqual({ u: 0, v: 1 })
    expect(clampPos({ u: 0.3, v: 0.7 })).toEqual({ u: 0.3, v: 0.7 })
  })
})

describe('ficha do pin (AC-F3-07 a AC-F3-09)', () => {
  const full: Pin = {
    id: 'a',
    type: 'castelo',
    name: 'Valdora',
    pos: { u: 0.5, v: 0.5 },
    icon: { kind: 'builtin', key: 'castelo' },
    description: '<p>Capital</p>',
    tags: ['capital', 'porto'],
    fields: { rei: 'Aldo' },
    parentId: 'reino',
  }

  it('updatePin troca a descrição e as tags; sem mudança, a lista fica a mesma', () => {
    const pins = createPinsStore([full])
    const before = pins.getState().pins
    pins.getState().updatePin('a', { description: '<p>Capital</p>', tags: ['capital', 'porto'] })
    expect(pins.getState().pins).toBe(before)
    pins.getState().updatePin('a', { description: '<p><strong>Capital</strong></p>' })
    pins.getState().updatePin('a', { tags: ['capital'] })
    expect(pins.getState().pins[0]).toMatchObject({ description: '<p><strong>Capital</strong></p>', tags: ['capital'], name: 'Valdora' })
  })

  it('duplicatePin cria "<nome> (cópia)" deslocada, com a mesma ficha e o mesmo pai, e a seleciona', () => {
    const child: Pin = { ...full, id: 'filho', name: 'Vila', parentId: 'a' }
    const pins = createPinsStore([full, child], { newId: () => 'copia' })
    const copy = pins.getState().duplicatePin('a', { u: 0.02, v: 0.01 })
    expect(copy).toEqual({ ...full, id: 'copia', name: 'Valdora (cópia)', pos: { u: 0.52, v: 0.51 } })
    expect(copy!.tags).not.toBe(full.tags)
    expect(pins.getState().pins.map((p) => p.id)).toEqual(['a', 'filho', 'copia'])
    expect(pins.getState().pins.filter((p) => p.parentId === 'copia')).toEqual([])
    expect(pins.getState()).toMatchObject({ selectedId: 'copia', newPinId: null })
  })

  it('a cópia fica presa no mapa, e um pin que não existe não duplica', () => {
    const pins = createPinsStore([{ ...full, pos: { u: 0.99, v: 0.5 } }], { newId: () => 'c' })
    expect(pins.getState().duplicatePin('a', { u: 0.05, v: 0 })!.pos).toEqual({ u: 1, v: 0.5 })
    expect(pins.getState().duplicatePin('nenhum', { u: 0, v: 0 })).toBeNull()
  })

  it('a cópia de uma cópia conta: "(cópia 2)", "(cópia 3)"', () => {
    expect(copyName('Valdora')).toBe('Valdora (cópia)')
    expect(copyName('Valdora (cópia)')).toBe('Valdora (cópia 2)')
    expect(copyName('Valdora (cópia 2)')).toBe('Valdora (cópia 3)')
    expect(copyName('Valdora (cópia) velha')).toBe('Valdora (cópia) velha (cópia)')
  })

  it('o nome da cópia cabe nos 80 caracteres', () => {
    expect(copyName('x'.repeat(80))).toHaveLength(80)
    expect(copyName('x'.repeat(80)).endsWith(' (cópia)')).toBe(true)
  })
})
