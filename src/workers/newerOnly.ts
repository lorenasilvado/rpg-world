/**
 * Entrega por número de versão (#45, AC-F1-10): cada pedido ganha uma versão crescente, e chega a
 * quem pediu todo resultado mais novo que o último entregue. Um resultado velho nunca chega depois
 * de um novo.
 *
 * O worker roda um pedido por vez e não dá para interromper uma geração no meio. Então fica no
 * máximo um pedido em andamento e um na espera: um pedido novo toma o lugar do que esperava (que
 * nem chega ao worker, e recebe `null`). O que estava em andamento chega quando termina, mesmo que
 * já exista um pedido mais novo: é assim que o mapa continua atualizando durante o arrasto de um
 * slider, com pedidos mais rápidos que a geração. Só é descartado (`null`) um resultado com versão
 * menor ou igual à do último entregue.
 */
export type Delivered<Res> = { version: number; result: Res }

export type NewerOnly<Req, Res> = {
  /** Faz um pedido. Resolve com o resultado, ou com `null` se ele foi substituído ou ficou velho. */
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

export function createNewerOnly<Req, Res>(run: (req: Req, version: number) => Promise<Res>): NewerOnly<Req, Res> {
  let latest = 0
  let delivered = 0
  let running = false
  let waiting: Job<Req, Res> | null = null

  const pump = () => {
    if (running || !waiting) return
    const job = waiting
    waiting = null
    running = true
    run(job.req, job.version)
      .then(
        (result) => {
          if (job.version <= delivered) return job.resolve(null)
          delivered = job.version
          job.resolve({ version: job.version, result })
        },
        // O erro só chega se for do pedido mais novo; o de um pedido já superado vira `null`.
        (error) => (job.version === latest ? job.reject(error) : job.resolve(null)),
      )
      .finally(() => {
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
