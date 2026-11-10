import type { WorldParams } from '../types.ts'

/**
 * Hashes de referência do campo 256², para a versão atual do gerador
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
export const GOLDEN_VERSION = 3

/** Preset "Arquipélago": confere também os parâmetros longe do padrão. */
const ARCHIPELAGO: WorldParams = {
  ocean: 66,
  beach: 55,
  desert: 8,
  forest: 45,
  mountains: 22,
  snow: 15,
  continentSize: 8,
  coastRoughness: 72,
  temperature: 64,
}

/** Sem `params`, o caso usa os parâmetros padrão. */
export const GOLDEN_HASHES: ReadonlyArray<{ seed: string; params?: WorldParams; hash: string }> = [
  { seed: 'rpg-world', hash: '6c0e5b6d' },
  { seed: 'Aldebaran', hash: '6738ca61' },
  { seed: '42', hash: '2dfa10e2' },
  { seed: 'rpg-world', params: ARCHIPELAGO, hash: '23795711' },
]
