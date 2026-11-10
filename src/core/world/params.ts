import type { WorldParams } from '../types'

/**
 * Valores padrão dos sliders (tabela de sliders em `docs/specs/geracao-terreno.md`). Congelados:
 * alterá-los mudaria o mapa gerado sem subir `GENERATOR_VERSION`.
 */
export const DEFAULT_WORLD_PARAMS: Readonly<WorldParams> = Object.freeze({
  ocean: 45,
  beach: 30,
  desert: 15,
  forest: 35,
  mountains: 30,
  snow: 40,
  continentSize: 50,
  coastRoughness: 50,
  temperature: 50,
})

/** Nomes de todos os parâmetros, na ordem da tabela de sliders. */
const PARAM_KEYS = Object.keys(DEFAULT_WORLD_PARAMS) as (keyof WorldParams)[]

/**
 * Confere que cada parâmetro existe e vai de 0 a 100. Valores fora da faixa não quebram a
 * geração, mas geram um mapa que nenhum slider produz; melhor falhar com uma mensagem clara.
 */
export function validateWorldParams(params: Readonly<WorldParams>): void {
  for (const key of PARAM_KEYS) {
    const value = params[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`generateField: parâmetro ${key} inválido (${String(value)}); use de 0 a 100`)
    }
  }
}
