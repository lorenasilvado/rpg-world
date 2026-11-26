import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_PARAMS, type CoreField } from '../../core'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import type { Router } from '../../workers/routerClient'
import { createWorldRouter } from './worldRouter'

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }
const field = (width: number) => ({ width, height: width }) as unknown as CoreField

function fakeRouter() {
  const r = {
    setField: vi.fn(() => Promise.resolve({ gridMs: 1 })),
    route: vi.fn(() => Promise.resolve({ route: null, workerMs: 1 })),
    terminate: vi.fn(),
    pendingCalls: () => 0,
  }
  return r as typeof r & Router
}

describe('worker de rota do mundo (AC-F5-12)', () => {
  it('só cria o worker na primeira rota, com o mapa final, e manda cada mapa final novo (sem as prévias)', async () => {
    const world = createWorldStore(idleGenerator, { params: DEFAULT_WORLD_PARAMS })
    const first = field(1024)
    world.setState({ field: first })
    const r = fakeRouter()
    const make = vi.fn(() => r)
    const router = createWorldRouter(world, make)
    expect(make).not.toHaveBeenCalled()
    await router.route({ from: { u: 0.1, v: 0.1 }, to: { u: 0.9, v: 0.9 }, mode: 'land' })
    expect(make).toHaveBeenCalledTimes(1)
    expect(r.setField).toHaveBeenCalledWith(first)
    world.setState({ field: field(256) })
    expect(r.setField).toHaveBeenCalledTimes(1)
    const next = field(1024)
    world.setState({ field: next })
    expect(r.setField).toHaveBeenLastCalledWith(next)
    await router.route({ from: { u: 0.1, v: 0.1 }, to: { u: 0.9, v: 0.9 }, mode: 'land' })
    expect(make).toHaveBeenCalledTimes(1)
    router.dispose()
    expect(r.terminate).toHaveBeenCalled()
    // Depois de encerrado, os mapas novos não vão a ninguém.
    world.setState({ field: field(1024) })
    expect(r.setField).toHaveBeenCalledTimes(2)
  })
})
