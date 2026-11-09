import { describe, expect, it } from 'vitest'
import { summarizeFrames } from './frameStats'

/** Quadros igualmente espaçados, a partir de `from`. */
const steady = (fps: number, seconds: number, from = 0) =>
  Array.from({ length: Math.round(fps * seconds) + 1 }, (_, i) => from + (i * 1000) / fps)

describe('summarizeFrames', () => {
  it('sem intervalos, devolve zeros', () => {
    expect(summarizeFrames([]).frames).toBe(0)
    expect(summarizeFrames([16]).minFps).toBe(0)
  })

  it('a 60 fps constantes, média e mínimo são 60', () => {
    const s = summarizeFrames(steady(60, 5))
    expect(s.frames).toBe(300)
    expect(s.avgFps).toBeCloseTo(60, 1)
    expect(s.minFps).toBeCloseTo(60, 0)
    expect(s.slowFrames).toBe(0)
  })

  it('o mínimo é a pior janela de 1 s, não a média', () => {
    const fast = steady(60, 5)
    const slow = steady(30, 2, fast[fast.length - 1]).slice(1)
    const end = slow[slow.length - 1]
    const after = steady(60, 5, end).slice(1)
    const s = summarizeFrames([...fast, ...slow, ...after])
    expect(s.avgFps).toBeGreaterThan(50)
    expect(s.minFps).toBeCloseTo(30, 0)
    expect(s.slowFrames).toBe(60)
  })

  it('registra o pior quadro', () => {
    const times = [...steady(60, 2)]
    const last = times[times.length - 1]
    times.push(last + 100, last + 116)
    expect(summarizeFrames(times).worstFrameMs).toBe(100)
  })

  it('com menos de 1 s, o mínimo é a média', () => {
    const s = summarizeFrames(steady(60, 0.5))
    expect(s.minFps).toBe(s.avgFps)
  })
})
