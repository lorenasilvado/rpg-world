/**
 * As regras das tags do pin que o estado também usa: a chave que as compara e a lista sem as
 * repetidas. O resto das tags (normalizar, adicionar, remover, sugerir) fica em
 * `features/pins/tags.ts`.
 */

/** A chave que compara tags: "Porto" e "porto" são a mesma. */
export function tagKey(tag: string): string {
  return tag.toLocaleLowerCase('pt-BR')
}

/**
 * As tags sem as repetidas (sem diferenciar maiúsculas), com a grafia da primeira vez. Um mundo
 * salvo ou importado pode trazer uma tag repetida; o drawer supõe que elas são únicas (o chip é
 * a chave da lista e o "remover" tira a tag pelo texto). Sem repetidas, a lista volta igual (a
 * mesma referência).
 */
export function uniqueTags(tags: readonly string[]): readonly string[] {
  const seen = new Set<string>()
  const out = tags.filter((t) => {
    const key = tagKey(t)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return out.length === tags.length ? tags : out
}
