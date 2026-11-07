/**
 * Tipos do núcleo de geração. O núcleo é TS puro: não conhece React nem Pixi (ADR 0001).
 *
 * Determinismo (RNF-4): o núcleo só usa aritmética IEEE 754 (+, -, *, /), `Math.floor`,
 * `Math.sqrt` e comparações, que dão o mesmo resultado em qualquer engine. Funções Math
 * transcendentes (sin, exp, pow…) e o operador `**` são proibidos; o teste
 * `determinism.test.ts` confere o código do núcleo e o das bibliotecas que ele usa.
 */

/** Versão do gerador: muda sempre que o mesmo pedido passa a gerar outro campo. */
export const GENERATOR_VERSION = 1

/**
 * Biomas do campo, no valor guardado no `Uint8Array`. Mesma ordem de `BIOMES` em
 * `render/style/palette.ts` (o núcleo não importa o renderer).
 */
export const BIOME = {
  deepOcean: 0,
  shallowWater: 1,
  beach: 2,
  grassland: 3,
  forest: 4,
  desert: 5,
  hill: 6,
  rockyMountain: 7,
  snow: 8,
} as const

/** Parâmetros do núcleo mínimo do spike (#8), em frações de 0 a 1. */
export type CoreParams = {
  /** Fração das células que é água. */
  ocean: number
  /** Fração das células de água que é água rasa. */
  shallow: number
  /** Fração da terra que é colina ou mais alta. */
  hills: number
  /** Fração da terra que é montanha (rocha + neve). */
  mountains: number
  /** Fração das montanhas que tem neve. */
  snow: number
}

/** Campo gerado: elevação de 0 a 1 e bioma de cada célula, em ordem de linhas. */
export type CoreField = {
  width: number
  height: number
  elevation: Float32Array
  biome: Uint8Array
}
