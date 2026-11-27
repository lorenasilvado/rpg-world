import { expose } from 'comlink'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BIOME, type RouteField } from '../core'
import type { WorkerLike } from './generatorClient'
import { routerApi, type RouteRequest } from './routerApi'
import { createRouter, RouterWorkerError } from './routerClient'

type Listener = (event: Event) => void

/** Campo 64², todo planície, com uma ilha separada por oceano à direita. */
function island(): RouteField {
  const size = 64
  const biome = new Uint8Array(size * size).fill(BIOME.grassland)
  for (let y = 0; y < size; y++) for (let x = 40; x < size; x++) biome[y * size + x] = x > 50 ? BIOME.grassland : BIOME.deepOcean
  return { width: size, height: size, biome, elevation: new Float32Array(size * size).fill(0.5), rivers: [] }
}

const near: RouteRequest = { from: { u: 0.1, v: 0.5 }, to: { u: 0.5, v: 0.5 }, mode: 'land' }
const across: RouteRequest = { from: { u: 0.1, v: 0.5 }, to: { u: 0.9, v: 0.5 }, mode: 'land' }

/**
 * Worker falso: o `routerApi` de verdade, pelo Comlink num `MessageChannel`. `gate` segura cada
 * rota até o teste soltar; os eventos de falha o teste dispara com `emit`.
 */
function fakeWorker({ gate = false } = {}) {
  const { port1, port2 } = new MessageChannel()
  const held: (() => void)[] = []
  const calls: string[] = []
  const api = {
    setField: (field: RouteField) => {
      calls.push('setField')
      return routerApi.setField(field)
    },
    route: async (req: RouteRequest) => {
      calls.push('route')
      if (gate) await new Promise<void>((r) => held.push(r))
      return routerApi.route(req)
    },
    reset: () => routerApi.reset(),
  }
  expose(api, port2)
  port1.start()
  const listeners = new Map<string, Set<Listener>>()
  return {
    calls,
    /** Solta a próxima rota segurada, esperando ela chegar ao worker. */
    async release() {
      while (held.length === 0) await tick()
      held.shift()!()
    },
    postMessage: (message: unknown, transfer?: Transferable[]) => port1.postMessage(message, transfer ?? []),
    addEventListener(type: string, fn: Listener) {
      if (type === 'message') return port1.addEventListener('message', fn as never)
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
    },
    removeEventListener(type: string, fn: Listener) {
      if (type === 'message') return port1.removeEventListener('message', fn as never)
      listeners.get(type)?.delete(fn)
    },
    terminate: vi.fn(() => {
      port1.close()
      port2.close()
    }),
    emit(type: string, event: Event) {
      for (const fn of listeners.get(type) ?? []) fn(event)
    },
  }
}

type FakeWorker = ReturnType<typeof fakeWorker>

function routerWith(...workers: FakeWorker[]) {
  const spawned: FakeWorker[] = []
  const router = createRouter(() => {
    const w = workers.shift() ?? fakeWorker()
    spawned.push(w)
    return w as unknown as WorkerLike
  })
  return { router, spawned }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => routerApi.reset())

describe('routerApi', () => {
  it('sem o campo, a rota falha; com ele, devolve a rota ou null sem caminho', () => {
    expect(() => routerApi.route(near)).toThrow(/campo/)
    routerApi.setField(island())
    const ok = routerApi.route(near)
    expect(ok.route?.points[0]).toEqual(near.from)
    expect(ok.workerMs).toBeGreaterThanOrEqual(0)
    expect(routerApi.route(across).route).toBeNull()
    expect(routerApi.route({ from: { u: 0.58, v: 0.5 }, to: { u: 0.85, v: 0.5 }, mode: 'sea' }).route).not.toBeNull()
  })

  it('connect devolve a malha entre as cidades, e a da ilha fica de fora (AC-F5-14)', () => {
    const cities = [
      { u: 0.1, v: 0.2 },
      { u: 0.9, v: 0.5 },
      { u: 0.3, v: 0.8 },
    ]
    expect(() => routerApi.connect({ cities, groups: [0, 1, 2] })).toThrow(/campo/)
    routerApi.setField(island())
    const { network, workerMs } = routerApi.connect({ cities, groups: [0, 1, 2] })
    expect(network.links.map((l) => [l.from, l.to])).toEqual([[0, 2]])
    expect(network.isolated).toEqual([1])
    expect(workerMs).toBeGreaterThanOrEqual(0)
  })
})

