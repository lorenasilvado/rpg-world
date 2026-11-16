import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_PARAMS } from '../core'
import { applyParamChange } from './params'

describe('applyParamChange: Desertos + Florestas nunca passa de 100% (AC-F1-14)', () => {
  it('sem passar de 100, aplica a mudança e nada recua', () => {
    const { params, receded } = applyParamChange(DEFAULT_WORLD_PARAMS, { desert: 60 })
    expect(params).toEqual({ ...DEFAULT_WORLD_PARAMS, desert: 60 })
    expect(receded).toBeNull()
  })

  it('Desertos de 15 para 70 → Florestas recua de 35 para 30 (exemplo da spec)', () => {
    const { params, receded } = applyParamChange(DEFAULT_WORLD_PARAMS, { desert: 70 })
    expect(params.desert).toBe(70)
    expect(params.forest).toBe(30)
    expect(receded).toBe('forest')
  })

  it('Florestas que sobe faz Desertos recuar', () => {
    const { params, receded } = applyParamChange(DEFAULT_WORLD_PARAMS, { forest: 95 })
    expect(params).toMatchObject({ forest: 95, desert: 5 })
    expect(receded).toBe('desert')
  })

  it('com um em 100, o outro vai a 0; a soma 100 exata não recua', () => {
    expect(applyParamChange(DEFAULT_WORLD_PARAMS, { desert: 100 }).params.forest).toBe(0)
    const exact = applyParamChange({ ...DEFAULT_WORLD_PARAMS, forest: 30 }, { desert: 70 })
    expect(exact.receded).toBeNull()
  })

  it('não muda os parâmetros recebidos nem os outros sliders', () => {
    const before = { ...DEFAULT_WORLD_PARAMS }
    const { params } = applyParamChange(before, { desert: 90, ocean: 10 })
    expect(before).toEqual(DEFAULT_WORLD_PARAMS)
    expect(params).toEqual({ ...DEFAULT_WORLD_PARAMS, desert: 90, forest: 10, ocean: 10 })
  })
})
