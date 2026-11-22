import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_PARAMS } from '../core'
import type { Pin } from '../persistence/types'
import { createWorldHistory } from './history'
import { createPinsStore } from './pinsStore'
import { MAP_SIZE, PREVIEW_SIZE } from './sizes'
import { createWorldStore, type WorldGenerator } from './worldStore'

const pin = (id: string, u = 0.5, v = 0.5): Pin => ({
  id,
  type: 'cidade',
  name: id,
  pos: { u, v },
  icon: { kind: 'builtin', key: 'cidade' },
  description: '<p>ficha</p>',
  tags: ['capital'],
  fields: { rei: 'Aldo' },
})

/** Um gerador que nunca entrega: o teste só olha os pedidos. */
function fakeGenerator() {
  let version = 0
  const request = vi.fn(() => {
    version++
    return new Promise<never>(() => {})
  })
  const generator: WorldGenerator = { request, latestVersion: () => version }
  return { generator, sizes: () => request.mock.calls.map((c) => (c as unknown as [{ size: number }])[0].size) }
}

function setup(initial: Pin[] = [pin('a'), pin('b', 0.2, 0.3)]) {
  const gen = fakeGenerator()
  const world = createWorldStore(gen.generator)
  let n = 0
  const pins = createPinsStore(initial, { newId: () => `n${++n}` })
  const history = createWorldHistory({ world, pins })
  return { world, pins, history, gen }
}

describe('histórico do mundo (AC-F4-08)', () => {
  it('começa vazio, com Desfazer e Refazer indisponíveis', () => {
    const { history } = setup()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })

  it('desfaz e refaz criar, mover e excluir pins, um passo de cada vez', () => {
    const { pins, history } = setup()
    const original = pins.getState().pins
    pins.getState().addPin({ u: 0.1, v: 0.1 })
    pins.getState().dragTo('a', { u: 0.7, v: 0.8 })
    pins.getState().endDrag(true)
    pins.getState().removePin('b')
    expect(pins.getState().pins.map((p) => p.id)).toEqual(['a', 'n1'])

    history.undo()
    expect(pins.getState().pins.map((p) => p.id)).toEqual(['a', 'b', 'n1'])
    history.undo()
    expect(pins.getState().pins[0].pos).toEqual({ u: 0.5, v: 0.5 })
    history.undo()
    expect(pins.getState().pins).toBe(original)
    expect(history.canUndo()).toBe(false)

    history.redo()
    history.redo()
    expect(pins.getState().pins[0].pos).toEqual({ u: 0.7, v: 0.8 })
    history.redo()
    expect(pins.getState().pins.map((p) => p.id)).toEqual(['a', 'n1'])
    expect(history.canRedo()).toBe(false)
  })

  it('desfazer a exclusão devolve o pin com a ficha inteira, na mesma posição da lista (AC-F3-05)', () => {
    const { pins, history } = setup()
    const b = pins.getState().pins[1]
    pins.getState().select('b')
    expect(pins.getState().removePin('b')).toBe(b)
    // O pin excluído sai da seleção.
    expect(pins.getState().selectedId).toBeNull()
    history.undo()
    expect(pins.getState().pins[1]).toEqual(b)
  })

  it('o arrasto de um pin é um passo só, e soltar no mesmo lugar não vira passo', () => {
    const { pins, history } = setup()
    for (let i = 1; i <= 10; i++) pins.getState().dragTo('a', { u: 0.5 + i / 100, v: 0.5 })
    expect(history.canUndo()).toBe(false)
    pins.getState().endDrag(true)
    history.undo()
    expect(pins.getState().pins[0].pos).toEqual({ u: 0.5, v: 0.5 })
    expect(history.canUndo()).toBe(false)

    pins.getState().dragTo('a', { u: 0.5, v: 0.5 })
    pins.getState().endDrag(true)
    pins.getState().dragTo('a', { u: 0.9, v: 0.9 })
    pins.getState().endDrag(false)
    expect(pins.getState().pins[0].pos).toEqual({ u: 0.5, v: 0.5 })
    // O passo desfeito continua para refazer: nada novo entrou.
    expect(history.canRedo()).toBe(true)
  })

  it('as teclas seguidas no nome do mesmo pin viram um passo', () => {
    const { pins, history } = setup()
    for (const name of ['V', 'Va', 'Val', 'Vald']) pins.getState().rename('a', name)
    pins.getState().rename('b', 'Porto')
    history.undo()
    expect(pins.getState().pins.map((p) => p.name)).toEqual(['Vald', 'b'])
    history.undo()
    expect(pins.getState().pins.map((p) => p.name)).toEqual(['a', 'b'])
    expect(history.canUndo()).toBe(false)
  })

  it('parâmetros: o arrasto do slider entra ao soltar, e desfazer pede só o mapa final', () => {
    const { world, history, gen } = setup()
    world.getState().dragParams({ ocean: 30 })
    world.getState().dragParams({ ocean: 35 })
    expect(history.canUndo()).toBe(false)
    world.getState().releaseParams({ ocean: 40 })
    world.getState().setParams({ ...DEFAULT_WORLD_PARAMS, desert: 10 })
    expect(gen.sizes()).toEqual([PREVIEW_SIZE, PREVIEW_SIZE, MAP_SIZE, MAP_SIZE])

    history.undo()
    expect(world.getState().params).toEqual({ ...DEFAULT_WORLD_PARAMS, ocean: 40 })
    history.undo()
    expect(world.getState().params).toEqual(DEFAULT_WORLD_PARAMS)
    expect(gen.sizes().slice(4)).toEqual([MAP_SIZE, MAP_SIZE])
    history.redo()
    expect(world.getState().params.ocean).toBe(40)
  })

  it('pins e parâmetros dividem um histórico só, na ordem em que mudaram', () => {
    const { world, pins, history } = setup()
    world.getState().releaseParams({ ocean: 40 })
    pins.getState().removePin('a')
    world.getState().releaseParams({ mountains: 5 })

    history.undo()
    expect(world.getState().params.mountains).toBe(DEFAULT_WORLD_PARAMS.mountains)
    expect(pins.getState().pins).toHaveLength(1)
    history.undo()
    expect(pins.getState().pins).toHaveLength(2)
    expect(world.getState().params.ocean).toBe(40)
    history.undo()
    expect(world.getState().params.ocean).toBe(DEFAULT_WORLD_PARAMS.ocean)
  })

  it('uma mudança nova depois de desfazer apaga o que havia para refazer', () => {
    const { pins, history } = setup()
    pins.getState().removePin('a')
    history.undo()
    pins.getState().removePin('b')
    expect(history.canRedo()).toBe(false)
  })

  it('desfazer a criação tira o pin da seleção', () => {
    const { pins, history } = setup()
    pins.getState().addPin({ u: 0.1, v: 0.1 })
    expect(pins.getState().selectedId).toBe('n1')
    history.undo()
    expect(pins.getState()).toMatchObject({ selectedId: null, newPinId: null })
  })

  it('a versão sobe a cada passo novo, desfeito ou refeito', () => {
    const { pins, history } = setup()
    const v = () => history.version.getState().value
    pins.getState().removePin('a')
    expect(v()).toBe(1)
    history.undo()
    history.redo()
    expect(v()).toBe(3)
    // Sem nada para refazer, nada muda.
    history.redo()
    expect(v()).toBe(3)
  })

  it('depois do dispose, não ouve mais os stores', () => {
    const { pins, history } = setup()
    history.dispose()
    pins.getState().removePin('a')
    expect(history.canUndo()).toBe(false)
  })
})