describe('createRouter', () => {
  it('manda o campo e depois as rotas, uma de cada vez', async () => {
    const { router, spawned } = routerWith()
    await router.setField(island())
    const [a, b] = await Promise.all([router.route(near), router.route(across)])
    expect(a.route).not.toBeNull()
    expect(b.route).toBeNull()
    expect(spawned[0].calls).toEqual(['setField', 'route', 'route'])
    expect(router.pendingCalls()).toBe(0)
    router.terminate()
  })

  it('a rota cancelada na fila não chega ao worker, e a do worker rejeita na hora', async () => {
    const w = fakeWorker({ gate: true })
    const { router } = routerWith(w)
    await router.setField(island())
    const first = new AbortController()
    const second = new AbortController()
    const p1 = router.route(near, { signal: first.signal })
    const p2 = router.route(near, { signal: second.signal })
    const p3 = router.route(near)
    while (w.calls.length < 2) await tick()
    second.abort()
    await expect(p2).rejects.toMatchObject({ name: 'AbortError' })
    first.abort()
    await expect(p1).rejects.toMatchObject({ name: 'AbortError' })
    // A primeira ainda roda no worker: a terceira espera por ela.
    await w.release()
    await w.release()
    expect((await p3).route).not.toBeNull()
    expect(w.calls).toEqual(['setField', 'route', 'route'])
    router.terminate()
  })

  it('o signal já cancelado rejeita sem pedir nada', async () => {
    const { router, spawned } = routerWith()
    const c = new AbortController()
    c.abort()
    await expect(router.route(near, { signal: c.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(spawned).toHaveLength(0)
  })

  it('se o worker falha, os pedidos rejeitam e o próximo worker recebe de novo o campo', async () => {
    const broken = fakeWorker({ gate: true })
    const { router, spawned } = routerWith(broken)
    await router.setField(island())
    const pending = [router.route(near), router.route(near)]
    while (broken.calls.length < 2) await tick()
    broken.emit('error', new ErrorEvent('error', { message: 'caiu' }))
    for (const p of pending) await expect(p).rejects.toBeInstanceOf(RouterWorkerError)
    expect(broken.terminate).toHaveBeenCalled()
    const again = await router.route(near)
    expect(again.route).not.toBeNull()
    expect(spawned).toHaveLength(2)
    expect(spawned[1].calls).toEqual(['setField', 'route'])
    router.terminate()
  })

  it('o campo novo substitui o anterior no worker', async () => {
    const { router, spawned } = routerWith()
    await router.setField(island())
    expect((await router.route(across)).route).toBeNull()
    const open = island()
    open.biome.fill(BIOME.grassland)
    await router.setField(open)
    expect((await router.route(across)).route).not.toBeNull()
    expect(spawned[0].calls).toEqual(['setField', 'route', 'setField', 'route'])
    router.terminate()
  })
  it('se o worker não pode ser criado, o pedido falha e a fila segue', async () => {
    let first = true
    const router = createRouter(() => {
      if (first) {
        first = false
        throw new Error('sem worker')
      }
      return fakeWorker() as unknown as WorkerLike
    })
    await expect(router.setField(island())).rejects.toBeInstanceOf(RouterWorkerError)
    expect(router.pendingCalls()).toBe(0)
    // O campo do pedido que falhou vai antes da rota, no worker que agora foi criado.
    expect((await router.route(near)).route).not.toBeNull()
    router.terminate()
  })

  it('um campo que falha tira a grade anterior: a rota seguinte falha, em vez de usar o mapa velho', async () => {
    const { router } = routerWith()
    await router.setField(island())
    const notSquare: RouteField = { ...island(), height: 32 }
    await expect(router.setField(notSquare)).rejects.toThrow(/quadrado/)
    await expect(router.route(near)).rejects.toThrow(/campo/)
    router.terminate()
  })
})
