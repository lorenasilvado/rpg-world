/**
 * Tipos do núcleo de geração. O núcleo é TS puro: não conhece React nem Pixi (ADR 0001).
 *
 * Determinismo (RNF-4): o núcleo só usa aritmética IEEE 754 (+, -, *, /), comparações e funções
 * Math exatas (`floor`, `sqrt`, `abs`, `min`, `max`, `imul`), que dão o mesmo resultado em qualquer
 * engine. Funções Math transcendentes (sin, exp, pow…) e o operador `**` são proibidos; o teste
 * `determinism.test.ts` confere o código do núcleo e o das bibliotecas que ele usa.
 */

/** Versão do gerador: muda sempre que o mesmo pedido passa a gerar outro campo. */
export const GENERATOR_VERSION = 3

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

/** Parâmetros do mundo: os valores dos sliders, de 0 a 100. */
export type WorldParams = {
  /** Porcentagem do mapa coberta por água oceânica. */
  ocean: number
  beach: number
  desert: number
  forest: number
  /** Quantidade de cordilheiras. */
  mountains: number
  /** Proporção de picos nevados versus rochosos. */
  snow: number
  /** De ilhas (0) a pangeia (100). */
  continentSize: number
  /** De costa lisa (0) a recortada (100). */
  coastRoughness: number
  temperature: number
}

/** Campo gerado: elevação de 0 a 1 e bioma de cada célula, em ordem de linhas. */
export type CoreField = {
  width: number
  height: number
  elevation: Float32Array
  biome: Uint8Array
}
