import { DEFAULT_WORLD_PARAMS, generateField, hashField, type WorldParams } from '../core'
import { createWorldStore, type WorldState } from '../state/worldStore'
import type { GenerateRequest } from '../workers/generatorApi'
import { createGenerator, type Generator } from '../workers/generatorClient'
import { MAP_SIZE, PREVIEW_SIZE, TARGETS, type BenchReport, type Timing } from './report'

/**
 * Medição de desempenho (#9, #45, #36; RNF-2, AC-F1-09 a 11): tempos da prévia 256² e do mapa 1024²
 * com o pipeline completo num worker recém-criado (sem aquecimento) e no worker já aquecido, sem
 * cache e com o cache do ruído; memória do mundo;
 * transferência sem cópia; o arrasto de um slider pelo `worldStore`; e se a UI continua
 * respondendo.
 */
export { MAP_SIZE, PREVIEW_SIZE, TARGETS, type BenchReport, type Timing } from './report'

export type BenchOptions = {
  /** Gerações num worker recém-criado, um worker por geração, em cada tamanho. */
  coldRuns: number
  previewRuns: number
  mapRuns: number
  dragRequests: number
  mainThread: boolean
}

export const FULL: BenchOptions = { coldRuns: 3, previewRuns: 10, mapRuns: 5, dragRequests: 40, mainThread: true }
export const QUICK: BenchOptions = { coldRuns: 1, previewRuns: 2, mapRuns: 1, dragRequests: 10, mainThread: false }

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

/** Maior memória do mundo vista nos resultados. */
type Memory = BenchReport['memory']

/** Guarda em `memory` a maior memória do mundo vista. */
function trackMemory(memory: Memory, { cacheBytes, fieldBytes }: Pick<Memory, 'cacheBytes' | 'fieldBytes'>) {
  if (cacheBytes + fieldBytes > memory.worldBytes) {
    Object.assign(memory, { cacheBytes, fieldBytes, worldBytes: cacheBytes + fieldBytes })
  }
}

function summarize(size: number, roundTrips: number[], inWorker: number[], frames: FrameMonitor): Timing {
  return {
    size,
    runs: roundTrips.map(round),
    median: round(median(roundTrips)),
    max: round(Math.max(...roundTrips)),
    workerMedian: round(median(inWorker)),
    maxFrameGap: round(frames.maxGap),
  }
}

/**
 * Mede `runs` gerações, cada uma num worker recém-criado (`spawn`), sem aquecimento: o tempo inclui
 * criar o worker e carregar o módulo dele. O worker é encerrado depois de cada geração.
 */
async function timeCold(
  spawn: () => Generator,
  frames: FrameMonitor,
  memory: Memory,
  runs: number,
  request: (i: number) => GenerateRequest,
): Promise<Timing> {
  const roundTrips: number[] = []
  const inWorker: number[] = []
  await nextFrame()
  frames.reset()
  for (let i = 0; i < runs; i++) {
    const gen = spawn()
    try {
      const start = performance.now()
      const r = await gen.request(request(i))
      roundTrips.push(performance.now() - start)
      if (r) {
        inWorker.push(r.result.workerMs)
        trackMemory(memory, r.result.memory)
      }
    } finally {
      gen.terminate()
    }
  }
  await nextFrame()
  return summarize(request(0).size, roundTrips, inWorker, frames)
}

/** Mede `runs` gerações, depois de uma de aquecimento (`warmup`), que não conta. */
async function time(
  gen: Generator,
  frames: FrameMonitor,
  memory: Memory,
  warmup: GenerateRequest,
  runs: number,
  request: (i: number) => GenerateRequest,
): Promise<Timing> {
  await gen.request(warmup)
  const roundTrips: number[] = []
  const inWorker: number[] = []
  await nextFrame()
  frames.reset()
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    const r = await gen.request(request(i))
    roundTrips.push(performance.now() - start)
    if (r) {
      inWorker.push(r.result.workerMs)
      trackMemory(memory, r.result.memory)
    }
  }
  await nextFrame()
  return summarize(request(0).size, roundTrips, inWorker, frames)
}

/** Espera o store sair de `generating` (o pedido mais novo chegou, ou falhou). */
function settled(store: ReturnType<typeof createWorldStore>): Promise<WorldState> {
  return new Promise((resolve) => {
    const check = (s: WorldState) => {
      if (s.status === 'generating') return false
      unsubscribe()
      resolve(s)
      return true
    }
    const unsubscribe = store.subscribe(check)
    check(store.getState())
  })
}

/**
 * Simula o arrasto de um slider pelo `worldStore`: o mapa final já está na tela, e o Oceano muda a
 * cada 8 ms, sem esperar os resultados. Depois, solta o slider e espera o mapa final.
 */
