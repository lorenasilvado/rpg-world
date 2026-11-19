import { createStore, type StoreApi } from 'zustand/vanilla'

/** Retângulo em unidades do mundo (0–1024 nos dois eixos). */
export type WorldRect = { x: number; y: number; width: number; height: number }

/** Comandos da câmera que a interface chama (os botões de zoom e o minimapa). */
export type CameraControls = {
  /** Aproxima 1,25× no centro da área livre, deslizando como a tecla +. */
  zoomIn(): void
  /** Afasta 1,25× no centro da área livre, deslizando como a tecla −. */
  zoomOut(): void
  /** Volta para o mapa inteiro (1×), como a tecla 0. */
  center(): void
  /** Põe o ponto do mundo (x, y) no centro da área livre na hora, sem mudar o zoom (dentro dos limites). */
  centerOn(x: number, y: number): void
}

export type CameraView = {
  /** Zoom relativo (1 = mapa inteiro na área livre). */
  zoom: number
  /** Pixels CSS por unidade do mundo. */
  scale: number
  /** Parte do mundo à vista na área livre. */
  view: WorldRect
}

export type CameraState = CameraView & {
  /** A câmera já mostra um mapa (antes do primeiro campo, os valores não valem). */
  ready: boolean
  /** Os comandos do renderer (`null` sem renderer, como nos testes do jsdom). */
  controls: CameraControls | null
  update(view: CameraView): void
  setControls(controls: CameraControls | null): void
}

export type CameraStore = StoreApi<CameraState>

/**
 * Câmera do mapa vista pela interface: o renderer escreve aqui o zoom e a parte visível do mundo
 * a cada quadro em que eles mudam, e registra os comandos. O React lê para o minimapa e o controle
 * de zoom e chama os comandos; o desenho continua fora do React (ADR 0001).
 */
export function createCameraStore(): CameraStore {
  return createStore<CameraState>()((set, get) => ({
    ready: false,
    zoom: 1,
    scale: 1,
    view: { x: 0, y: 0, width: 0, height: 0 },
    controls: null,
    update(next) {
      const s = get()
      const v = s.view
      const same =
        s.ready &&
        s.zoom === next.zoom &&
        s.scale === next.scale &&
        v.x === next.view.x &&
        v.y === next.view.y &&
        v.width === next.view.width &&
        v.height === next.view.height
      if (same) return
      set({ ...next, view: { ...next.view }, ready: true })
    },
    setControls(controls) {
      set(controls ? { controls } : { controls: null, ready: false })
    },
  }))
}
