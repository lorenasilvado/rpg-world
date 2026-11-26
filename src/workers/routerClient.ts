import { releaseProxy, wrap, type Remote } from 'comlink'
import type { RouteField } from '../core'
import type { WorkerLike } from './generatorClient'
import type { RouteRequest, RouteResponse, RouterApi } from './routerApi'

/**
 * Lado da thread principal do worker de rota (F5, AC-F5-11). Os pedidos vão ao worker um de cada
 * vez, na ordem em que chegaram:
 *
 * - `setField` manda o campo do mapa (só o bioma, a elevação e os rios, por cópia: o campo continua
 *   no editor), e o worker monta a grade de custo. Ele nunca é cancelado.
 * - `route` pede uma rota, com cancelamento pelo `signal`: cancelada na fila, ela não chega ao
 *   worker; cancelada no worker, a promise rejeita na hora (`AbortError`) e o resultado, quando vem,
 *   é descartado. A resposta diz `route: null` quando não há caminho.
 *
 * Se o worker falhar (não carregar, lançar um erro fora do Comlink ou mandar uma mensagem que não
 * dá para ler), os pedidos em andamento e na fila rejeitam com `RouterWorkerError` e o worker é
 * descartado; o próximo pedido cria um novo, que recebe de novo o último campo antes da rota.
 */
export type Router = {
  setField(field: RouteField): Promise<{ gridMs: number }>
  route(req: RouteRequest, options?: { signal?: AbortSignal }): Promise<RouteResponse>
  terminate(): void
  /** Quantos pedidos estão no worker ou na fila (para os testes). */
  pendingCalls(): number
}

export class RouterWorkerError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'RouterWorkerError'
  }
}

/** O erro de uma rota cancelada, como o do `fetch` cancelado. */
export const abortError = () => new DOMException('A rota foi cancelada.', 'AbortError')

const createWorker = (): WorkerLike =>
  new Worker(new URL('./router.worker.ts', import.meta.url), { type: 'module', name: 'router' })

type Job = {
  run: (api: Remote<RouterApi>) => Promise<unknown>
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  /** Já respondido (cancelado ou com falha): o resultado que vier é descartado. */
  settled: boolean
  signal?: AbortSignal
  onAbort?: () => void
  /** O pedido é o `setField`: ele mesmo manda o campo. */
  sendsField?: boolean
}

type Connection = { api: Remote<RouterApi>; fail: (e: RouterWorkerError) => void }

/** Só o que a rota usa do campo: o resto (umidade, decoração…) não vai ao worker. */
const routeFieldOf = ({ width, height, biome, elevation, rivers }: RouteField): RouteField => ({
  width,
  height,
  biome,
  elevation,
  rivers,
})

export function createRouter(spawn: () => WorkerLike = createWorker): Router {
  let conn: Connection | null = null
  let lastField: RouteField | null = null
  /** O worker atual já tem o último campo. */
  let fieldSent = false
  const queue: Job[] = []
  let running: Job | null = null

  const settle = (job: Job, fn: () => void) => {
    if (job.settled) return
    job.settled = true
    if (job.onAbort) job.signal?.removeEventListener('abort', job.onAbort)
    fn()
  }

  const connect = (): Connection => {
    if (conn) return conn
    const worker = spawn()
    const api = wrap<RouterApi>(worker)
    const drop = () => {
      worker.removeEventListener('error', onError)
      worker.removeEventListener('messageerror', onMessageError)
      worker.terminate()
      if (conn === current) {
        conn = null
        fieldSent = false
      }
    }
    const fail = (error: RouterWorkerError) => {
      drop()
      const jobs = [...(running ? [running] : []), ...queue.splice(0)]
      running = null
      for (const job of jobs) settle(job, () => job.reject(error))
    }
    const onError = (event: Event) =>
      fail(new RouterWorkerError(event instanceof ErrorEvent && event.message ? event.message : 'o worker de rota falhou', { cause: event }))
    const onMessageError = (event: Event) =>
      fail(new RouterWorkerError('o worker de rota mandou uma mensagem que não dá para ler', { cause: event }))
    worker.addEventListener('error', onError)
    worker.addEventListener('messageerror', onMessageError)
    const current: Connection = { api, fail }
    conn = current
    fieldSent = false
    return current
  }

  const pump = () => {
    if (running) return
    const job = queue.shift()
    if (!job) return
    let api: Remote<RouterApi>
    try {
      api = connect().api
    } catch (error) {
      // O worker não pôde ser criado: este pedido falha, e a fila segue (o próximo tenta de novo).
      settle(job, () => job.reject(new RouterWorkerError('o worker de rota não pôde ser criado', { cause: error })))
      pump()
      return
    }
    running = job
    // Num worker novo (o primeiro, ou depois de uma falha), o último campo vai antes.
    const field = !fieldSent && !job.sendsField ? lastField : null
    fieldSent = true
    const ready = field ? api.setField(field) : Promise.resolve()
    ready
      .then(() => job.run(api))
      .then(
        (value) => settle(job, () => job.resolve(value)),
        (error) => settle(job, () => job.reject(error)),
      )
      .finally(() => {
        // Depois de uma falha, `running` já foi limpo (e pode ser outro pedido, num worker novo).
        if (running !== job) return
        running = null
        pump()
      })
  }

  const enqueue = <T,>(run: (api: Remote<RouterApi>) => Promise<T>, signal?: AbortSignal, sendsField = false): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (signal?.aborted) return reject(abortError())
      const job: Job = { run, resolve: resolve as (value: unknown) => void, reject, settled: false, signal, sendsField }
      if (signal) {
        job.onAbort = () => {
          const at = queue.indexOf(job)
          if (at >= 0) queue.splice(at, 1)
          settle(job, () => reject(abortError()))
        }
        signal.addEventListener('abort', job.onAbort)
      }
      queue.push(job)
      pump()
    })

  return {
    setField(field) {
      const data = routeFieldOf(field)
      lastField = data
      return enqueue((api) => api.setField(data), undefined, true)
    },
    route: (req, options) => enqueue((api) => api.route(req), options?.signal),
    terminate() {
      if (!conn) return
      conn.api[releaseProxy]()
      conn.fail(new RouterWorkerError('o worker de rota foi encerrado'))
    },
    pendingCalls: () => (running ? 1 : 0) + queue.length,
  }
}
