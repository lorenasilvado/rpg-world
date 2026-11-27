/**
 * O estado da ferramenta Rota automática (estradas.md, AC-F5-12), em TS puro: a dica de cada passo
 * e o nome da rota criada.
 */

/** O passo da ferramenta: escolhendo a origem, escolhendo o destino ou esperando o worker. */
export type RouteStep = 'from' | 'to' | 'calculating'

/** A dica da ferramenta, no topo do mapa. */
export function routeHint(step: RouteStep): string {
  if (step === 'from') return 'Clique no pin de origem'
  if (step === 'to') return 'Agora clique no pin de destino'
  return 'Calculando a rota…'
}

/** O nome da rota criada entre os pins `from` e `to`. */
export function routeName(from: string, to: string): string {
  return `Rota de ${from} a ${to}`
}

/** O nome da rota marítima criada pelo toast Sem caminho (AC-F5-13). */
export function seaRouteName(from: string, to: string): string {
  return `Rota marítima de ${from} a ${to}`
}

/**
 * O texto do toast Sem caminho (AC-F5-13): sem caminho por terra, ou (`sea: true`) nem pela água,
 * como entre dois lagos.
 */
export function noPathMessage(from: string, to: string, { sea = false }: { sea?: boolean } = {}): string {
  return sea ? `Não há caminho entre ${from} e ${to}.` : `Não há caminho por terra entre ${from} e ${to}.`
}
