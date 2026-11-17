import { DEFAULT_WORLD_PARAMS, type WorldParams } from '../core'

/**
 * Os 4 presets da sidebar e do assistente (tabela de presets em `docs/specs/geracao-terreno.md`):
 * cada um define os 9 parâmetros. "Continente temperado" é o padrão.
 */
export type PresetId = 'temperado' | 'arquipelago' | 'deserto' | 'gelado'

export type Preset = { id: PresetId; name: string; description: string; params: Readonly<WorldParams> }

export const PRESETS: readonly Preset[] = [
  {
    id: 'temperado',
    name: 'Continente temperado',
    description: 'Um grande continente de campos e florestas',
    params: DEFAULT_WORLD_PARAMS,
  },
  {
    id: 'arquipelago',
    name: 'Arquipélago',
    description: 'Dezenas de ilhas e mares rasos',
    params: { ocean: 66, beach: 55, desert: 8, forest: 45, mountains: 22, snow: 15, continentSize: 8, coastRoughness: 72, temperature: 64 },
  },
  {
    id: 'deserto',
    name: 'Deserto árido',
    description: 'Desertos vastos e serras secas',
    params: { ocean: 32, beach: 25, desert: 62, forest: 10, mountains: 34, snow: 12, continentSize: 74, coastRoughness: 45, temperature: 85 },
  },
  {
    id: 'gelado',
    name: 'Terras geladas',
    description: 'Cordilheiras altas e neve eterna',
    params: { ocean: 48, beach: 12, desert: 4, forest: 42, mountains: 52, snow: 85, continentSize: 58, coastRoughness: 62, temperature: 15 },
  },
]

/** O preset cujos valores são exatamente os parâmetros dados, ou `null` (algum slider mudou). */
export function matchingPreset(params: Readonly<WorldParams>): PresetId | null {
  const keys = Object.keys(DEFAULT_WORLD_PARAMS) as (keyof WorldParams)[]
  return PRESETS.find((p) => keys.every((k) => p.params[k] === params[k]))?.id ?? null
}
