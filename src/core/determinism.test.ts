import aleaSource from 'alea?raw'
import simplexSource from 'simplex-noise?raw'
import { describe, expect, it } from 'vitest'

/**
 * AC-M0-12 (RNF-4): o núcleo e as bibliotecas que ele usa não chamam funções Math
 * transcendentes, cujo resultado pode variar entre engines. `Math.sqrt`, `Math.floor` e afins
 * são exatos pelo IEEE 754 e podem ser usados.
 */
const FORBIDDEN_MATH =
  /\bMath\s*\.\s*(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot)\b/g
/** `**` é o mesmo que `Math.pow`. */
const POW_OPERATOR = /\*\*/g

const coreSources = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function violations(code: string): string[] {
  const clean = stripComments(code)
  return [...(clean.match(FORBIDDEN_MATH) ?? []), ...(clean.match(POW_OPERATOR) ?? [])]
}

describe('núcleo sem funções Math transcendentes (AC-M0-12)', () => {
  it('confere todos os arquivos do núcleo', () => {
    expect(Object.keys(coreSources).length).toBeGreaterThan(5)
    for (const [file, code] of Object.entries(coreSources)) expect(violations(code), file).toEqual([])
  })

  it('confere as bibliotecas usadas pelo núcleo (alea e simplex-noise)', () => {
    expect(aleaSource).toContain('function Mash')
    expect(simplexSource).toContain('createNoise3D')
    expect(violations(aleaSource)).toEqual([])
    expect(violations(simplexSource)).toEqual([])
  })

  it('a varredura acha uma chamada proibida', () => {
    expect(violations('const a = Math.sin(x) + Math . exp(1) + Math.pow(2, 3) + 2 ** 3')).toHaveLength(4)
    expect(violations('/** doc */ const r = Math.sqrt(2) // Math.sin no comentário')).toEqual([])
  })
})
