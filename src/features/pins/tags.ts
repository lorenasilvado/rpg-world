/** O tamanho máximo de uma tag. */
export const TAG_MAX = 32

/** Quantas tags "Usadas no mundo" o drawer sugere. */
export const SUGGESTED_TAGS = 6

/** A tag como ela fica salva: sem espaços nas pontas e com os espaços do meio juntados num só. */
export function normalizeTag(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, TAG_MAX).trimEnd()
}

/** A chave que compara tags: "Porto" e "porto" são a mesma. */
function tagKey(tag: string): string {
  return tag.toLocaleLowerCase('pt-BR')
}

/** Se a tag já está na lista (sem diferenciar maiúsculas). */
export function hasTag(tags: readonly string[], tag: string): boolean {
  const key = tagKey(tag)
  return tags.some((t) => tagKey(t) === key)
}

/**
 * As tags com o texto digitado no fim (AC-F3-08). Uma tag vazia ou repetida (sem diferenciar
 * maiúsculas) não entra: a lista volta igual (a mesma referência).
 */
export function addTag(tags: readonly string[], text: string): readonly string[] {
  const tag = normalizeTag(text)
  if (!tag || hasTag(tags, tag)) return tags
  return [...tags, tag]
}

/** As tags sem a tag do chip. */
export function removeTag(tags: readonly string[], tag: string): string[] {
  return tags.filter((t) => t !== tag)
}

/**
 * As sugestões "Usadas no mundo" (AC-F3-08): as tags dos outros pins que este pin ainda não tem,
 * das mais usadas para as menos usadas (no empate, a que apareceu primeiro), até `limit`. Grafias
 * que só mudam nas maiúsculas contam como uma tag, com a grafia da primeira vez.
 */
export function suggestedTags(
  pins: readonly { id: string; tags: readonly string[] }[],
  pinId: string,
  limit = SUGGESTED_TAGS,
): string[] {
  const own = pins.find((p) => p.id === pinId)?.tags ?? []
  const counts = new Map<string, { tag: string; count: number; first: number }>()
  for (const pin of pins) {
    if (pin.id === pinId) continue
    for (const tag of pin.tags) {
      const key = tagKey(tag)
      const seen = counts.get(key)
      if (seen) seen.count++
      else counts.set(key, { tag, count: 1, first: counts.size })
    }
  }
  return [...counts.values()]
    .filter((s) => !hasTag(own, s.tag))
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, limit)
    .map((s) => s.tag)
}
