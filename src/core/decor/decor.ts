import { createRandom } from '../rng/random'
import { BIOME, DECOR, type Decor, type DecorKind } from '../types'

/**
 * Decoração do mapa: posições e tipos dos ícones, por Poisson-disk (Bridson), conforme o bioma.
 *
 * 1. Os pontos candidatos são uma amostra de Poisson-disk do mapa inteiro, com distância mínima
 *    `DECOR_SPACING` (em frações da largura). Eles só dependem da seed (`seed#decor`): a prévia e
 *    o mapa final sorteiam os mesmos pontos, e os sliders não os mexem.
 * 2. Cada ponto olha o bioma da sua célula e fica com um ícone na chance daquele bioma
 *    (`DECOR_RULES`). Tirar pontos de uma amostra de Poisson-disk mantém a distância mínima entre
 *    os que sobram, então cada bioma tem a sua densidade sem ícones encavalados.
 * 3. Os ícones saem ordenados de cima para baixo (pela linha `v`), a ordem de desenho, e nunca
 *    passam de `MAX_DECOR`.
 *
 * Só aritmética IEEE 754 e funções Math exatas (RNF-4): o anel do Bridson é sorteado por rejeição
 * num quadrado, sem seno nem cosseno. As constantes fazem parte do gerador: mudar qualquer uma
 * exige subir `GENERATOR_VERSION`.
 */

/** Limite de ícones no mapa (AC-F1-08), o mesmo do spike dos 5.000 sprites. */
export const MAX_DECOR = 5000
/**
 * Distância mínima entre dois ícones, em frações da largura do mapa. Densidade de referência:
 * `RPG World Builder - Editor.html`, uma grade com passo de 1/63 da largura; a amostra de
 * Poisson-disk com esta distância tem quase o mesmo número de pontos.
 */
export const DECOR_SPACING = 0.013
/** Candidatos que o Bridson tenta em volta de cada ponto antes de desistir dele. */
const ATTEMPTS = 30

/**
 * Chance de um ponto receber ícone em cada bioma, e qual ícone. Os biomas fora da lista não têm
 * decoração no design system (água rasa, lago e campo gelado). No deserto, a chance é dividida
 * entre cacto e duna.
 */
export const DECOR_RULES: ReadonlyArray<{ biome: number; kinds: ReadonlyArray<{ kind: DecorKind; chance: number }> }> = [
  { biome: BIOME.deepOcean, kinds: [{ kind: DECOR.wave, chance: 0.03 }] },
  { biome: BIOME.beach, kinds: [{ kind: DECOR.sand, chance: 0.05 }] },
  { biome: BIOME.grassland, kinds: [{ kind: DECOR.tuft, chance: 0.16 }] },
  { biome: BIOME.forest, kinds: [{ kind: DECOR.tree, chance: 0.8 }] },
  {
    biome: BIOME.desert,
    kinds: [
      { kind: DECOR.cactus, chance: 0.08 },
      { kind: DECOR.dune, chance: 0.26 },
    ],
  },
  { biome: BIOME.hill, kinds: [{ kind: DECOR.hill, chance: 0.42 }] },
  { biome: BIOME.rockyMountain, kinds: [{ kind: DECOR.peak, chance: 0.7 }] },
  { biome: BIOME.snow, kinds: [{ kind: DECOR.snowPeak, chance: 0.75 }] },
]

/** Biomas em que cada ícone pode cair. */
export const DECOR_BIOMES: ReadonlyMap<DecorKind, number> = new Map(
  DECOR_RULES.flatMap(({ biome, kinds }) => kinds.map(({ kind }) => [kind, biome] as const)),
)

/** Sem ícone. */
const NONE = 255

/** Tabela por bioma: limiares acumulados das chances e o ícone de cada faixa. */
const TABLE: ReadonlyArray<ReadonlyArray<{ upTo: number; kind: DecorKind }>> = (() => {
  const table: { upTo: number; kind: DecorKind }[][] = Object.values(BIOME).map(() => [])
  for (const { biome, kinds } of DECOR_RULES) {
    let upTo = 0
    for (const { kind, chance } of kinds) table[biome].push({ upTo: (upTo += chance), kind })
  }
  return table
})()

