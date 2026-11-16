import type { WorldParams } from '../core'

export type ParamKey = keyof WorldParams

/** Os dois sliders que disputam a terra firme: a soma deles nunca passa de 100%. */
export type LandShareKey = 'desert' | 'forest'

/**
 * Aplica uma mudança nos parâmetros sem deixar Desertos + Florestas passar de 100% (AC-F1-14): o
 * slider que não mudou recua sozinho até a soma dar 100. Devolve os parâmetros novos e qual slider
 * recuou (`null` se nenhum), para a sidebar piscá-lo. Ex.: Desertos de 15 para 70, com Florestas em
 * 35 → Florestas recua para 30.
 */
export function applyParamChange(
  params: Readonly<WorldParams>,
  change: Partial<WorldParams>,
): { params: WorldParams; receded: LandShareKey | null } {
  const next = { ...params, ...change }
  if (next.desert + next.forest <= 100) return { params: next, receded: null }
  // Se só Florestas mudou, recua Desertos; nos outros casos (Desertos mudou, os dois ou nenhum),
  // recua Florestas.
  const receded: LandShareKey = 'forest' in change && !('desert' in change) ? 'desert' : 'forest'
  const kept: LandShareKey = receded === 'desert' ? 'forest' : 'desert'
  next[receded] = 100 - next[kept]
  return { params: next, receded }
}
