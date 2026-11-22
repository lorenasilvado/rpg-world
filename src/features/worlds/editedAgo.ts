/**
 * A legenda do cartão da Lista de mundos (mundos.md → 01, AC-F4-04): "Editado há X · N pins", ou
 * "· sem pins". O tempo vem do `updatedAt` (a última gravação) e é contado do instante `now`:
 * menos de 1 minuto é "agora"; depois, minutos, horas, "ontem" (de 24 a 48 h), dias, semanas
 * (a partir de 7 dias), meses (a partir de 30 dias) e anos (a partir de 365 dias), sempre arredondado
 * para baixo. Uma data no futuro (relógio adiantado em outra máquina) conta como "agora".
 */
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function editedAgo(updatedAt: string, now: Date): string {
  const elapsed = now.getTime() - new Date(updatedAt).getTime()
  if (!Number.isFinite(elapsed) || elapsed < MINUTE) return 'Editado agora'
  if (elapsed < HOUR) return `Editado há ${Math.floor(elapsed / MINUTE)} min`
  if (elapsed < DAY) return `Editado há ${Math.floor(elapsed / HOUR)} h`
  const days = Math.floor(elapsed / DAY)
  if (days < 2) return 'Editado ontem'
  if (days < 7) return `Editado há ${days} dias`
  if (days < 30) return `Editado há ${plural(Math.floor(days / 7), 'semana', 'semanas')}`
  if (days < 365) return `Editado há ${plural(Math.floor(days / 30), 'mês', 'meses')}`
  return `Editado há ${plural(Math.floor(days / 365), 'ano', 'anos')}`
}

/** "N pins", "1 pin" ou "sem pins". */
export function pinCount(count: number): string {
  return count === 0 ? 'sem pins' : plural(count, 'pin', 'pins')
}

/** A legenda inteira do cartão. */
export function worldCaption(world: { updatedAt: string; pins: readonly unknown[] }, now: Date): string {
  return `${editedAgo(world.updatedAt, now)} · ${pinCount(world.pins.length)}`
}
