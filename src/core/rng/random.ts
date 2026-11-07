import Alea from 'alea'

/** Gerador pseudoaleatório determinístico (alea) a partir de uma seed: números em [0, 1). */
export function createRandom(seed: string): () => number {
  const alea = Alea(seed)
  return () => alea()
}
