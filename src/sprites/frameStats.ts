import { TARGET_FPS, type FrameStats } from './report'

const WINDOW_MS = 1000
const round1 = (v: number) => Math.round(v * 10) / 10

/** Resume os instantes (em ms, crescentes) em que cada quadro começou. */
export function summarizeFrames(times: readonly number[]): FrameStats {
  const intervals = times.length - 1
  if (intervals < 1) return { frames: 0, durationMs: 0, avgFps: 0, minFps: 0, worstFrameMs: 0, slowFrames: 0 }

  const durationMs = times[intervals] - times[0]
  const slowLimit = 1000 / TARGET_FPS
  let worstFrameMs = 0
  let slowFrames = 0
  for (let i = 1; i < times.length; i++) {
    const dt = times[i] - times[i - 1]
    if (dt > worstFrameMs) worstFrameMs = dt
    if (dt > slowLimit) slowFrames++
  }

  const avgFps = durationMs > 0 ? (intervals * 1000) / durationMs : 0
  // Janela deslizante: para cada quadro final, o menor trecho de pelo menos 1 s que termina nele.
  let minFps = Number.POSITIVE_INFINITY
  let start = 0
  for (let end = 1; end < times.length; end++) {
    while (times[end] - times[start + 1] >= WINDOW_MS) start++
    const span = times[end] - times[start]
    if (span >= WINDOW_MS) minFps = Math.min(minFps, ((end - start) * 1000) / span)
  }
  // Medição com menos de 1 s (só no modo rápido): não há janela inteira, vale a média.
  if (minFps === Number.POSITIVE_INFINITY) minFps = avgFps

  return {
    frames: intervals,
    durationMs: round1(durationMs),
    avgFps: round1(avgFps),
    minFps: round1(minFps),
    worstFrameMs: round1(worstFrameMs),
    slowFrames,
  }
}
