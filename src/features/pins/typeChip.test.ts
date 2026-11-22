import { describe, expect, it } from 'vitest'
import { PIN_SHAPES } from '../../render/style/pinShapes'
import { PIN_TYPES } from '../../state/pinTypes'
import { contrast, typeChipColors } from './typeChip'

describe('etiqueta do tipo no drawer', () => {
  it('todo tipo tem texto com contraste AA (4,5:1) sobre a cor da etiqueta', () => {
    for (const t of PIN_TYPES) {
      const { background, color } = typeChipColors(PIN_SHAPES[t.id])
      expect(contrast(background, color), t.label).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('a Cidade tem texto branco sobre a sombra vermelha, como no mockup', () => {
    expect(typeChipColors(PIN_SHAPES.cidade)).toEqual({ background: '#A93A26', color: '#FFFFFF' })
  })
})
