/**
 * Hashes de referência do campo 256² nos parâmetros padrão, para a versão atual do gerador
 * (`GENERATOR_VERSION`). O Vitest confere no Node e o Playwright no Chrome, no Firefox e no
 * WebKit (`e2e/determinismo.spec.ts`): se todos batem com estes valores, os motores geram o
 * mesmo campo. Mudou o gerador de propósito? Suba `GENERATOR_VERSION` e atualize os hashes.
 */
export const GOLDEN_SIZE = 256

export const GOLDEN_HASHES: ReadonlyArray<{ seed: string; hash: string }> = [
  { seed: 'rpg-world', hash: '00a47247' },
  { seed: 'Aldebaran', hash: '443d1b6b' },
  { seed: '42', hash: '1e02bdb7' },
]
