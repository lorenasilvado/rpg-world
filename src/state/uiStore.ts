import { createStore, type StoreApi } from 'zustand/vanilla'

/**
 * Estado da interface que o renderer lê, fora do mundo salvo: por enquanto, as camadas do mapa
 * ligadas ou desligadas. É um store "vanilla" do Zustand, como o `worldStore`.
 */
export type MapLayer = 'decor'

export type UiState = {
  /** Camadas do mapa à vista (todas ligadas ao abrir). */
  layers: Record<MapLayer, boolean>
  setLayer(layer: MapLayer, on: boolean): void
}

export type UiStore = StoreApi<UiState>

export function createUiStore(): UiStore {
  return createStore<UiState>()((set, get) => ({
    layers: { decor: true },
    setLayer(layer, on) {
      if (get().layers[layer] === on) return
      set({ layers: { ...get().layers, [layer]: on } })
    },
  }))
}
