import type { Pin } from '../../persistence/types'

/** Quantos resultados a busca mostra, no máximo (o resto pede um texto mais preciso). */
export const SEARCH_LIMIT = 50

/** Um resultado da busca: o pin e as tags dele que batem com o texto (vazio se bateu pelo nome). */
export type SearchResult = { pin: Pin; tags: string[] }

/** Minúsculas e sem acento: "Ávila" e "avila" são o mesmo texto para a busca. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/**
 * Busca os pins por nome e por tag (pins.md → Buscar, AC-F3-16), sem diferenciar maiúsculas nem
 * acentos. Vem primeiro quem tem o nome começando pelo texto, depois quem o tem no meio do nome, e
 * por fim quem só bate por uma tag (começando pelo texto antes de no meio dela); no mesmo nível,
 * pelo nome, em ordem alfabética. Texto vazio não acha nada. Devolve até `limit` resultados e o total.
 */
export function searchPins(pins: readonly Pin[], query: string, limit = SEARCH_LIMIT): { results: SearchResult[]; total: number } {
  const q = normalize(query)
  if (!q) return { results: [], total: 0 }
  const ranked: { result: SearchResult; rank: number; name: string }[] = []
  for (const pin of pins) {
    const name = normalize(pin.name)
    const tags = pin.tags.filter((t) => normalize(t).includes(q))
    let rank: number
    if (name.startsWith(q)) rank = 0
    else if (name.includes(q)) rank = 1
    else if (tags.some((t) => normalize(t).startsWith(q))) rank = 2
    else if (tags.length > 0) rank = 3
    else continue
    ranked.push({ result: { pin, tags }, rank, name })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'pt-BR'))
  return { results: ranked.slice(0, limit).map((r) => r.result), total: ranked.length }
}
