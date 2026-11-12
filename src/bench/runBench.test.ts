import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Generator } from '../workers/generatorClient'
import { createFrameMonitor, timeCold } from './runBench'

/** Worker falso: `request` devolve o que `answer` mandar; conta os encerramentos. */
function fakeSpawn(answer: () => unknown) {
  const terminated: number[] = []
  let n = 0
  const spawn = () => {
    const id = n++
    return { request: async () => answer(), terminate: () => terminated.push(id) } as unknown as Generator
  }
  return { spawn, terminated, spawned: () => n }
}

const delivered = { version: 1, result: { workerMs: 12, memory: { cacheBytes: 10, fieldBytes: 5 } } }
const req = (i: number) => ({ seed: `s${i}`, size: 256, params: {} as never })

describe('timeCold (#36)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('mede cada geração num worker novo e encerra cada um', async () => {
    const { spawn, terminated, spawned } = fakeSpawn(() => delivered)
    const frames = createFrameMonitor()
    const memory = { cacheBytes: 0, fieldBytes: 0, worldBytes: 0 }
    const t = await timeCold(spawn, frames, memory, 3, req)
    frames.stop()
    expect(spawned()).toBe(3)
    expect(terminated).toEqual([0, 1, 2])
    expect(t.size).toBe(256)
    expect(t.runs).toHaveLength(3)
    expect(t.workerMedian).toBe(12)
    expect(memory.worldBytes).toBe(15)
  })

  it('falha se um worker novo voltar sem resultado, em vez de sair com o tempo no worker vazio', async () => {
    const { spawn, terminated } = fakeSpawn(() => null)
    const frames = createFrameMonitor()
    const memory = { cacheBytes: 0, fieldBytes: 0, worldBytes: 0 }
    await expect(timeCold(spawn, frames, memory, 2, req)).rejects.toThrow('worker novo voltou sem resultado')
    frames.stop()
    expect(terminated).toEqual([0])
  })
})
