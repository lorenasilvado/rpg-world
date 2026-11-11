/**
 * Tipos do núcleo de geração. O núcleo é TS puro: não conhece React nem Pixi (ADR 0001).
 *
 * Determinismo (RNF-4): o núcleo só usa aritmética IEEE 754 (+, -, *, /), comparações e funções
 * Math exatas (`floor`, `sqrt`, `abs`, `min`, `max`, `imul`), que dão o mesmo resultado em qualquer
 * engine. Funções Math transcendentes (sin, exp, pow…) e o operador `**` são proibidos; o teste
 * `determinism.test.ts` confere o código do núcleo e o das bibliotecas que ele usa.
 */

/** Versão do gerador: muda sempre que o mesmo pedido passa a gerar outro campo. */
export const GENERATOR_VERSION = 6

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
  /** Neve de montanha: os picos nevados (slider Neve). */
  snow: 8,
  /** Campo gelado: o campo abaixo da geada (Temperatura global), fora das montanhas. */
  frozenField: 9,
  /** Lago: a depressão onde a descida de um rio fica presa (ADR 0006); não conta como oceano. */
  lake: 10,
} as const

/** Parâmetros do mundo: os valores dos sliders, de 0 a 100. */
export type WorldParams = {
  /** Porcentagem do mapa coberta por água oceânica. */
  ocean: number
  /** Largura da faixa costeira de areia, medida pela distância da água. */
  beach: number
  /** Fração da terra firme sem praias e sem montanhas que vira deserto. */
  desert: number
  /** Fração da terra firme sem praias e sem montanhas coberta por floresta. */
  forest: number
  /** Quantidade de cordilheiras. */
  mountains: number
  /** Proporção de picos nevados versus rochosos (os mais frios ficam nevados); não muda o campo gelado. */
  snow: number
  /** De ilhas (0) a pangeia (100). */
  continentSize: number
  /** De costa lisa (0) a recortada (100). */
  coastRoughness: number
  /** Temperatura global, de fria a quente: desloca a temperatura de todas as células e muda a neve. */
  temperature: number
}

/** Ponto de um rio, de 0 a 1 no mapa (`u` da esquerda para a direita, `v` de cima para baixo). */
export type RiverPoint = { u: number; v: number }

/**
 * Campo gerado, em ordem de linhas: elevação de 0 a 1, umidade de 0 a 1, temperatura (sem corte, em
 * torno de 0 a 1 com a Temperatura global em 50), bioma de cada célula e hillshade de -127 a 127.
 * Os rios são polilinhas, da nascente até o mar, um lago ou outro rio; o lago é um bioma.
 */
export type CoreField = {
  width: number
  height: number
  elevation: Float32Array
  moisture: Float32Array
  temperature: Float32Array
  biome: Uint8Array
  shade: Int8Array
  rivers: RiverPoint[][]
}
