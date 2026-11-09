/**
 * Metas e tipos do relatório do spike de 5.000 sprites (#10). Sem imports, para o E2E
 * (`e2e/sprites.spec.ts`) poder importá-lo.
 */
export const SPRITE_COUNT = 5000
export const TARGET_FPS = 55
export const FULL_DURATION_MS = 30_000
export const QUICK_DURATION_MS = 2_000

export type FrameStats = {
  frames: number
  durationMs: number
  avgFps: number
  /** Pior janela de 1 s da medição: é o número que vale para a meta. */
  minFps: number
  worstFrameMs: number
  /** Quadros mais longos que 1/55 s. */
  slowFrames: number
}

export type SpriteReport = {
  machine: {
    userAgent: string
    cores: number
    /** Nome da GPU informado pelo navegador; null se ele não informa. */
    gpu: string | null
    /** Renderer que o Pixi usou. */
    renderer: string
  }
  screen: { cssWidth: number; cssHeight: number; devicePixelRatio: number }
  /** auto = câmera roteirizada; manual = pan e zoom feitos à mão durante a medição. */
  mode: 'auto' | 'manual'
  sprites: number
  /** A aba ficou à vista o tempo todo. Escondida, o navegador espaça os quadros e o número não vale. */
  visible: boolean
  target: number
  stats: FrameStats
  /** A medição vale (aba à vista) e o fps mínimo atingiu a meta. */
  pass: boolean
}
