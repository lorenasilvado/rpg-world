/**
 * Os 7 tipos de pin (pins.md → Tipos de pin), na ordem do design system. O id é o que o mundo salva
 * em `Pin.type`; o rótulo é o que a interface mostra.
 */
export const PIN_TYPES = [
  { id: 'cidade', label: 'Cidade' },
  { id: 'vila', label: 'Vila' },
  { id: 'castelo', label: 'Castelo' },
  { id: 'masmorra', label: 'Masmorra' },
  { id: 'npc', label: 'NPC' },
  { id: 'poi', label: 'Ponto de interesse' },
  { id: 'custom', label: 'Personalizado' },
] as const

export type PinType = (typeof PIN_TYPES)[number]['id']

/** O tipo do primeiro pin de um mundo. */
export const DEFAULT_PIN_TYPE: PinType = 'cidade'

/** O nome de um pin novo. */
export const NEW_PIN_NAME = 'Novo pin'

export function isPinType(value: string): value is PinType {
  return PIN_TYPES.some((t) => t.id === value)
}

/** O tipo salvo como um dos 7 (um valor desconhecido vira Personalizado). */
export function pinType(value: string): PinType {
  return isPinType(value) ? value : 'custom'
}

export function pinTypeLabel(type: string): string {
  return PIN_TYPES.find((t) => t.id === type)?.label ?? 'Personalizado'
}
