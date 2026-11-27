import type { ConnectRequest, ConnectResponse, RouteRequest, RouteResponse } from '../../workers/routerApi'
import { createRouter, type Router } from '../../workers/routerClient'
import { MAP_SIZE } from '../../state/sizes'
import type { WorldStore } from '../../state/worldStore'

/**
 * O worker de rota do mundo aberto (estradas.md, AC-F5-12): criado só na primeira rota pedida (o
 * editor abre sem ele), recebe o mapa final (1024²) exibido e cada mapa final novo; as prévias do
 * arrasto dos sliders não vão. `dispose` encerra o worker (o mundo fechou).
 */
export type WorldRouter = {
  route(req: RouteRequest, options?: { signal?: AbortSignal }): Promise<RouteResponse>
  /** "Conectar cidades" (AC-F5-14): a malha entre as cidades. */
  connect(req: ConnectRequest, options?: { signal?: AbortSignal }): Promise<ConnectResponse>
  dispose(): void
}

export function createWorldRouter(world: WorldStore, make: () => Router = createRouter): WorldRouter {
  let router: Router | null = null
  let sent: unknown = null
  let unsubscribe: (() => void) | null = null
  const send = (r: Router, field: ReturnType<WorldStore['getState']>['field']) => {
    if (!field || field.width < MAP_SIZE || field === sent) return
    sent = field
    // Uma falha aqui aparece na rota seguinte (o worker sem grade rejeita o pedido).
    r.setField(field).catch(() => {})
  }
  const ensure = (): Router => {
    if (router) return router
    const r = make()
    router = r
    send(r, world.getState().field)
    unsubscribe = world.subscribe((state) => send(r, state.field))
    return r
  }
  return {
    route: (req, options) => ensure().route(req, options),
    connect: (req, options) => ensure().connect(req, options),
    dispose() {
      unsubscribe?.()
      unsubscribe = null
      router?.terminate()
      router = null
      sent = null
    },
  }
}
