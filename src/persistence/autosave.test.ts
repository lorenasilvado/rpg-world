import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_PARAMS, GENERATOR_VERSION } from '../core'
import { createPinsStore } from '../state/pinsStore'
import { createRoadsStore } from '../state/roadsStore'
import { createWorldStore, type WorldGenerator } from '../state/worldStore'
import { createAutosave, SAVE_DELAY_MS } from './autosave'
import type { World } from './types'

/** Gerador que nunca entrega: o salvamento não depende do mapa. */
const generator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

const NOW = new Date('2026-11-21T12:00:00.000Z')

function setup(save: (w: World) => Promise<void> = () => Promise.resolve(), loaded?: World) {
  let ids = 0
  const world = createWorldStore(
    generator,
    loaded ? { id: loaded.id, createdAt: loaded.createdAt, name: loaded.name, seed: loaded.seed, params: loaded.params } : { id: 'w1', createdAt: '2026-11-20T09:00:00.000Z' },
    { newId: () => `novo-${++ids}`, now: () => NOW },
  )
  const repo = { save: vi.fn(save) }
  const autosave = createAutosave({ world, repo, loaded, now: () => NOW })
  return { world, repo, autosave, status: () => autosave.store.getState().status }
}

/** Deixa as promessas pendentes andarem (a gravação no repo). */
const settle = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('salvamento automático (AC-F4-01, AC-F4-02)', () => {
  it('começa em "Salvo" e não grava sem mudança', async () => {
    const { repo, status } = setup()
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
    expect(status()).toBe('saved')
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('cada mudança mostra "Salvando…" e grava depois da pausa, uma vez só', async () => {
    const { world, repo, status } = setup()
    world.getState().dragParams({ ocean: 50 })
    expect(status()).toBe('saving')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1)
    world.getState().dragParams({ ocean: 55 })
    world.getState().releaseParams({ ocean: 60 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1)
    expect(repo.save).not.toHaveBeenCalled()
    expect(status()).toBe('saving')
    await vi.advanceTimersByTimeAsync(1)
    expect(repo.save).toHaveBeenCalledTimes(1)
    expect(repo.save.mock.calls[0][0].params.ocean).toBe(60)
    expect(status()).toBe('saved')
  })

  it('grava o nome, a seed e os parâmetros', async () => {
    const { world, repo } = setup()
    world.getState().setSeed('brumas-1a2b')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    world.getState().setParams({ ...DEFAULT_WORLD_PARAMS, desert: 40 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(repo.save).toHaveBeenCalledTimes(2)
    const last = repo.save.mock.calls[1][0]
    expect(last.seed).toBe('brumas-1a2b')
    expect(last.params.desert).toBe(40)
    expect(last.name).toBe('Terras de Valdora')
  })

  it('o mundo salvo guarda só seed, parâmetros, pins, estradas, sizeKm e generatorVersion, além da identidade (AC-F4-03)', async () => {
    const { world, repo } = setup()
    world.getState().releaseParams({ ocean: 30 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    const record = repo.save.mock.calls[0][0]
    expect(Object.keys(record).sort()).toEqual(
      ['createdAt', 'generatorVersion', 'id', 'name', 'params', 'pins', 'roads', 'seed', 'sizeKm', 'updatedAt'].sort(),
    )
    expect(record).toEqual({
      id: 'w1',
      name: 'Terras de Valdora',
      seed: 'rpg-world',
      generatorVersion: GENERATOR_VERSION,
      sizeKm: 800,
      params: { ...DEFAULT_WORLD_PARAMS, ocean: 30 },
      pins: [],
      roads: [],
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: NOW.toISOString(),
    })
  })

  it('um mundo novo do assistente é gravado com outro id e sem pins', async () => {
    const loaded: World = {
      id: 'velho',
      name: 'Antigo',
      seed: 's',
      generatorVersion: GENERATOR_VERSION,
      sizeKm: 800,
      params: { ...DEFAULT_WORLD_PARAMS },
      pins: [
        { id: 'p', type: 'Cidade', name: 'X', pos: { u: 0, v: 0 }, icon: { kind: 'builtin', key: 'k' }, description: '', tags: [], fields: {} },
      ],
      roads: [],
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    }
    const { world, repo } = setup(undefined, loaded)
    world.getState().setSeed('outra')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(repo.save.mock.calls[0][0]).toMatchObject({ id: 'velho', pins: loaded.pins, createdAt: loaded.createdAt })
    world.getState().createWorld({ name: 'Brumas', seed: 'b', params: DEFAULT_WORLD_PARAMS })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(repo.save.mock.calls[1][0]).toMatchObject({ id: 'novo-1', name: 'Brumas', pins: [], createdAt: NOW.toISOString() })
  })

  it('se a gravação falha, mostra "Erro ao salvar" e tenta de novo na próxima mudança', async () => {
    let fail = true
    const { world, repo, status, autosave } = setup(() => (fail ? Promise.reject(new Error('cota')) : Promise.resolve()))
    world.getState().releaseParams({ ocean: 30 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(status()).toBe('error')
    expect(autosave.store.getState().error).toEqual(new Error('cota'))
    world.getState().releaseParams({ ocean: 31 })
    expect(status()).toBe('saving')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(repo.save).toHaveBeenCalledTimes(2)
    expect(status()).toBe('error')
    fail = false
    world.getState().releaseParams({ ocean: 32 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(status()).toBe('saved')
    expect(autosave.store.getState().error).toBeNull()
  })

  it('"Tentar de novo" (retry) grava já', async () => {
    let fail = true
    const { world, repo, status, autosave } = setup(() => (fail ? Promise.reject(new Error('x')) : Promise.resolve()))
    world.getState().releaseParams({ ocean: 30 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(status()).toBe('error')
    fail = false
    autosave.store.getState().retry()
    expect(status()).toBe('saving')
    await settle()
    expect(repo.save).toHaveBeenCalledTimes(2)
    expect(repo.save.mock.calls[1][0].params.ocean).toBe(30)
    expect(status()).toBe('saved')
  })

  it('as gravações vão em ordem, uma de cada vez, e a última decide o status', async () => {
    const pending: (() => void)[] = []
    const { world, repo, status, autosave } = setup(() => new Promise<void>((resolve) => pending.push(resolve)))
    world.getState().releaseParams({ ocean: 30 })
    void autosave.flush()
    world.getState().releaseParams({ ocean: 31 })
    void autosave.flush()
    await settle()
    // A segunda espera a primeira terminar.
    expect(repo.save).toHaveBeenCalledTimes(1)
    pending.shift()!()
    await settle()
    expect(status()).toBe('saving')
    expect(repo.save).toHaveBeenCalledTimes(2)
    expect(repo.save.mock.calls[1][0].params.ocean).toBe(31)
    pending.shift()!()
    await settle()
    expect(status()).toBe('saved')
  })

  it('flush grava já o que esperava a pausa; dispose para de ouvir', async () => {
    const { world, repo, autosave } = setup()
    world.getState().releaseParams({ ocean: 30 })
    await autosave.flush()
    expect(repo.save).toHaveBeenCalledTimes(1)
    autosave.dispose()
    world.getState().releaseParams({ ocean: 31 })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
    expect(repo.save).toHaveBeenCalledTimes(1)
  })

  it('criar e renomear um pin grava os pins do mundo, que o mundo reaberto traz de volta (AC-F3-01)', async () => {
    const world = createWorldStore(generator, { id: 'w1', createdAt: '2026-11-20T09:00:00.000Z' })
    const pins = createPinsStore([], { newId: () => 'p1' })
    const repo = { save: vi.fn((_w: World) => Promise.resolve()) }
    const autosave = createAutosave({ world, pins, repo, now: () => NOW })
    pins.getState().addPin({ u: 0.3, v: 0.6 })
    expect(autosave.store.getState().status).toBe('saving')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(repo.save.mock.calls[0][0].pins).toEqual([expect.objectContaining({ id: 'p1', name: 'Novo pin', pos: { u: 0.3, v: 0.6 } })])
    pins.getState().rename('p1', 'Valdora')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(repo.save.mock.calls[1][0].pins[0].name).toBe('Valdora')
    // Selecionar e passar o mouse não gravam.
    pins.getState().select(null)
    pins.getState().setHovered('p1')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
    expect(repo.save).toHaveBeenCalledTimes(2)
    autosave.dispose()
  })

  it('mudar as estradas grava as estradas do store, e excluir um pin grava sem as ligadas a ele (AC-F5-02)', async () => {
    const world = createWorldStore(generator, { id: 'w1', createdAt: '2026-11-20T09:00:00.000Z' })
    const pin = { id: 'a', type: 'cidade', name: 'A', pos: { u: 0.5, v: 0.5 }, icon: { kind: 'builtin' as const, key: 'cidade' }, description: '', tags: [], fields: {} }
    const pins = createPinsStore([pin])
    const road = { id: 'r', name: 'Estrada Real', kind: 'road' as const, points: [{ u: 0.1, v: 0.1 }, { u: 0.5, v: 0.5 }], to: 'a' }
    const roads = createRoadsStore([], pins)
    const repo = { save: vi.fn((_w: World) => Promise.resolve()) }
    const autosave = createAutosave({ world, pins, roads, repo, now: () => NOW })
    roads.getState().replaceRoads([road])
    expect(autosave.store.getState().status).toBe('saving')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(repo.save.mock.calls[0][0].roads).toEqual([road])
    pins.getState().removePin('a')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(repo.save).toHaveBeenCalledTimes(2)
    expect(repo.save.mock.calls[1][0]).toMatchObject({ pins: [], roads: [] })
    autosave.dispose()
  })
})

