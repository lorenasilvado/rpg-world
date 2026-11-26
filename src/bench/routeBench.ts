import { BIOME, createRandom } from '../core'
import type { Generator } from '../workers/generatorClient'
import type { Router } from '../workers/routerClient'
import { createFrameMonitor } from './runBench'
import { MAP_SIZE, ROUTE_TARGET_MS, type RouteBenchReport } from './report'

/**
 * Medição da rota pelo terreno (#249, AC-F5-11): gera o mapa 1024² de uma seed fixa no worker de
 * geração, manda o campo ao worker de rota e mede `runs` rotas por terra entre pontos de terra
 * sorteados (com a seed), longe um do outro.
 */
export const ROUTE_BENCH_SEED = 'rpg-world'

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round = (x: number) => Math.round(x * 10) / 10
const WATER: number[] = [BIOME.deepOcean, BIOME.shallowWater, BIOME.lake]

export async function runRouteBench(gen: Generator, router: Router, runs: number, onStep: (s: string) => void): Promise<RouteBenchReport> {
  onStep(`Gerando o mapa ${MAP_SIZE}²…`)
  const delivered = await gen.request({ seed: ROUTE_BENCH_SEED, size: MAP_SIZE })
  if (!delivered) throw new Error('a geração do mapa voltou sem resultado')
  const { field } = delivered.result
  onStep('Montando a grade de custo…')
  const { gridMs } = await router.setField(field)

  const random = createRandom(`${ROUTE_BENCH_SEED}#rotas`)
  const land = () => {
    for (;;) {
      const u = random()
      const v = random()
      const i = Math.floor(v * field.height) * field.width + Math.floor(u * field.width)
      if (!WATER.includes(field.biome[i])) return { u, v }
    }
  }
  const frames = createFrameMonitor()
  const roundTrips: number[] = []
  const inWorker: number[] = []
  let noPath = 0
  try {
    // Uma de aquecimento, que não conta.
    await router.route({ from: land(), to: land(), mode: 'land' })
    frames.reset()
    for (let k = 0; k < runs; k++) {
      onStep(`Rota ${k + 1} de ${runs}…`)
      let from = land()
      let to = land()
      while (Math.hypot(to.u - from.u, to.v - from.v) < 0.3) {
        from = land()
        to = land()
      }
      const start = performance.now()
      const { route, workerMs } = await router.route({ from, to, mode: 'land' })
      roundTrips.push(performance.now() - start)
      inWorker.push(workerMs)
      if (!route) noPath++
    }
  } finally {
    frames.stop()
  }
  return {
    machine: { userAgent: navigator.userAgent, cores: navigator.hardwareConcurrency },
    seed: ROUTE_BENCH_SEED,
    size: MAP_SIZE,
    targetMs: ROUTE_TARGET_MS,
    gridMs: round(gridMs),
    runs: roundTrips.map(round),
    median: round(median(roundTrips)),
    max: round(Math.max(...roundTrips)),
    workerMedian: round(median(inWorker)),
    workerMax: round(Math.max(...inWorker)),
    noPath,
    maxFrameGap: round(frames.maxGap),
  }
}
