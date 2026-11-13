import { describe, expect, it } from 'vitest'
import { DECOR_RULES } from '../../core/decor/decor'
import { DECOR } from '../../core/types'
import { DECOR_FRAMES, DECOR_FRAME_OF, DECOR_SIZE, decorWorldSize } from './decor'

describe('quadros dos ícones do núcleo', () => {
  it('árvore, cacto, montanha e montanha nevada têm quadro no spritesheet', () => {
    expect(DECOR_FRAME_OF.get(DECOR.tree)).toBe('pine')
    expect(DECOR_FRAME_OF.get(DECOR.cactus)).toBe('cactus')
    expect(DECOR_FRAME_OF.get(DECOR.peak)).toBe('mountain')
    expect(DECOR_FRAME_OF.get(DECOR.snowPeak)).toBe('snowMountain')
    for (const frame of DECOR_FRAME_OF.values()) expect(DECOR_FRAMES).toHaveProperty(frame)
  })

  it('só aponta para tipos que o núcleo gera', () => {
    const generated = new Set(DECOR_RULES.flatMap((r) => r.kinds.map((k) => k.kind)))
    for (const kind of DECOR_FRAME_OF.keys()) expect(generated.has(kind)).toBe(true)
  })

  it('o tamanho no mundo é metade do tamanho do mockup', () => {
    expect(decorWorldSize('mountain')).toBe(DECOR_SIZE.mountain / 2)
  })
})
