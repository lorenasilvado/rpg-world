import { expose } from 'comlink'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GenerateRequest } from './generatorApi'
import { createGenerator, GeneratorWorkerError, type WorkerLike } from './generatorClient'

type Listener = (event: Event) => void

/**
 * Worker falso: as mensagens do Comlink passam por um `MessageChannel` de verdade; os eventos de
 * falha (`error`, `messageerror`) o teste dispara com `emit`. Com `hang`, o worker nunca responde,
 * como um worker que não carregou.
 */
function fakeWorker({ hang = false } = {}) {
  const { port1, port2 } = new MessageChannel()
  const api = {
    generate: (req: GenerateRequest) => ({ seed: req.seed, size: req.size }),
    lastResultTransferred: () => true,
  }
  if (!hang) expose(api, port2)
  port1.start()
  const listeners = new Map<string, Set<Listener>>()
  const worker = {
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
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  }
  return worker
}

type FakeWorker = ReturnType<typeof fakeWorker>

/** Cria o gerador com uma fila de workers falsos; `spawned` guarda os que ele criou. */
function generatorWith(...workers: FakeWorker[]) {
  const spawned: FakeWorker[] = []
  const gen = createGenerator(() => {
    const w = workers.shift() ?? fakeWorker()
    spawned.push(w)
    return w as unknown as WorkerLike
  })
  return { gen, spawned }
}

const req = (seed: string): GenerateRequest => ({ seed, size: 8 })
const tick = () => new Promise((r) => setTimeout(r, 0))

let toClose: { terminate(): void }[] = []
afterEach(() => {
  toClose.forEach((g) => g.terminate())
  toClose = []
})

describe('falha do worker de geração (AC-F1-12)', () => {
  it('com o worker funcionando, o pedido chega', async () => {
    const { gen, spawned } = generatorWith()
    toClose.push(gen)
    await expect(gen.request(req('a'))).resolves.toMatchObject({ version: 1, result: { seed: 'a' } })
    await expect(gen.lastResultTransferred()).resolves.toBe(true)
    expect(spawned).toHaveLength(1)
  })

  it('um worker que não carrega rejeita o pedido em andamento, em vez de deixá-lo esperando', async () => {
    const broken = fakeWorker({ hang: true })
    const { gen } = generatorWith(broken)
    toClose.push(gen)
    const pending = gen.request(req('a'))
    await tick()
    broken.emit('error', new ErrorEvent('error', { message: 'Failed to fetch worker script' }))
    await expect(pending).rejects.toBeInstanceOf(GeneratorWorkerError)
    await expect(pending).rejects.toThrow('Failed to fetch worker script')
    expect(broken.terminate).toHaveBeenCalled()
    expect(broken.listenerCount()).toBe(0)
  })

  it('um erro sem mensagem (como o de um script que não carregou) também rejeita', async () => {
    const broken = fakeWorker({ hang: true })
    const { gen } = generatorWith(broken)
    toClose.push(gen)
    const pending = gen.request(req('a'))
    broken.emit('error', new Event('error'))
    await expect(pending).rejects.toThrow('o worker de geração falhou')
  })

  it('uma mensagem que não dá para ler (messageerror) rejeita o pedido', async () => {
    const broken = fakeWorker({ hang: true })
    const { gen } = generatorWith(broken)
    toClose.push(gen)
    const pending = gen.request(req('a'))
    broken.emit('messageerror', new MessageEvent('messageerror'))
    await expect(pending).rejects.toBeInstanceOf(GeneratorWorkerError)
    expect(broken.terminate).toHaveBeenCalled()
  })

  it('depois da falha, o próximo pedido ("Tentar de novo") cria um worker novo e chega', async () => {
    const broken = fakeWorker({ hang: true })
    const { gen, spawned } = generatorWith(broken)
    toClose.push(gen)
    const first = gen.request(req('a'))
    broken.emit('error', new Event('error'))
    await expect(first).rejects.toBeInstanceOf(GeneratorWorkerError)

    await expect(gen.request(req('a'))).resolves.toMatchObject({ version: 2, result: { seed: 'a' } })
    expect(spawned).toHaveLength(2)
  })

  it('com um pedido mais novo na espera, o que falhou vira null e o mais novo roda num worker novo', async () => {
    const broken = fakeWorker({ hang: true })
    const { gen, spawned } = generatorWith(broken)
    toClose.push(gen)
    const a = gen.request(req('a'))
    const b = gen.request(req('b'))
    broken.emit('error', new Event('error'))
    await expect(a).resolves.toBeNull()
    await expect(b).resolves.toMatchObject({ version: 2, result: { seed: 'b' } })
    expect(spawned).toHaveLength(2)
  })

  it('sem worker (antes do primeiro pedido ou depois de uma falha), lastResultTransferred rejeita sem criar um', async () => {
    const broken = fakeWorker({ hang: true })
    const { gen, spawned } = generatorWith(broken)
    toClose.push(gen)
    await expect(gen.lastResultTransferred()).rejects.toBeInstanceOf(GeneratorWorkerError)
    expect(spawned).toHaveLength(0)

    const pending = gen.request(req('a'))
    broken.emit('error', new Event('error'))
    await expect(pending).rejects.toBeInstanceOf(GeneratorWorkerError)
    await expect(gen.lastResultTransferred()).rejects.toBeInstanceOf(GeneratorWorkerError)
    expect(spawned).toHaveLength(1)
  })

  it('pedidos resolvidos não ficam presos na conexão (sem vazar os resultados)', async () => {
    const { gen } = generatorWith()
    toClose.push(gen)
    for (let i = 0; i < 5; i++) await gen.request(req(`s${i}`))
    await gen.lastResultTransferred()
    expect(gen.pendingCalls()).toBe(0)
  })

  it('o pedido em andamento fica na conexão até o worker falhar, e sai dela na falha', async () => {
    const broken = fakeWorker({ hang: true })
    const { gen } = generatorWith(broken)
    toClose.push(gen)
    const pending = gen.request(req('a'))
    expect(gen.pendingCalls()).toBe(1)
    broken.emit('error', new Event('error'))
    await expect(pending).rejects.toBeInstanceOf(GeneratorWorkerError)
    expect(gen.pendingCalls()).toBe(0)
  })

  it('um erro depois do worker descartado não afeta o worker novo', async () => {
    const broken = fakeWorker({ hang: true })
    const { gen, spawned } = generatorWith(broken)
    toClose.push(gen)
    const first = gen.request(req('a'))
    broken.emit('error', new Event('error'))
    await expect(first).rejects.toBeInstanceOf(GeneratorWorkerError)
    const second = gen.request(req('b'))
    broken.emit('error', new Event('error'))
    await expect(second).resolves.toMatchObject({ result: { seed: 'b' } })
    expect(spawned[1].terminate).not.toHaveBeenCalled()
  })
})
