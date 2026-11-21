import { createStore, type StoreApi } from 'zustand/vanilla'

/**
 * Estado da interface que o renderer lê, fora do mundo salvo: as camadas do mapa ligadas ou
 * desligadas e a sidebar recolhida (a área livre do mapa muda com ela). Guarda também se o
 * minimapa está aberto e a ferramenta do mapa em uso. É um store "vanilla" do
 * Zustand, como o `worldStore`.
 */
export type MapLayer = 'decor'

/** Ferramenta do mapa em uso: navegar (pan e zoom) ou medir distância (navegacao.md, AC-F2-13). */
export type MapTool = 'nav' | 'measure'

export type UiState = {
  /** Camadas do mapa à vista (todas ligadas ao abrir). */
  layers: Record<MapLayer, boolean>
  /** Sidebar recolhida a 48 px (a partir de 768 px; abaixo disso ela é um painel sobreposto). */
  sidebarCollapsed: boolean
  /** Minimapa aberto (aberto ao abrir o editor; recolhido, fica só o cabeçalho). */
  minimapOpen: boolean
  /** Ferramenta em uso (Navegar ao abrir). */
  tool: MapTool
  setLayer(layer: MapLayer, on: boolean): void
  setSidebarCollapsed(collapsed: boolean): void
  setMinimapOpen(open: boolean): void
  setTool(tool: MapTool): void
}

export type UiStore = StoreApi<UiState>

export function createUiStore(): UiStore {
  return createStore<UiState>()((set, get) => ({
    layers: { decor: true },
    sidebarCollapsed: false,
    minimapOpen: true,
    tool: 'nav',
    setLayer(layer, on) {
      if (get().layers[layer] === on) return
      set({ layers: { ...get().layers, [layer]: on } })
    },
    setSidebarCollapsed(collapsed) {
      if (get().sidebarCollapsed === collapsed) return
      set({ sidebarCollapsed: collapsed })
    },
    setMinimapOpen(open) {
      if (get().minimapOpen === open) return
      set({ minimapOpen: open })
    },
    setTool(tool) {
      if (get().tool === tool) return
      set({ tool })
    },
  }))
}
