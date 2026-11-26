/**
 * Quem é o renderer atual da área do mapa (o `host`). No dev, o StrictMode do React monta o mapa duas
 * vezes, e cada montagem cria um renderer, que é assíncrono: o primeiro é destruído quando termina de
 * ser criado, e pode terminar depois do segundo. Sem dono, a limpeza dele apagaria os atributos que o
 * renderer atual já escreveu no `host` (como `data-terrain-size`, escrito uma vez só), e os testes
 * esperariam por eles para sempre.
 *
 * Cada renderer pega o `host` ao começar (`claimHost`, o mais recente é o dono) e, ao ser destruído,
 * só limpa o `host` se ainda for o dono (`releaseHost`).
 */
const owners = new WeakMap<HTMLElement, symbol>()

/** O renderer que começa a ser criado passa a ser o dono do `host`. */
export function claimHost(host: HTMLElement): symbol {
  const token = Symbol('map-renderer')
  owners.set(host, token)
  return token
}

/** Solta o `host`; `true` se `token` ainda era o dono (aí a limpeza do `host` é dele). */
export function releaseHost(host: HTMLElement, token: symbol): boolean {
  if (owners.get(host) !== token) return false
  owners.delete(host)
  return true
}
