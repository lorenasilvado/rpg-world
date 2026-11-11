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
 *
 * Os pedidos em andamento ficam num conjunto da conexão e saem dele ao terminar: a falha rejeita só
 * os que ainda estão lá. (Correr cada pedido contra uma promise de falha que dura o worker inteiro
 * deixaria presa nela uma reação por pedido, com o resultado, e todo mapa da sessão ficaria na
 * memória.)
 */
export type Generator = NewerOnly<GenerateRequest, GenerateResult> & {
  /**
   * Se o último resultado veio por transferência, sem cópia (só o bench usa). Rejeita com
   * `GeneratorWorkerError` se ainda não há worker (nenhum pedido feito, ou o worker falhou).
   */
  lastResultTransferred(): Promise<boolean>
  terminate(): void
  /** Quantos pedidos ao worker estão em andamento (para os testes). */
  pendingCalls(): number
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

type Connection = {
  worker: WorkerLike
  api: Remote<GeneratorApi>
  /** Quem rejeitar se o worker falhar: os pedidos em andamento. */
  pending: Set<(error: GeneratorWorkerError) => void>
}

export function createGenerator(spawn: () => WorkerLike = createWorker): Generator {
  let conn: Connection | null = null

  const connect = (): Connection => {
    if (conn) return conn
    const worker = spawn()
    const api = wrap<GeneratorApi>(worker)
    const current: Connection = { worker, api, pending: new Set() }
    const fail = (error: GeneratorWorkerError) => {
      for (const reject of current.pending) reject(error)
      current.pending.clear()
    }
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
    const { api, pending } = connect()
    return new Promise<T>((resolve, reject) => {
      pending.add(reject)
      fn(api).then(
        (value) => {
          pending.delete(reject)
          resolve(value)
        },
        (error) => {
          pending.delete(reject)
          reject(error)
        },
      )
    })
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
    pendingCalls: () => conn?.pending.size ?? 0,
  }
}
