/**
 * Hashes de referência do campo 256² nos parâmetros padrão, para a versão atual do gerador
 * (`GENERATOR_VERSION`). O Vitest confere no Node e o Playwright no Chrome, no Firefox e no
 * WebKit (`e2e/determinismo.spec.ts`): se todos batem com estes valores, os motores geram o
 * mesmo campo. Mudou o gerador de propósito? Suba `GENERATOR_VERSION` e atualize os hashes.
 *
 * O campo também depende da versão de `alea` e `simplex-noise`, fixadas sem `^` no
 * `package.json`: trocar a versão delas é mudar o gerador (suba `GENERATOR_VERSION`).
 */
export const GOLDEN_SIZE = 256

/**
 * Versão do gerador a que estes hashes pertencem. Um teste exige que seja igual a
 * `GENERATOR_VERSION`: trocar os hashes pede trocar esta versão junto, e ela só passa no teste
 * se `GENERATOR_VERSION` também subir.
 */
export const GOLDEN_VERSION = 1

export const GOLDEN_HASHES: ReadonlyArray<{ seed: string; hash: string }> = [
  { seed: 'rpg-world', hash: '00a47247' },
  { seed: 'Aldebaran', hash: '443d1b6b' },
  { seed: '42', hash: '1e02bdb7' },
]
