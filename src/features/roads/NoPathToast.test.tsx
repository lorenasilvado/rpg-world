import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../../persistence/types'
import { createPinsStore, type PinsStore } from '../../state/pinsStore'
import { createRoadsStore, type RoadsStore } from '../../state/roadsStore'
import type { RouteRequest, RouteResponse } from '../../workers/routerApi'
import { abortError } from '../../workers/routerClient'
import { noPathMessage } from './autoRoute'
import { NoPathToast } from './NoPathToast'
import { useNoPath } from './useNoPath'
import type { WorldRouter } from './worldRouter'

afterEach(cleanup)

const pin = (id: string, name: string, u: number, v: number): Pin => ({
  id,
  type: 'cidade',
  name,
  pos: { u, v },
  icon: { kind: 'builtin', key: 'cidade' },
  description: '',
  tags: [],
  fields: {},
})

type Call = { req: RouteRequest; resolve: (r: RouteResponse) => void; reject: (e: unknown) => void; signal?: AbortSignal }

function fakeRouter() {
  const calls: Call[] = []
  const router: WorldRouter = {
    route: (req, options) =>
      new Promise<RouteResponse>((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(abortError()))
        calls.push({ req, resolve, reject, signal: options?.signal })
      }),
    dispose: vi.fn(),
  }
  return { router, calls }
}

/** O toast como o editor o monta: `open` é o que a Rota automática chama sem caminho por terra. */
function Harness({
  pins,
  roads,
  router,
  onCreated,
  onOpen,
}: {
  pins: PinsStore
  roads: RoadsStore
  router: WorldRouter
  onCreated: () => void
  onOpen: (open: (from: string, to: string) => void) => void
}) {
  const { noPath, open, close, createSea } = useNoPath({ pins, roads, router, onCreated })
  useEffect(() => onOpen(open), [onOpen, open])
  return noPath ? (
    <NoPathToast
      message={noPathMessage(noPath.fromName, noPath.toName, { sea: noPath.sea === 'none' })}
      onCreateSea={noPath.sea === 'none' ? undefined : createSea}
      busy={noPath.sea === 'calculating'}
      onClose={close}
    />
  ) : null
}

function setup() {
  const pins = createPinsStore([pin('a', 'Porto', 0.4, 0.4), pin('b', 'Ilha', 0.8, 0.8)])
  let n = 0
  const roads = createRoadsStore([], pins, { newId: () => `r${++n}` })
  const { router, calls } = fakeRouter()
  const onCreated = vi.fn()
  let open: ((from: string, to: string) => void) | undefined
  render(<Harness pins={pins} roads={roads} router={router} onCreated={onCreated} onOpen={(fn) => (open = fn)} />)
  act(() => open!('a', 'b'))
  return { pins, roads, calls, onCreated }
}

const toast = () => screen.queryByTestId('no-path-toast')
const createButton = () => screen.queryByRole('button', { name: 'Criar rota marítima' })
const SEA = { points: [{ u: 0.4, v: 0.4 }, { u: 0.6, v: 0.7 }, { u: 0.8, v: 0.8 }], cost: 30 }

describe('Sem caminho e rota marítima (AC-F5-13)', () => {
  it('o toast de erro diz que não há caminho por terra e oferece "Criar rota marítima" e Fechar', () => {
    setup()
    expect(screen.getByRole('alert').textContent).toContain('Não há caminho por terra entre Porto e Ilha.')
    expect(toast()!.className).toContain('bg-brick')
    expect(createButton()).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Fechar' })).not.toBeNull()
  })

  it('"Criar rota marítima" calcula pela água e cria "Rota marítima de A a B", ligada aos dois, sem selecioná-la', async () => {
    const { roads, calls, onCreated } = setup()
    fireEvent.click(createButton()!)
    expect(calls).toHaveLength(1)
    expect(calls[0].req).toEqual({ from: { u: 0.4, v: 0.4 }, to: { u: 0.8, v: 0.8 }, mode: 'sea' })
    // Enquanto o worker calcula, a ação espera.
    const busy = screen.getByRole('button', { name: 'Calculando…' }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    fireEvent.click(busy)
    expect(calls).toHaveLength(1)
    await act(async () => calls[0].resolve({ route: SEA, workerMs: 1 }))
    expect(roads.getState().roads).toEqual([{ id: 'r1', name: 'Rota marítima de Porto a Ilha', kind: 'sea', points: SEA.points, from: 'a', to: 'b' }])
    expect(roads.getState().selectedId).toBeNull()
    expect(onCreated).toHaveBeenCalledOnce()
    expect(toast()).toBeNull()
  })

  it('sem caminho nem pela água, nada é criado e o toast diz "Não há caminho entre A e B.", sem a ação', async () => {
    const { roads, calls, onCreated } = setup()
    fireEvent.click(createButton()!)
    await act(async () => calls[0].resolve({ route: null, workerMs: 1 }))
    expect(roads.getState().roads).toEqual([])
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByTestId('no-path-message').textContent).toBe('Não há caminho entre Porto e Ilha.')
    expect(createButton()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(toast()).toBeNull()
  })

  it('Fechar no meio do cálculo cancela, e o resultado é descartado', async () => {
    const { roads, calls } = setup()
    fireEvent.click(createButton()!)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(toast()).toBeNull()
    expect(calls[0].signal?.aborted).toBe(true)
    await act(async () => calls[0].resolve({ route: SEA, workerMs: 1 }))
    expect(roads.getState().roads).toEqual([])
  })

  it('com um pin excluído no meio do cálculo, nada é criado e o toast fecha', async () => {
    const { pins, roads, calls } = setup()
    fireEvent.click(createButton()!)
    act(() => {
      pins.getState().removePin('b')
    })
    await act(async () => calls[0].resolve({ route: SEA, workerMs: 1 }))
    expect(roads.getState().roads).toEqual([])
    expect(toast()).toBeNull()
  })

  it('com o worker em falha, nada é criado e a ação volta', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { roads, calls } = setup()
    fireEvent.click(createButton()!)
    await act(async () => calls[0].reject(new Error('falhou')))
    expect(roads.getState().roads).toEqual([])
    expect(createButton()).not.toBeNull()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
