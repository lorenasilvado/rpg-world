import { releaseProxy, wrap, type Remote } from 'comlink'
import type { GenerateRequest, GenerateResult, GeneratorApi } from './generatorApi'
import { createNewerOnly, type NewerOnly } from './newerOnly'

/**
 * Lado da thread principal: cria o worker de geração e entrega todo resultado mais novo que o
 * último entregue (`newerOnly.ts`). Quem pede recebe `null` quando o pedido foi substituído na
 * espera por um mais novo.
 *
 * Se o worker falhar (não carregar, lançar um erro fora do Comlink ou mandar uma mensagem que não
 * dá para ler), o Comlink nunca responderia: o pedido em andamento é rejeitado com um
 * `GeneratorWorkerError` (AC-F1-12), o worker é descartado e o próximo pedido cria um novo. É assim
 * que "Tentar de novo" funciona depois de uma falha ao carregar.
 */
export type Generator = NewerOnly<GenerateRequest, GenerateResult> & {
  /**
   * Se o último resultado veio por transferência, sem cópia (só o bench usa). Rejeita com
   * `GeneratorWorkerError` se ainda não há worker (nenhum pedido feito, ou o worker falhou).
   */
  lastResultTransferred(): Promise<boolean>
  terminate(): void
}

/** O que o cliente usa do `Worker`: o Comlink conversa por mensagens, e os eventos de falha. */
export type WorkerLike = Pick<Worker, 'postMessage' | 'addEventListener' | 'removeEventListener' | 'terminate'>

export class GeneratorWorkerError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'GeneratorWorkerError'
  }
}

const createWorker = (): WorkerLike =>
  new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module', name: 'generator' })

type Connection = { worker: WorkerLike; api: Remote<GeneratorApi>; failed: Promise<never> }

export function createGenerator(spawn: () => WorkerLike = createWorker): Generator {
  let conn: Connection | null = null

  const connect = (): Connection => {
    if (conn) return conn
    const worker = spawn()
    const api = wrap<GeneratorApi>(worker)
    let fail!: (error: GeneratorWorkerError) => void
    const failed = new Promise<never>((_, reject) => (fail = reject))
    // Sem ninguém esperando, a falha não vira "unhandled rejection".
    failed.catch(() => {})
    const current: Connection = { worker, api, failed }
    const onError = (event: Event) => {
      const message = event instanceof ErrorEvent && event.message ? event.message : 'o worker de geração falhou'
      drop(current)
      fail(new GeneratorWorkerError(message, { cause: event }))
    }
    const onMessageError = (event: Event) => {
      drop(current)
      fail(new GeneratorWorkerError('o worker de geração mandou uma mensagem que não dá para ler', { cause: event }))
    }
    const drop = (c: Connection) => {
      worker.removeEventListener('error', onError)
      worker.removeEventListener('messageerror', onMessageError)
      worker.terminate()
      if (conn === c) conn = null
    }
    worker.addEventListener('error', onError)
    worker.addEventListener('messageerror', onMessageError)
    conn = current
    return current
  }

  /** Chama o worker, e rejeita se ele falhar antes de responder. */
  const call = <T>(fn: (api: Remote<GeneratorApi>) => Promise<T>): Promise<T> => {
    const { api, failed } = connect()
    return Promise.race([fn(api), failed])
  }

  const newer = createNewerOnly((req: GenerateRequest) => call((api) => api.generate(req)))
  return {
    ...newer,
    // Sem worker (antes do primeiro pedido ou depois de uma falha) não há último resultado: criar
    // um worker só para perguntar daria `false`, uma resposta errada.
    lastResultTransferred: () =>
      conn
        ? call((api) => api.lastResultTransferred())
        : Promise.reject(new GeneratorWorkerError('o worker de geração não tem resultado: ainda não gerou ou falhou')),
    terminate() {
      if (!conn) return
      conn.api[releaseProxy]()
      conn.worker.terminate()
      conn = null
    },
  }
}
