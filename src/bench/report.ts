/**
 * Tipos e metas do relatório da medição (#9, #45). Sem imports de módulos com código (só reexporta
 * `sizes.ts`, que não importa nada), para o E2E (`e2e/desempenho.spec.ts`) poder importá-lo.
 */
export { MAP_SIZE, PREVIEW_SIZE } from '../state/sizes.ts'

/** Metas do RNF-2 e do AC-F1-09: tempos em ms e memória do mundo em bytes (64 MB). */
export const TARGETS = { previewMs: 150, mapMs: 1500, worldBytes: 64_000_000 } as const

export type Timing = {
  size: number
  /** Ida e volta de cada geração, medida na thread principal (pedido → resultado na UI), em ms. */
  runs: number[]
  median: number
  max: number
  /** Mediana do tempo de geração dentro do worker, em ms. */
  workerMedian: number
  /** Maior intervalo entre dois quadros da UI durante as gerações, em ms. */
  maxFrameGap: number
}

export type BenchReport = {
  machine: { userAgent: string; cores: number }
  /**
   * A página ficou visível o tempo todo. Com a aba escondida, o navegador espaça os quadros e os
   * timers (até 1 s), e o maior quadro e o arrasto deixam de valer.
   */
  visible: boolean
  targets: typeof TARGETS
  /** Seed nova a cada geração: o pipeline completo, sem nada no cache do worker. */
  preview: Timing
  map: Timing
  /** Mesma seed, um slider de limiar (Oceano) muda: só a classificação é refeita. */
  previewSlider: Timing
  mapSlider: Timing
  /** Mesma seed, Tamanho do continente muda: refaz a elevação, os rios e a classificação. */
  mapShape: Timing
  /**
   * Maior memória do mundo medida, em bytes: o cache do worker (ruído, clima, elevação e lagos de
   * cada tamanho guardado) mais os arrays do campo entregue.
   */
  memory: { cacheBytes: number; fieldBytes: number; worldBytes: number }
  /** Os buffers do último resultado saíram do worker (byteLength 0 lá): transferidos, sem cópia. */
  transferred: boolean
  /** Arrasto de um slider pelo `worldStore`, com pedidos de prévia mais rápidos que a geração. */
  drag: {
    sent: number
    /** Campos exibidos (trocas do `field` no store), durante o arrasto e depois de soltar. */
    delivered: number
    /** Campos exibidos antes de soltar o slider: o mapa continua atualizando (AC-F1-10). */
    duringDrag: number
    /** Cada campo exibido veio de um pedido mais novo que o anterior. */
    inOrder: boolean
    /** A última prévia exibida é a dos parâmetros pedidos naquela versão (mesmo hash). */
    previewMatches: boolean
    /** Ao soltar: o mapa final substitui a prévia (AC-F1-11). */
    release: { size: number; version: number; lastVersion: number; matches: boolean }
  }
  /** Referência: a mesma geração 1024² na thread principal, como no RPG-land (null no modo rápido). */
  mainThread: { ms: number; maxFrameGap: number } | null
}