/**
 * Amostra de Poisson-disk (Bridson) do quadrado [0, 1)², com distância mínima `spacing`: nenhum
 * par de pontos fica mais perto que isso, e não cabe outro ponto entre eles. Devolve `u` e `v`
 * intercalados, na ordem em que os pontos nasceram.
 */
export function poissonDisk(random: () => number, spacing: number): number[] {
  const cell = spacing / Math.sqrt(2)
  const cols = Math.ceil(1 / cell)
  // Cada célula da grade cabe no máximo um ponto (a diagonal é a distância mínima).
  const grid = new Int32Array(cols * cols).fill(-1)
  const points: number[] = []
  const active: number[] = []
  const min2 = spacing * spacing

  const add = (u: number, v: number): void => {
    const k = points.length / 2
    points.push(u, v)
    active.push(k)
    grid[Math.floor(v / cell) * cols + Math.floor(u / cell)] = k
  }
  const fits = (u: number, v: number): boolean => {
    const cu = Math.floor(u / cell)
    const cv = Math.floor(v / cell)
    for (let y = Math.max(0, cv - 2); y <= Math.min(cols - 1, cv + 2); y++) {
      for (let x = Math.max(0, cu - 2); x <= Math.min(cols - 1, cu + 2); x++) {
        const k = grid[y * cols + x]
        if (k < 0) continue
        const du = points[2 * k] - u
        const dv = points[2 * k + 1] - v
        if (du * du + dv * dv < min2) return false
      }
    }
    return true
  }

  add(random(), random())
  while (active.length > 0) {
    const a = Math.floor(random() * active.length)
    const k = active[a]
    const pu = points[2 * k]
    const pv = points[2 * k + 1]
    let found = false
    for (let t = 0; t < ATTEMPTS && !found; t++) {
      // Um ponto no anel entre `spacing` e `2 * spacing`, por rejeição num quadrado.
      const du = (random() * 4 - 2) * spacing
      const dv = (random() * 4 - 2) * spacing
      const d2 = du * du + dv * dv
      if (d2 < min2 || d2 >= 4 * min2) continue
      const u = pu + du
      const v = pv + dv
      if (u < 0 || u >= 1 || v < 0 || v >= 1 || !fits(u, v)) continue
      add(u, v)
      found = true
    }
    if (!found) {
      // Troca pelo último: a ordem do resto não importa, e a remoção fica O(1).
      active[a] = active[active.length - 1]
      active.pop()
    }
  }
  return points
}

/**
 * Decoração do campo: os ícones por bioma, a partir da seed e dos biomas (`size` × `size`), de
 * cima para baixo e com no máximo `max` ícones (`MAX_DECOR`; outro valor só nos testes).
 */
export function placeDecor(seed: string, biome: Uint8Array, size: number, max = MAX_DECOR): Decor {
  const random = createRandom(`${seed}#decor`)
  const points = poissonDisk(random, DECOR_SPACING)
  const kept: { u: number; v: number; kind: DecorKind }[] = []
  for (let p = 0; p < points.length; p += 2) {
    const u = points[p]
    const v = points[p + 1]
    // O sorteio da chance vem da seed, ponto a ponto: não depende do bioma nem do tamanho.
    const roll = random()
    const b = biome[Math.min(size - 1, Math.floor(v * size)) * size + Math.min(size - 1, Math.floor(u * size))]
    let kind: number = NONE
    for (const band of TABLE[b]) {
      if (roll < band.upTo) {
        kind = band.kind
        break
      }
    }
    if (kind !== NONE) kept.push({ u, v, kind: kind as DecorKind })
  }
  // Ordem de desenho: de cima para baixo; o `sort` é estável, então empates seguem a amostra.
  kept.sort((a, b) => a.v - b.v)
  // Acima do limite, fica uma fração uniforme da lista ordenada, sem abrir buraco numa região.
  const count = Math.min(max, kept.length)
  const decor: Decor = { u: new Float32Array(count), v: new Float32Array(count), kind: new Uint8Array(count) }
  let j = 0
  for (let i = 0; i < kept.length && j < count; i++) {
    if (Math.floor(((i + 1) * count) / kept.length) === Math.floor((i * count) / kept.length)) continue
    decor.u[j] = kept[i].u
    decor.v[j] = kept[i].v
    decor.kind[j] = kept[i].kind
    j++
  }
  return decor
}
