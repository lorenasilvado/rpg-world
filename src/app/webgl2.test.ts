import { describe, expect, it, vi } from 'vitest'
import { hasWebGL2 } from './webgl2'

/** Documento falso: o canvas devolve o contexto que o teste pedir (o jsdom não tem WebGL). */
function docWith(getContext: () => unknown) {
  return { createElement: () => ({ getContext }) } as unknown as Document
}

describe('hasWebGL2 (AC-F1-20)', () => {
  it('é verdadeiro com contexto webgl2, e libera o contexto em seguida', () => {
    const loseContext = vi.fn()
    const getContext = vi.fn(() => ({ getExtension: () => ({ loseContext }) }))
    expect(hasWebGL2(docWith(getContext))).toBe(true)
    expect(getContext).toHaveBeenCalledWith('webgl2')
    expect(loseContext).toHaveBeenCalled()
  })

  it('é falso sem contexto webgl2, ou se pedir o contexto lança um erro', () => {
    expect(hasWebGL2(docWith(() => null))).toBe(false)
    expect(
      hasWebGL2(
        docWith(() => {
          throw new Error('sem GPU')
        }),
      ),
    ).toBe(false)
  })
})
