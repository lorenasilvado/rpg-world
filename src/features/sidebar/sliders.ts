import {
  Dices,
  Globe,
  Map as MapIcon,
  Mountain,
  MountainSnow,
  Shell,
  SlidersHorizontal,
  Spline,
  Sun,
  Thermometer,
  Trees,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { BIOME_TONES } from '../../render/style/palette'
import type { ParamKey } from '../../state/params'

/**
 * As seções da sidebar: Seed e Presets (sem sliders, com o conteúdo próprio) e as 4 seções dos 9
 * sliders (tabela de sliders em `docs/specs/geracao-terreno.md`), com o ícone do design system e,
 * nos de bioma, a amostra de cor: o tom base do bioma na paleta do mapa.
 */
export type SliderDef = { key: ParamKey; label: string; icon: LucideIcon; swatch?: string }

export type SectionId = 'seed' | 'presets' | 'terreno' | 'biomas' | 'relevo' | 'avancado'

export type SectionDef = { id: SectionId; label: string; icon: LucideIcon; sliders: SliderDef[] }

export const SECTIONS: SectionDef[] = [
  { id: 'seed', label: 'Seed', icon: Dices, sliders: [] },
  { id: 'presets', label: 'Presets', icon: MapIcon, sliders: [] },
  {
    id: 'terreno',
    label: 'Terreno',
    icon: Waves,
    sliders: [
      { key: 'ocean', label: 'Oceano', icon: Waves, swatch: BIOME_TONES.deepOcean[1] },
      { key: 'beach', label: 'Praias', icon: Shell, swatch: BIOME_TONES.beach[1] },
    ],
  },
  {
    id: 'biomas',
    label: 'Biomas',
    icon: Trees,
    sliders: [
      { key: 'desert', label: 'Desertos', icon: Sun, swatch: BIOME_TONES.desert[1] },
      { key: 'forest', label: 'Florestas', icon: Trees, swatch: BIOME_TONES.forest[1] },
    ],
  },
  {
    id: 'relevo',
    label: 'Relevo',
    icon: Mountain,
    sliders: [
      { key: 'mountains', label: 'Montanhas', icon: Mountain, swatch: BIOME_TONES.rockyMountain[1] },
      { key: 'snow', label: 'Neve', icon: MountainSnow, swatch: BIOME_TONES.snow[1] },
    ],
  },
  {
    id: 'avancado',
    label: 'Avançado',
    icon: SlidersHorizontal,
    sliders: [
      { key: 'continentSize', label: 'Tamanho do continente', icon: Globe },
      { key: 'coastRoughness', label: 'Rugosidade da costa', icon: Spline },
      { key: 'temperature', label: 'Temperatura global', icon: Thermometer },
    ],
  },
]

/** Seções abertas ao abrir o editor (a tela E1): Presets e Avançado começam fechadas. */
export const SECTIONS_OPEN_AT_START: Record<SectionId, boolean> = {
  seed: true,
  presets: false,
  terreno: true,
  biomas: true,
  relevo: true,
  avancado: false,
}