async function drag(gen: Generator, requests: number): Promise<BenchReport['drag']> {
  const seed = 'arrasto'
  const store = createWorldStore(gen, { seed })
  store.getState().generate()
  await settled(store)

  const paramsByVersion = new Map<number, WorldParams>()
  const shown: { version: number; size: number; whileDragging: boolean }[] = []
  let dragging = true
  const unsubscribe = store.subscribe((s, prev) => {
    if (s.field !== prev.field && s.field) shown.push({ version: s.fieldVersion, size: s.field.width, whileDragging: dragging })
  })
  for (let i = 0; i < requests; i++) {
    store.getState().dragParams({ ocean: 30 + (i % 40) })
    paramsByVersion.set(gen.latestVersion(), store.getState().params)
    await wait(8)
  }
  const lastPreview = store.getState()
  const lastPreviewParams = paramsByVersion.get(lastPreview.fieldVersion)
  dragging = false
  store.getState().releaseParams()
  const final = await settled(store)
  unsubscribe()

  const previewMatches =
    lastPreview.field?.width === PREVIEW_SIZE &&
    lastPreviewParams !== undefined &&
    hashField(lastPreview.field) === hashField(generateField(seed, PREVIEW_SIZE, lastPreviewParams))
  return {
    sent: requests,
    delivered: shown.length,
    duringDrag: shown.filter((s) => s.whileDragging).length,
    inOrder: shown.every((s, k) => k === 0 || s.version > shown[k - 1].version),
    previewMatches,
    release: {
      size: final.field?.width ?? 0,
      version: final.fieldVersion,
      lastVersion: gen.latestVersion(),
      matches: final.field !== null && hashField(final.field) === hashField(generateField(seed, MAP_SIZE, final.params)),
    },
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

/**
 * `spawn` cria os workers recém-criados da medição sem aquecimento; `gen` é o worker das outras
 * medições, que podem reaproveitá-lo.
 */
export async function runBench(
  gen: Generator,
  options: BenchOptions,
  onStep: (step: string) => void = () => {},
  spawn: () => Generator = createGenerator,
): Promise<BenchReport> {
  const frames = createFrameMonitor()
  let visible = document.visibilityState === 'visible'
  const onVisibility = () => (visible &&= document.visibilityState === 'visible')
  document.addEventListener('visibilitychange', onVisibility)
  const memory: Memory = { cacheBytes: 0, fieldBytes: 0, worldBytes: 0 }
  const P = DEFAULT_WORLD_PARAMS
  const req = (seed: string, size: number, params: WorldParams = P): GenerateRequest => ({ seed, size, params })
  try {
    // Primeiro, antes de aquecer o worker `gen`. No primeiro clique em "Medir", a primeira prévia é
    // a primeira carga do módulo do worker na página, como ao abrir o app.
    onStep(`Prévia ${PREVIEW_SIZE}², worker novo (${options.coldRuns}×)`)
    const coldPreview = await timeCold(spawn, frames, memory, options.coldRuns, (i) => req(`frio-previa-${i}`, PREVIEW_SIZE))
    onStep(`Mapa ${MAP_SIZE}², worker novo (${options.coldRuns}×)`)
    const coldMap = await timeCold(spawn, frames, memory, options.coldRuns, (i) => req(`frio-mapa-${i}`, MAP_SIZE))

    onStep(`Prévia ${PREVIEW_SIZE}², seed nova (${options.previewRuns}×)`)
    const preview = await time(gen, frames, memory, req('previa-aquecimento', PREVIEW_SIZE), options.previewRuns, (i) =>
      req(`previa-${i}`, PREVIEW_SIZE),
    )
    onStep(`Mapa ${MAP_SIZE}², seed nova (${options.mapRuns}×)`)
    const map = await time(gen, frames, memory, req('mapa-aquecimento', MAP_SIZE), options.mapRuns, (i) => req(`mapa-${i}`, MAP_SIZE))
    const transferred = await gen.lastResultTransferred()

    // Com o cache: a mesma seed nos dois tamanhos, como no arrasto seguido do soltar.
    const seed = 'slider'
    onStep(`Prévia ${PREVIEW_SIZE}², slider de limiar (${options.previewRuns}×)`)
    const previewSlider = await time(gen, frames, memory, req(seed, PREVIEW_SIZE), options.previewRuns, (i) =>
      req(seed, PREVIEW_SIZE, { ...P, ocean: 30 + i }),
    )
    onStep(`Mapa ${MAP_SIZE}², slider de limiar (${options.mapRuns}×)`)
    const mapSlider = await time(gen, frames, memory, req(seed, MAP_SIZE), options.mapRuns, (i) =>
      req(seed, MAP_SIZE, { ...P, ocean: 30 + i }),
    )
    onStep(`Mapa ${MAP_SIZE}², Tamanho do continente (${options.mapRuns}×)`)
    const mapShape = await time(gen, frames, memory, req(seed, MAP_SIZE), options.mapRuns, (i) =>
      req(seed, MAP_SIZE, { ...P, continentSize: 40 + i }),
    )

    onStep(`Arrasto: ${options.dragRequests} pedidos de prévia e o mapa final ao soltar`)
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
      coldPreview,
      coldMap,
      preview,
      map,
      previewSlider,
      mapSlider,
      mapShape,
      memory,
      transferred,
      drag: dragReport,
      mainThread,
    }
  } finally {
    frames.stop()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
