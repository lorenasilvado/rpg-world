import type { WorldParams } from '../types'

/** Valores padrão dos sliders (tabela de sliders em `docs/specs/geracao-terreno.md`). */
export const DEFAULT_WORLD_PARAMS: WorldParams = {
  ocean: 45,
  beach: 30,
  desert: 15,
  forest: 35,
  mountains: 30,
  snow: 40,
  continentSize: 50,
  coastRoughness: 50,
  temperature: 50,
}
