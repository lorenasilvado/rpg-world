import { generateField, hashField } from '../core'
import type { Generator } from '../workers/generatorClient'
import { MAP_SIZE, PREVIEW_SIZE, TARGETS, type BenchReport, type Timing } from './report'

/**
 * Medição do spike de desempenho (#9, RNF-2): tempos da prévia 256² e do mapa 1024² gerados no
 * worker, transferência sem cópia, cancelamento por versão e se a UI continua respondendo.
 */
export { MAP_SIZE, PREVIEW_SIZE, TARGETS, type BenchReport, type Timing } from './report'

export type BenchOptions = { previewRuns: number; mapRuns: number; dragRequests: number; mainThread: boolean }

export const FULL: BenchOptions = { previewRuns: 10, mapRuns: 5, dragRequests: 40, mainThread: true }
export const QUICK: BenchOptions = { previewRuns: 2, mapRuns: 1, dragRequests: 10, mainThread: false }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const round = (x: number) => Math.round(x * 10) / 10

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r))
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Observa os quadros da UI: `maxGap` é o maior intervalo entre dois quadros desde `reset`. */
export function createFrameMonitor() {
  let last = 0
  let maxGap = 0
  let running = true
  const loop = (t: number) => {
    if (last) maxGap = Math.max(maxGap, t - last)
    last = t
    if (running) requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  return {
    /** Zera o maior intervalo. O último quadro fica: um travamento logo depois do reset conta. */
    reset() {
      maxGap = 0
    },
    get maxGap() {
      return maxGap
    },
    stop() {
      running = false
    },
  }
}

type FrameMonitor = ReturnType<typeof createFrameMonitor>

async function time(gen: Generator, frames: FrameMonitor, size: number, runs: number, label: string): Promise<Timing> {
  // Aquecimento: a primeira geração inclui o JIT do worker e não conta.
  await gen.request({ seed: `${label}-aquecimento`, size })
  const roundTrips: number[] = []
  const inWorker: number[] = []
  await nextFrame()
  frames.reset()
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    const r = await gen.request({ seed: `${label}-${i}`, size })
    roundTrips.push(performance.now() - start)
    if (r) inWorker.push(r.result.workerMs)
  }
  await nextFrame()
  return {
    size,
    runs: roundTrips.map(round),
    median: round(median(roundTrips)),
    max: round(Math.max(...roundTrips)),
    workerMedian: round(median(inWorker)),
    maxFrameGap: round(frames.maxGap),
  }
}

/** Simula o arrasto de um slider: um pedido de prévia a cada 8 ms, sem esperar os resultados. */
async function drag(gen: Generator, requests: number): Promise<BenchReport['drag']> {
  const deliveries: { version: number; latestAtDelivery: number; seed: string; hash: string }[] = []
  const pending: Promise<unknown>[] = []
  let lastSeed = ''
  for (let i = 0; i < requests; i++) {
    lastSeed = `arrasto-${i}`
    pending.push(
      gen.request({ seed: lastSeed, size: PREVIEW_SIZE }).then((r) => {
        if (r) deliveries.push({ version: r.version, latestAtDelivery: gen.latestVersion(), seed: r.result.seed, hash: hashField(r.result.field) })
      }),
    )
    await wait(8)
  }
  await Promise.all(pending)
  const last = deliveries.at(-1)
  return {
    sent: requests,
    delivered: deliveries.length,
    onlyLatest: deliveries.every((d) => d.version === d.latestAtDelivery),
    lastDeliveredVersion: last?.version ?? 0,
    lastVersion: gen.latestVersion(),
    lastFieldMatches: last?.seed === lastSeed && last.hash === hashField(generateField(lastSeed, PREVIEW_SIZE)),
  }
}

async function onMainThread(frames: FrameMonitor): Promise<NonNullable<BenchReport['mainThread']>> {
  await nextFrame()
  frames.reset()
  const start = performance.now()
  generateField('thread-principal', MAP_SIZE)
  const ms = performance.now() - start
  await nextFrame()
  return { ms: round(ms), maxFrameGap: round(frames.maxGap) }
}

export async function runBench(
  gen: Generator,
  options: BenchOptions,
  onStep: (step: string) => void = () => {},
): Promise<BenchReport> {
  const frames = createFrameMonitor()
  let visible = document.visibilityState === 'visible'
  const onVisibility = () => (visible &&= document.visibilityState === 'visible')
  document.addEventListener('visibilitychange', onVisibility)
  try {
    onStep(`Prévia ${PREVIEW_SIZE}² (${options.previewRuns}×)`)
    const preview = await time(gen, frames, PREVIEW_SIZE, options.previewRuns, 'previa')
    onStep(`Mapa ${MAP_SIZE}² (${options.mapRuns}×)`)
    const map = await time(gen, frames, MAP_SIZE, options.mapRuns, 'mapa')
    const transferred = await gen.api.lastResultTransferred()
    onStep(`Arrasto: ${options.dragRequests} pedidos de prévia`)
    const dragReport = await drag(gen, options.dragRequests)
    let mainThread = null
    if (options.mainThread) {
      onStep(`Referência: ${MAP_SIZE}² na thread principal`)
      mainThread = await onMainThread(frames)
    }
    return {
      machine: { userAgent: navigator.userAgent, cores: navigator.hardwareConcurrency },
      visible,
      targets: TARGETS,
      preview,
      map,
      transferred,
      drag: dragReport,
      mainThread,
    }
  } finally {
    frames.stop()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
