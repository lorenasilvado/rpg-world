import { buildCostGrid, findRoute, type CostGrid, type Route, type RouteField, type RouteMode, type RoutePoint } from '../core'

/**
 * API que o worker de rota expõe pelo Comlink (`router.worker.ts`; F5, AC-F5-09 a 11). Fica num
 * módulo à parte para o Vitest testá-la sem worker. O relógio (`performance`) é usado só aqui, para
 * medir: o núcleo (`src/core/routing`) continua determinístico.
 *
 * O worker guarda a grade de custo do último campo (`setField`): cada rota roda só o A*.
 */
export type RouteRequest = { from: RoutePoint; to: RoutePoint; mode: RouteMode }

export type RouteResponse = {
  /** A rota, ou `null` quando não há caminho (por terra, ex.: um pin numa ilha). */
  route: Route | null
  /** Tempo da rota dentro do worker, em ms. */
  workerMs: number
}

let grid: CostGrid | null = null

export const routerApi = {
  /**
   * Monta a grade de custo do campo; devolve o tempo dela, em ms. A grade anterior sai antes: se o
   * campo novo falhar, as rotas seguintes falham também, em vez de rodar no mapa antigo.
   */
  setField(field: RouteField): { gridMs: number } {
    const start = performance.now()
    grid = null
    grid = buildCostGrid(field)
    return { gridMs: performance.now() - start }
  },

  route({ from, to, mode }: RouteRequest): RouteResponse {
    if (!grid) throw new Error('o worker de rota ainda não recebeu o campo do mapa')
    const start = performance.now()
    const route = findRoute(grid, from, to, mode)
    return { route, workerMs: performance.now() - start }
  },

  /** Esquece a grade (para os testes). */
  reset(): void {
    grid = null
  },
}

export type RouterApi = typeof routerApi
