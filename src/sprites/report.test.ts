import { describe, expect, it } from 'vitest'
import { invalidReason } from './report'

describe('invalidReason', () => {
  it('a medição automática só depende da aba à vista', () => {
    expect(invalidReason(true, null)).toBeNull()
    expect(invalidReason(false, null)).toContain('escondida')
  })

  it('a medição manual vale só com pan e zoom', () => {
    expect(invalidReason(true, { panned: true, zoomed: true })).toBeNull()
    expect(invalidReason(true, { panned: false, zoomed: false })).toContain('pan e zoom')
    expect(invalidReason(true, { panned: true, zoomed: false })).toContain('pan e zoom')
    expect(invalidReason(true, { panned: false, zoomed: true })).toContain('pan e zoom')
  })

  it('a aba escondida tem prioridade sobre os gestos', () => {
    expect(invalidReason(false, { panned: false, zoomed: false })).toContain('escondida')
  })
})
