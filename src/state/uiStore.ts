import { createStore, type StoreApi } from 'zustand/vanilla'

/**
 * Estado da interface que o renderer lê, fora do mundo salvo: as camadas do mapa ligadas ou
 * desligadas e a sidebar recolhida (a área livre do mapa muda com ela). É um store "vanilla" do
 * Zustand, como o `worldStore`.
 */
export type MapLayer = 'decor'

export type UiState = {
  /** Camadas do mapa à vista (todas ligadas ao abrir). */
  layers: Record<MapLayer, boolean>
  /** Sidebar recolhida a 48 px (a partir de 768 px; abaixo disso ela é um painel sobreposto). */
  sidebarCollapsed: boolean
  setLayer(layer: MapLayer, on: boolean): void
  setSidebarCollapsed(collapsed: boolean): void
}

export type UiStore = StoreApi<UiState>

export function createUiStore(): UiStore {
  return createStore<UiState>()((set, get) => ({
    layers: { decor: true },
    sidebarCollapsed: false,
    setLayer(layer, on) {
      if (get().layers[layer] === on) return
      set({ layers: { ...get().layers, [layer]: on } })
    },
    setSidebarCollapsed(collapsed) {
      if (get().sidebarCollapsed === collapsed) return
      set({ sidebarCollapsed: collapsed })
    },
  }))
}
