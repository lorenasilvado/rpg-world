import { Hand, Layers, MapPinPlus, Route, Ruler, Trees, Waypoints, type LucideIcon } from 'lucide-react'
import type { MapLayer } from '../../state/uiStore'

export type Tool = {
  id: 'nav' | 'pin' | 'road' | 'route' | 'layers' | 'measure'
  label: string
  icon: LucideIcon
  /** Tecla do atalho, mostrada no tooltip (design-system.md → Ícones de interface). */
  shortcut?: string
  /** A função ainda não existe (pins e estradas no M2; medir distância em outra task do M1). */
  disabled?: boolean
}

/** As ferramentas da toolbar, na ordem do design system; Camadas vem depois de um separador. */
export const TOOLS: readonly Tool[] = [
  { id: 'nav', label: 'Navegar', icon: Hand, shortcut: 'V' },
  { id: 'pin', label: 'Adicionar pin', icon: MapPinPlus, shortcut: 'P', disabled: true },
  { id: 'road', label: 'Desenhar estrada', icon: Route, shortcut: 'R', disabled: true },
  { id: 'route', label: 'Rota automática', icon: Waypoints, shortcut: 'A', disabled: true },
  { id: 'layers', label: 'Camadas', icon: Layers },
  { id: 'measure', label: 'Medir distância', icon: Ruler, shortcut: 'M', disabled: true },
]

/** As camadas que o popover de Camadas liga e desliga (só as que existem no mapa). */
export const LAYERS: readonly { id: MapLayer; label: string; icon: LucideIcon }[] = [{ id: 'decor', label: 'Decoração', icon: Trees }]
