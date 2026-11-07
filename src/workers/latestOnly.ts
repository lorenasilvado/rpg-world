/**
 * Cancelamento por número de versão (AC-M0-14): cada pedido ganha uma versão crescente, e só o
 * resultado do pedido mais novo chega a quem pediu.
 *
 * O worker roda um pedido por vez e não dá para interromper uma geração no meio. Então fica no
 * máximo um pedido em andamento e um na espera: um pedido novo toma o lugar do que esperava
 * (que nem chega ao worker), e o resultado do que estava em andamento é descartado se, quando
 * ele termina, já existe um pedido mais novo. Quem perdeu a vez recebe `null`.
 */
export type Delivered<Res> = { version: number; result: Res }

export type LatestOnly<Req, Res> = {
  /** Faz um pedido. Resolve com o resultado, ou com `null` se um pedido mais novo o substituiu. */
  request(req: Req): Promise<Delivered<Res> | null>
  /** Versão do pedido mais novo (0 antes do primeiro). */
  latestVersion(): number
}

type Job<Req, Res> = {
  req: Req
  version: number
  resolve: (value: Delivered<Res> | null) => void
  reject: (reason: unknown) => void
}

export function createLatestOnly<Req, Res>(run: (req: Req, version: number) => Promise<Res>): LatestOnly<Req, Res> {
  let latest = 0
  let running = false
  let waiting: Job<Req, Res> | null = null

  const pump = () => {
    if (running || !waiting) return
    const job = waiting
    waiting = null
    running = true
    run(job.req, job.version).then(
      (result) => job.resolve(job.version === latest ? { version: job.version, result } : null),
      (error) => (job.version === latest ? job.reject(error) : job.resolve(null)),
    ).finally(() => {
      running = false
      pump()
    })
  }

  return {
    request(req) {
      const version = ++latest
      return new Promise((resolve, reject) => {
        waiting?.resolve(null)
        waiting = { req, version, resolve, reject }
        pump()
      })
    },
    latestVersion: () => latest,
  }
}
