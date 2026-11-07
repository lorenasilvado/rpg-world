import Alea from 'alea'

/**
 * Gerador pseudoaleatório determinístico (alea) a partir de uma seed: números em [0, 1).
 * A seed é sempre passada: sem argumentos, o `alea` usaria o relógio (`+new Date`).
 */
export function createRandom(seed: string): () => number {
  const alea = Alea(seed)
  return () => alea()
}
