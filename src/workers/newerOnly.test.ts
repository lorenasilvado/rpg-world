import { describe, expect, it } from 'vitest'
import { createNewerOnly } from './newerOnly'

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

describe('ordem de entrega (AC-F1-10)', () => {
  it('um pedido sozinho chega com a sua versão', async () => {
    const w = fakeWorker()
    const gen = createNewerOnly(w.run)
    const p = gen.request('a')
    expect(gen.latestVersion()).toBe(1)
    w.started[0].finish()
    await expect(p).resolves.toEqual({ version: 1, result: 'campo a' })
  })

  it('o pedido em andamento chega mesmo com pedidos mais novos; os da espera são substituídos', async () => {
    const w = fakeWorker()
    const gen = createNewerOnly(w.run)
    const a = gen.request('a')
    const b = gen.request('b')
    const c = gen.request('c')
    // O worker só recebeu o primeiro; b esperava e foi substituído por c.
    expect(w.started.map((s) => s.req)).toEqual(['a'])
    await expect(b).resolves.toBeNull()

    w.started[0].finish()
    await expect(a).resolves.toEqual({ version: 1, result: 'campo a' })
    await tick()
    expect(w.started.map((s) => s.req)).toEqual(['a', 'c'])
    expect(w.started[1].version).toBe(3)

    w.started[1].finish()
    await expect(c).resolves.toEqual({ version: 3, result: 'campo c' })
  })

  it('no arrasto, o mapa continua atualizando: cada geração que termina chega, em ordem', async () => {
    const w = fakeWorker()
    const gen = createNewerOnly(w.run)
    const delivered: number[] = []
    const all: Promise<unknown>[] = []
    // Pedidos mais rápidos que a geração: 5 pedidos por geração, durante 4 gerações.
    for (let round = 0; round < 4; round++) {
      for (let k = 0; k < 5; k++) {
        all.push(gen.request(`s${round}-${k}`).then((r) => r && delivered.push(r.version)))
      }
      w.started[round].finish()
      await tick()
    }
    w.started[4].finish()
    await Promise.all(all)
    // A 1ª geração é do 1º pedido; as outras, do último pedido de cada rodada.
    expect(w.started.map((s) => s.req)).toEqual(['s0-0', 's0-4', 's1-4', 's2-4', 's3-4'])
    // Toda entrega é mais nova que a anterior: um resultado velho nunca substitui um novo.
    expect(delivered).toEqual([1, 5, 10, 15, 20])
  })

  it('um pedido que chega depois do anterior terminar roda normalmente', async () => {
    const w = fakeWorker()
    const gen = createNewerOnly(w.run)
    const a = gen.request('a')
    w.started[0].finish()
    await expect(a).resolves.not.toBeNull()
    const b = gen.request('b')
    w.started[1].finish()
    await expect(b).resolves.toEqual({ version: 2, result: 'campo b' })
  })

  it('o erro do pedido mais novo chega; o de um pedido superado vira null', async () => {
    const w = fakeWorker()
    const gen = createNewerOnly(w.run)
    const a = gen.request('a')
    const b = gen.request('b')
    w.started[0].fail(new Error('falhou a'))
    await expect(a).resolves.toBeNull()
    await tick()
    w.started[1].fail(new Error('falhou b'))
    await expect(b).rejects.toThrow('falhou b')
  })
})
