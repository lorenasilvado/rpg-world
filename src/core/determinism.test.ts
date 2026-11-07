import aleaSource from 'alea?raw'
import simplexSource from 'simplex-noise?raw'
import { describe, expect, it } from 'vitest'

/**
 * AC-M0-12 (RNF-4): o núcleo e as bibliotecas que ele usa não chamam funções Math
 * transcendentes (sin, exp, pow…), cujo resultado pode variar entre engines.
 *
 * A varredura é por lista do que é permitido: só as funções Math exatas pelo IEEE 754 (ou
 * inteiras). Qualquer outro uso de `Math` é violação, inclusive o acesso indireto
 * (`Math['pow']`, `const { sin } = Math`, `Math` passado como valor).
 */
const EXACT_MATH = ['abs', 'ceil', 'clz32', 'floor', 'fround', 'imul', 'max', 'min', 'round', 'sign', 'sqrt', 'trunc']
/** `Math.random` aparece no `simplex-noise` só como padrão do parâmetro; o núcleo sempre passa o seu gerador. */
const LIBRARY_MATH = [...EXACT_MATH, 'random']
/** `**` é o mesmo que `Math.pow`. */
const POW_OPERATOR = /\*\*/g
/** Fontes que mudam a cada execução: o núcleo só pode depender da seed (o `Math.random` já cai fora da lista acima). */
const NONDETERMINISTIC = /\b(?:Date|performance|crypto)\b/g
const MATH_USE = /\bMath\b(?:\s*\.\s*([A-Za-z_$][\w$]*))?/g

const coreSources = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function violations(code: string, allowedMath: readonly string[] = EXACT_MATH): string[] {
  const clean = stripComments(code)
  const math = [...clean.matchAll(MATH_USE)].filter((m) => !m[1] || !allowedMath.includes(m[1])).map((m) => m[0])
  return [...math, ...(clean.match(POW_OPERATOR) ?? [])]
}

/** No núcleo: além da Math, nada de relógio nem de aleatoriedade fora da seed. */
function coreViolations(code: string): string[] {
  return [...violations(code), ...clockUses(code)]
}

function clockUses(code: string): string[] {
  return stripComments(code).match(NONDETERMINISTIC) ?? []
}

/**
 * O `alea` usa o relógio num ponto só: `args = [+new Date]`, quando é chamado sem seed. O
 * `createRandom` sempre passa a seed, então esse caminho não roda no núcleo. Qualquer outro uso
 * de relógio nas bibliotecas (numa versão nova, por exemplo) é violação.
 */
const ALEA_CLOCK_FALLBACK = /if\s*\(\s*args\.length\s*==\s*0\s*\)\s*\{\s*args\s*=\s*\[\s*\+\s*new\s+Date\s*\]\s*;?\s*\}/

/**
 * Módulos que o código importa (`import`, `export … from`, `import()` ou `require()`). A
 * varredura das bibliotecas só lê o arquivo de entrada: se uma versão nova passar a importar
 * outro módulo, o teste falha e obriga a varrer esse módulo também.
 */
const IMPORT =
  /\bimport\s*(?:[\w*{][^;]*?\bfrom\s*)?['"]([^'"]+)['"]|\bexport\s*[\w*{][^;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]/g

function imports(code: string): string[] {
  return [...stripComments(code).matchAll(IMPORT)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4])
}

describe('núcleo sem funções Math transcendentes (AC-M0-12)', () => {
  it('confere todos os arquivos do núcleo', () => {
    expect(Object.keys(coreSources).length).toBeGreaterThan(5)
    for (const [file, code] of Object.entries(coreSources)) expect(coreViolations(code), file).toEqual([])
  })

  it('confere as bibliotecas usadas pelo núcleo (alea e simplex-noise)', () => {
    expect(aleaSource).toContain('function Mash')
    expect(simplexSource).toContain('createNoise3D')
    expect(violations(aleaSource, LIBRARY_MATH)).toEqual([])
    expect(violations(simplexSource, LIBRARY_MATH)).toEqual([])
  })

  it('nas bibliotecas, o relógio só aparece no padrão do alea sem seed', () => {
    expect(clockUses(simplexSource)).toEqual([])
    expect(clockUses(aleaSource)).toEqual(['Date'])
    expect(aleaSource).toMatch(ALEA_CLOCK_FALLBACK)
    expect(clockUses(aleaSource.replace(ALEA_CLOCK_FALLBACK, ''))).toEqual([])
  })

  it('as bibliotecas são um arquivo só: a varredura acima cobre todo o código delas', () => {
    expect(imports(aleaSource)).toEqual([])
    expect(imports(simplexSource)).toEqual([])
  })

  it('a busca de imports acha cada forma de importar', () => {
    const code = `import a from './a.js'
      import { b } from "./b.js"
      import './c.js'
      export * from './d.js'
      export { e } from './e.js'
      const f = await import('./f.js')
      const g = require('./g.js')
      // import h from './h.js'`
    expect(imports(code)).toEqual(['./a.js', './b.js', './c.js', './d.js', './e.js', './f.js', './g.js'])
  })

  it('a varredura acha uma chamada proibida', () => {
    expect(violations('const a = Math.sin(x) + Math . exp(1) + Math.pow(2, 3) + 2 ** 3')).toHaveLength(4)
    expect(violations('/** doc */ const r = Math.sqrt(2) // Math.sin no comentário')).toEqual([])
  })

  it('a varredura acha o acesso indireto à Math', () => {
    expect(violations("const p = Math['pow'](2, 3)")).toEqual(['Math'])
    expect(violations('const { sin } = Math')).toEqual(['Math'])
    expect(violations('const m = Math; m.exp(1)')).toEqual(['Math'])
    expect(violations('const r = Math.floor(Math.sqrt(2) + Math.imul(3, 4))')).toEqual([])
  })

  it('no núcleo, acha relógio e aleatoriedade fora da seed', () => {
    expect(coreViolations('const r = Math.random()')).toEqual(['Math.random'])
    expect(coreViolations('const t = Date.now() + performance.now()')).toEqual(['Date', 'performance'])
    expect(coreViolations('crypto.getRandomValues(buf)')).toEqual(['crypto'])
    expect(coreViolations('// Date.now() no comentário\nconst x = 1')).toEqual([])
  })
})
