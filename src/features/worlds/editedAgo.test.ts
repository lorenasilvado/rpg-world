import { describe, expect, it } from 'vitest'
import { editedAgo, pinCount, worldCaption } from './editedAgo'

const NOW = new Date('2026-11-21T12:00:00.000Z')
const ago = (ms: number) => editedAgo(new Date(NOW.getTime() - ms).toISOString(), NOW)
const MIN = 60_000
const H = 60 * MIN
const D = 24 * H

describe('"Editado há X" (AC-F4-04)', () => {
  it.each([
    [0, 'Editado agora'],
    [59_999, 'Editado agora'],
    [MIN, 'Editado há 1 min'],
    [59 * MIN, 'Editado há 59 min'],
    [H, 'Editado há 1 h'],
    [2 * H + 30 * MIN, 'Editado há 2 h'],
    [D - 1, 'Editado há 23 h'],
    [D, 'Editado ontem'],
    [2 * D - 1, 'Editado ontem'],
    [2 * D, 'Editado há 2 dias'],
    [6 * D, 'Editado há 6 dias'],
    [7 * D, 'Editado há 1 semana'],
    [20 * D, 'Editado há 2 semanas'],
    [30 * D, 'Editado há 1 mês'],
    [75 * D, 'Editado há 2 meses'],
    [364 * D, 'Editado há 12 meses'],
    [365 * D, 'Editado há 1 ano'],
    [800 * D, 'Editado há 2 anos'],
  ])('%i ms atrás → %s', (ms, text) => {
    expect(ago(ms)).toBe(text)
  })

  it('uma data no futuro ou inválida conta como "agora"', () => {
    expect(ago(-5 * MIN)).toBe('Editado agora')
    expect(editedAgo('não é data', NOW)).toBe('Editado agora')
  })

  it('conta os pins, com "sem pins" para nenhum', () => {
    expect(pinCount(0)).toBe('sem pins')
    expect(pinCount(1)).toBe('1 pin')
    expect(pinCount(14)).toBe('14 pins')
    expect(worldCaption({ updatedAt: new Date(NOW.getTime() - 2 * H).toISOString(), pins: Array(14).fill(0) }, NOW)).toBe(
      'Editado há 2 h · 14 pins',
    )
    expect(worldCaption({ updatedAt: NOW.toISOString(), pins: [] }, NOW)).toBe('Editado agora · sem pins')
  })
})
