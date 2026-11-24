/**
 * Os campos livres do pin (pins.md → E2 → Aba Detalhes, AC-F3-10): pares chave/valor, na ordem em
 * que foram criados. A chave não fica vazia, não repete outra (sem diferenciar maiúsculas) e não é
 * só de dígitos: o objeto do JavaScript põe as chaves numéricas ("1200") na frente das outras, e o
 * campo mudaria de lugar.
 */
export type Fields = Readonly<Record<string, string>>

/** Até quantos caracteres a chave e o valor têm. */
export const FIELD_KEY_MAX = 40
export const FIELD_VALUE_MAX = 200

/** A chave de um campo novo. */
export const NEW_FIELD_KEY = 'Campo'

function hasKey(fields: Fields, key: string, except?: string): boolean {
  const k = key.toLocaleLowerCase('pt-BR')
  return Object.keys(fields).some((other) => other !== except && other.toLocaleLowerCase('pt-BR') === k)
}

/** Um campo novo no fim, vazio: "Campo" (ou "Campo 2", "Campo 3"… se já existe). */
export function addField(fields: Fields): { fields: Record<string, string>; key: string } {
  let key = NEW_FIELD_KEY
  for (let n = 2; hasKey(fields, key); n++) key = `${NEW_FIELD_KEY} ${n}`
  return { fields: { ...fields, [key]: '' }, key }
}

/** Uma chave só de dígitos (o JavaScript a poria na frente das outras). */
export function isDigitsOnly(key: string): boolean {
  return /^\d+$/.test(key)
}

/**
 * Troca a chave `from` por `to` (sem os espaços das pontas), no mesmo lugar. Vazia, repetida ou só
 * de dígitos, não troca (`null`).
 */
export function renameField(fields: Fields, from: string, to: string): Record<string, string> | null {
  const key = to.trim().slice(0, FIELD_KEY_MAX)
  if (!key || isDigitsOnly(key) || !(from in fields) || hasKey(fields, key, from)) return null
  if (key === from) return { ...fields }
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => (k === from ? [key, v] : [k, v])))
}

export function setFieldValue(fields: Fields, key: string, value: string): Record<string, string> {
  return { ...fields, [key]: value.slice(0, FIELD_VALUE_MAX) }
}

export function removeField(fields: Fields, key: string): Record<string, string> {
  const { [key]: _removed, ...rest } = fields
  return rest
}
