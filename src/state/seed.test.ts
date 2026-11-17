import { describe, expect, it } from 'vitest'
import { randomSeed } from './seed'

describe('randomSeed', () => {
  it('tem o formato "palavra-xxxx" do design system', () => {
    for (let i = 0; i < 50; i++) expect(randomSeed()).toMatch(/^[a-z]+-[0-9a-f]{4}$/)
    expect(randomSeed(() => 0)).toBe('valdora-0000')
    expect(randomSeed(() => 0.999999)).toBe('pedravela-ffff')
  })

  it('varia entre sorteios', () => {
    expect(new Set(Array.from({ length: 20 }, () => randomSeed())).size).toBeGreaterThan(1)
  })
})
