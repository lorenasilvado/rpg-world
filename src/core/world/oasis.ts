import { createRandom } from '../rng/random'
import { BIOME } from '../types'

/**
 * Oásis (ADR 0009): a única água dentro do deserto. Cada oásis é um lago pequeno e redondo com um
 * anel de vegetação (campo) em volta e algumas palmeiras no anel.
 *
 * Os centros são sorteados pela seed (`seed#oasis`) em coordenadas de 0 a 1, e os raios são frações
 * da largura do mapa: a prévia e o mapa final sorteiam os mesmos pontos e desenham o oásis do mesmo
 * tamanho, com menos detalhe na prévia. Um ponto só vira oásis se todo o disco de `CLEAR_RADIUS` em
 * volta é deserto, longe dos outros oásis; o mapa tem um oásis para cada `DESERT_PER_OASIS` do mapa
 * em deserto, até `MAX_OASES`. Esse aceite olha o deserto do tamanho gerado, que muda um pouco da
 * prévia para o mapa final: os oásis são quase sempre os mesmos (cerca de 80% medidos na #94), mas
 * ao soltar o slider um oásis pode sumir, aparecer ou trocar de lugar.
 *
 * Só aritmética exata (RNF-4): o disco é medido pelo quadrado da distância, e as palmeiras ficam em
 * direções fixas, sem seno nem cosseno. As constantes fazem parte do gerador: mudar qualquer uma
 * exige subir `GENERATOR_VERSION`.
 */

/** Raio do lago do oásis, em frações da largura do mapa. */
export const OASIS_LAKE_RADIUS = 0.008
/** Raio externo do anel de vegetação, em frações da largura do mapa. */
export const OASIS_RING_RADIUS = 0.016
/** Raio do disco que precisa ser todo deserto para caber um oásis (o anel e uma margem de areia). */
const CLEAR_RADIUS = 0.022
/** Distância mínima entre dois oásis, em frações da largura do mapa. */
const SPACING = 0.12
/** Fração do mapa em deserto para cada oásis. */
const DESERT_PER_OASIS = 0.02
/** Oásis no mapa, no máximo. */
const MAX_OASES = 6
/** Sorteios de centro antes de desistir. */
const ATTEMPTS = 300
/** Distância das palmeiras ao centro, em frações da largura: no meio do anel. */
const PALM_RADIUS = 0.0125

/**
 * Direções das palmeiras: uma à esquerda, uma à direita e talvez uma em cima. O ícone sobe a
 * partir do pé, então uma palmeira embaixo do lago o cobriria; por isso nenhuma fica embaixo.
 */
const LEFT: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [-0.7071, -0.7071],
]
const RIGHT: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0.7071, -0.7071],
]
const TOP: readonly [number, number] = [0, -1]
/** Chance de o oásis ter a palmeira de cima. */
const TOP_PALM_CHANCE = 0.6

/** Um oásis: o centro e as palmeiras, de 0 a 1 no mapa. */
export type Oasis = { u: number; v: number; palms: ReadonlyArray<{ u: number; v: number }> }

/**
 * Sorteia os oásis dentro do deserto e os desenha no `biome` (`size` × `size`): o lago no disco de
 * `OASIS_LAKE_RADIUS` e o campo no anel até `OASIS_RING_RADIUS`. Devolve os oásis, de onde a
 * decoração tira as palmeiras.
 */
export function placeOases(seed: string, biome: Uint8Array, size: number): Oasis[] {
  let desert = 0
  for (let i = 0; i < biome.length; i++) if (biome[i] === BIOME.desert) desert++
  const limit = Math.min(MAX_OASES, Math.floor(desert / (DESERT_PER_OASIS * biome.length)))
  if (limit <= 0) return []
  const random = createRandom(`${seed}#oasis`)
  const oases: Oasis[] = []
  for (let attempt = 0; attempt < ATTEMPTS && oases.length < limit; attempt++) {
    const u = random()
    const v = random()
    // Sorteados sempre, para a sequência não depender do que foi aceito antes.
    const left = LEFT[random() < 0.5 ? 0 : 1]
    const right = RIGHT[random() < 0.5 ? 0 : 1]
    const top = random() < TOP_PALM_CHANCE
    if (oases.some((o) => (o.u - u) * (o.u - u) + (o.v - v) * (o.v - v) < SPACING * SPACING)) continue
    if (!allDesert(biome, size, u, v)) continue
    // Com a palmeira de cima, as outras ficam nas laterais: uma diagonal ficaria a menos que a
    // distância mínima entre ícones (`DECOR_SPACING`) da de cima.
    const dirs = top ? [LEFT[0], TOP, RIGHT[0]] : [left, right]
    oases.push({ u, v, palms: dirs.map(([du, dv]) => ({ u: u + du * PALM_RADIUS, v: v + dv * PALM_RADIUS })) })
  }
  for (const o of oases) {
    forEachCellInDisk(size, o.u, o.v, OASIS_RING_RADIUS, (i, d2) => {
      biome[i] = d2 <= OASIS_LAKE_RADIUS * OASIS_LAKE_RADIUS ? BIOME.lake : BIOME.grassland
    })
  }
  return oases
}

/** `true` se o disco de `CLEAR_RADIUS` em volta de (u, v) cabe no mapa e é todo deserto. */
function allDesert(biome: Uint8Array, size: number, u: number, v: number): boolean {
  if (u - CLEAR_RADIUS < 0 || v - CLEAR_RADIUS < 0 || u + CLEAR_RADIUS >= 1 || v + CLEAR_RADIUS >= 1) return false
  let ok = true
  forEachCellInDisk(size, u, v, CLEAR_RADIUS, (i) => {
    if (biome[i] !== BIOME.desert) ok = false
  })
  return ok
}

/**
 * Chama `visit` para cada célula cujo centro fica a até `radius` de (u, v), com o quadrado da
 * distância (em frações da largura).
 */
function forEachCellInDisk(
  size: number,
  u: number,
  v: number,
  radius: number,
  visit: (i: number, d2: number) => void,
): void {
  const r2 = radius * radius
  const x0 = Math.max(0, Math.floor((u - radius) * size))
  const x1 = Math.min(size - 1, Math.floor((u + radius) * size))
  const y0 = Math.max(0, Math.floor((v - radius) * size))
  const y1 = Math.min(size - 1, Math.floor((v + radius) * size))
  for (let y = y0; y <= y1; y++) {
    const dv = (y + 0.5) / size - v
    for (let x = x0; x <= x1; x++) {
      const du = (x + 0.5) / size - u
      const d2 = du * du + dv * dv
      if (d2 <= r2) visit(y * size + x, d2)
    }
  }
}
