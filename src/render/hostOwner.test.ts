import { describe, expect, it } from 'vitest'
import { claimHost, releaseHost } from './hostOwner'

describe('dono da área do mapa (dois renderers no StrictMode)', () => {
  it('o renderer antigo, destruído depois que o novo foi criado, não limpa o host', () => {
    const host = document.createElement('main')
    const first = claimHost(host)
    const second = claimHost(host)
    // O primeiro termina depois do segundo e é destruído: o host é do segundo.
    expect(releaseHost(host, first)).toBe(false)
    expect(releaseHost(host, second)).toBe(true)
  })

  it('com um renderer só, ele limpa o host uma vez', () => {
    const host = document.createElement('main')
    const only = claimHost(host)
    expect(releaseHost(host, only)).toBe(true)
    expect(releaseHost(host, only)).toBe(false)
  })

  it('cada host tem o seu dono', () => {
    const a = document.createElement('main')
    const b = document.createElement('main')
    const ta = claimHost(a)
    claimHost(b)
    expect(releaseHost(b, ta)).toBe(false)
    expect(releaseHost(a, ta)).toBe(true)
  })
})
