/**
 * Tipos e metas do relatório da medição (#9). Sem imports, para o E2E (`e2e/desempenho.spec.ts`)
 * poder importá-lo.
 */
export const TARGETS = { previewMs: 150, mapMs: 1500 } as const
export const PREVIEW_SIZE = 256
export const MAP_SIZE = 1024

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
  preview: Timing
  map: Timing
  /** Os buffers do último resultado saíram do worker (byteLength 0 lá): transferidos, sem cópia. */
  transferred: boolean
  drag: {
    sent: number
    delivered: number
    /** Toda entrega era do pedido mais novo no momento em que chegou. */
    onlyLatest: boolean
    lastDeliveredVersion: number
    lastVersion: number
    /** O campo entregue por último é o da última seed pedida (mesmo hash da geração direta). */
    lastFieldMatches: boolean
  }
  /** Referência: a mesma geração 1024² na thread principal, como no RPG-land (null no modo rápido). */
  mainThread: { ms: number; maxFrameGap: number } | null
}
