import { describe, expect, it } from 'vitest'
import { createLatestOnly } from './latestOnly'

/** Um "worker" falso: cada pedido fica parado até o teste chamar `finish`. */
function fakeWorker() {
  const started: { req: string; version: number; finish: () => void; fail: (e: Error) => void }[] = []
  const run = (req: string, version: number) =>
    new Promise<string>((resolve, reject) => {
      started.push({ req, version, finish: () => resolve(`campo ${req}`), fail: reject })
    })
  return { run, started }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('cancelamento por versão (AC-M0-14)', () => {
  it('um pedido sozinho chega com a sua versão', async () => {
    const w = fakeWorker()
    const gen = createLatestOnly(w.run)
    const p = gen.request('a')
    expect(gen.latestVersion()).toBe(1)
    w.started[0].finish()
    await expect(p).resolves.toEqual({ version: 1, result: 'campo a' })
  })

  it('só o resultado mais novo chega: o em andamento é descartado e os da espera nem rodam', async () => {
    const w = fakeWorker()
    const gen = createLatestOnly(w.run)
    const a = gen.request('a')
    const b = gen.request('b')
    const c = gen.request('c')
    // O worker só recebeu o primeiro; b esperava e foi substituído por c.
    expect(w.started.map((s) => s.req)).toEqual(['a'])
    await expect(b).resolves.toBeNull()

    w.started[0].finish()
    await expect(a).resolves.toBeNull()
    await tick()
    expect(w.started.map((s) => s.req)).toEqual(['a', 'c'])
    expect(w.started[1].version).toBe(3)

    w.started[1].finish()
    await expect(c).resolves.toEqual({ version: 3, result: 'campo c' })
  })

  it('numa rajada de pedidos, o worker roda no máximo dois e só o último chega', async () => {
    const w = fakeWorker()
    const gen = createLatestOnly(w.run)
    const all = Array.from({ length: 20 }, (_, i) => gen.request(`s${i}`))
    w.started[0].finish()
    await tick()
    w.started[1].finish()
    const results = await Promise.all(all)
    expect(w.started.map((s) => s.req)).toEqual(['s0', 's19'])
    expect(results.filter((r) => r !== null)).toEqual([{ version: 20, result: 'campo s19' }])
  })

  it('um pedido que chega depois do anterior terminar roda normalmente', async () => {
    const w = fakeWorker()
    const gen = createLatestOnly(w.run)
    const a = gen.request('a')
    w.started[0].finish()
    await expect(a).resolves.not.toBeNull()
    const b = gen.request('b')
    w.started[1].finish()
    await expect(b).resolves.toEqual({ version: 2, result: 'campo b' })
  })

  it('o erro do pedido mais novo chega; o de um pedido substituído vira null', async () => {
    const w = fakeWorker()
    const gen = createLatestOnly(w.run)
    const a = gen.request('a')
    const b = gen.request('b')
    w.started[0].fail(new Error('falhou a'))
    await expect(a).resolves.toBeNull()
    await tick()
    w.started[1].fail(new Error('falhou b'))
    await expect(b).rejects.toThrow('falhou b')
  })
})
