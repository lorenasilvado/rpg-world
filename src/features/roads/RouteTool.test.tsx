import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_PARAMS } from '../../core'
import type { Pin } from '../../persistence/types'
import { createCameraStore } from '../../state/cameraStore'
import { createWorldHistory } from '../../state/history'
import { createPinsStore } from '../../state/pinsStore'
import { createRoadsStore } from '../../state/roadsStore'
import { createUiStore } from '../../state/uiStore'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import type { ConnectRequest, ConnectResponse, RouteRequest, RouteResponse } from '../../workers/routerApi'
import { abortError } from '../../workers/routerClient'
import { MapToolbar } from '../map/MapToolbar'
import { MeasureTool } from '../map/MeasureTool'
import { PinTool } from '../pins/PinTool'
import { RouteTool } from './RouteTool'
import type { WorldRouter } from './worldRouter'

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

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
type Connect = { req: ConnectRequest; resolve: (r: ConnectResponse) => void; reject: (e: unknown) => void; signal?: AbortSignal }

/** Um worker de rota de mentira: cada pedido espera até o teste responder (`answer`). */
function fakeRouter() {
  const calls: Call[] = []
  const connects: Connect[] = []
  const router: WorldRouter = {
    route: (req, options) =>
      new Promise<RouteResponse>((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(abortError()))
        calls.push({ req, resolve, reject, signal: options?.signal })
      }),
    connect: (req, options) =>
      new Promise<ConnectResponse>((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(abortError()))
        connects.push({ req, resolve, reject, signal: options?.signal })
      }),
    dispose: vi.fn(),
  }
  return { router, calls, connects }
}

/**
 * O editor de mentira, como no teste do Desenhar estrada: a câmera mostra o mundo com 1 px por
 * unidade. O pin "a" (Vila Alta) fica em 256,256, o "b" (Porto Sul) em 768,512 e o "c" em 512,768;
 * o clique no pin é um pouco acima da âncora (a base do desenho).
 */
function setup({ disabled = false, extraPins = [] as Pin[] } = {}) {
  const ui = createUiStore()
  const world = createWorldStore(idleGenerator, { params: DEFAULT_WORLD_PARAMS })
  const pins = createPinsStore([pin('a', 'Vila Alta', 0.25, 0.25), pin('b', 'Porto Sul', 0.75, 0.5), pin('c', 'Forte', 0.5, 0.75), ...extraPins])
  let n = 0
  const roads = createRoadsStore([], pins, { newId: () => `r${++n}` })
  const history = createWorldHistory({ world, pins, roads })
  const camera = createCameraStore()
  camera.getState().update({ zoom: 1, scale: 1, view: { x: 0, y: 0, width: 1024, height: 1024 }, origin: { x: 0, y: 0 } })
  const { router, calls, connects } = fakeRouter()
  const onCreated = vi.fn()
  const onNoPath = vi.fn()
  const onConnected = vi.fn()
  render(
    <div>
      <main data-testid="map">
        <canvas data-testid="canvas" />
      </main>
      <input aria-label="Seed" />
      <MapToolbar ui={ui} />
      <MeasureTool ui={ui} world={world} camera={camera} disabled={disabled} />
      <PinTool ui={ui} pins={pins} camera={camera} roads={roads} disabled={disabled} />
      <RouteTool ui={ui} roads={roads} pins={pins} camera={camera} router={router} disabled={disabled} onCreated={onCreated} onNoPath={onNoPath} onConnected={onConnected} />
    </div>,
  )
  return { ui, pins, roads, history, calls, connects, onCreated, onNoPath, onConnected }
}

const canvas = () => screen.getByTestId('canvas')
function click(x: number, y: number) {
  fireEvent.pointerDown(canvas(), { pointerId: 1, button: 0, clientX: x, clientY: y, pointerType: 'mouse' })
  fireEvent.pointerUp(canvas(), { pointerId: 1, button: 0, clientX: x, clientY: y, pointerType: 'mouse' })
}
const clickA = () => click(256, 245)
const clickB = () => click(768, 500)
const hint = () => screen.getByTestId('route-hint').textContent
async function answer(call: Call, route: RouteResponse['route']) {
  await act(async () => call.resolve({ route, workerMs: 1 }))
}
const ROUTE = { points: [{ u: 0.25, v: 0.25 }, { u: 0.5, v: 0.3 }, { u: 0.75, v: 0.5 }], cost: 10 }

describe('Rota automática (AC-F5-12)', () => {
  it('a tecla A e a ferramenta da toolbar ligam a ferramenta, com a dica', () => {
    const { ui } = setup()
    expect(screen.queryByTestId('route-layer')).toBeNull()
    fireEvent.keyDown(document.body, { key: 'a' })
    expect(ui.getState().tool).toBe('route')
    expect(hint()).toBe('Clique no pin de origem')
    expect(screen.getByRole('status').textContent).toBe('Clique no pin de origem·Conectar cidades')
    act(() => ui.getState().setTool('nav'))
    const button = screen.getByRole('button', { name: 'Rota automática' })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    expect(ui.getState().tool).toBe('route')
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('a tecla A não vale com o foco num campo nem com um painel sobreposto aberto', () => {
    const { ui } = setup()
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    seed.focus()
    fireEvent.keyDown(seed, { key: 'a' })
    expect(ui.getState().tool).toBe('nav')
    cleanup()
    const closed = setup({ disabled: true })
    fireEvent.keyDown(document.body, { key: 'A' })
    expect(closed.ui.getState().tool).toBe('nav')
  })

  it('origem e destino criam "Rota de A a B" ligada aos dois, sem selecionar, com um passo no Desfazer', async () => {
    const { ui, pins, roads, history, calls, onCreated } = setup()
    act(() => ui.getState().setTool('route'))
    clickA()
    // A origem fica com o anel, sem ser selecionada (o drawer não abre).
    expect(pins.getState().markedId).toBe('a')
    expect(pins.getState().selectedId).toBeNull()
    expect(hint()).toBe('Agora clique no pin de destino')
    // O clique no próprio pin de origem não faz nada.
    clickA()
    expect(calls).toHaveLength(0)
    clickB()
    expect(calls).toHaveLength(1)
    expect(calls[0].req).toEqual({ from: { u: 0.25, v: 0.25 }, to: { u: 0.75, v: 0.5 }, mode: 'land' })
    expect(hint()).toBe('Calculando a rota…')
    const preview = screen.getByTestId('route-preview')
    expect([preview.getAttribute('x1'), preview.getAttribute('y1'), preview.getAttribute('x2'), preview.getAttribute('y2')]).toEqual([
      '256',
      '256',
      '768',
      '512',
    ])
    expect(preview.getAttribute('stroke')).toBe('#C8892B')
    // Durante o cálculo, outro clique não pede outra rota.
    click(512, 757)
    expect(calls).toHaveLength(1)
    await answer(calls[0], ROUTE)
    expect(roads.getState().roads).toEqual([
      { id: 'r1', name: 'Rota de Vila Alta a Porto Sul', kind: 'road', points: ROUTE.points, from: 'a', to: 'b' },
    ])
    expect(roads.getState().selectedId).toBeNull()
    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(pins.getState().markedId).toBeNull()
    expect(screen.queryByTestId('route-preview')).toBeNull()
    // A ferramenta continua ligada, pronta para a próxima rota.
    expect(ui.getState().tool).toBe('route')
    expect(hint()).toBe('Clique no pin de origem')
    act(() => history.undo())
    expect(roads.getState().roads).toEqual([])
  })

  it('Esc com a origem marcada cancela; sem nada, volta para Navegar', () => {
    const { ui, pins } = setup()
    act(() => ui.getState().setTool('route'))
    clickA()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(pins.getState().markedId).toBeNull()
    expect(ui.getState().tool).toBe('route')
    expect(hint()).toBe('Clique no pin de origem')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(ui.getState().tool).toBe('nav')
  })

  it('Esc no meio do cálculo cancela a rota, e o resultado que chegar é descartado', async () => {
    const { ui, roads, calls, onCreated } = setup()
    act(() => ui.getState().setTool('route'))
    clickA()
    clickB()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(calls[0].signal?.aborted).toBe(true)
    expect(hint()).toBe('Clique no pin de origem')
    expect(screen.queryByTestId('route-preview')).toBeNull()
    await answer(calls[0], ROUTE)
    expect(roads.getState().roads).toEqual([])
    expect(onCreated).not.toHaveBeenCalled()
    expect(ui.getState().tool).toBe('route')
  })

  it('trocar de ferramenta cancela o cálculo e tira o anel da origem', async () => {
    const { ui, pins, roads, calls } = setup()
    act(() => ui.getState().setTool('route'))
    clickA()
    clickB()
    act(() => ui.getState().setTool('road'))
    expect(calls[0].signal?.aborted).toBe(true)
    expect(pins.getState().markedId).toBeNull()
    await answer(calls[0], ROUTE)
    expect(roads.getState().roads).toEqual([])
  })

  it('um clique no mapa fora dos pins desmarca a origem', () => {
    const { ui, pins } = setup()
    act(() => ui.getState().setTool('route'))
    clickA()
    click(100, 900)
    expect(pins.getState().markedId).toBeNull()
    expect(hint()).toBe('Clique no pin de origem')
  })

  it('sem caminho por terra, ou com um pin excluído no meio do cálculo, nada é criado', async () => {
    const { ui, pins, roads, calls, onCreated, onNoPath } = setup()
    act(() => ui.getState().setTool('route'))
    clickA()
    clickB()
    await answer(calls[0], null)
    expect(roads.getState().roads).toEqual([])
    expect(hint()).toBe('Clique no pin de origem')
    // Sem caminho por terra: o toast Sem caminho recebe os dois pins (AC-F5-13).
    expect(onNoPath).toHaveBeenCalledExactlyOnceWith('a', 'b')
    clickA()
    clickB()
    act(() => {
      pins.getState().removePin('b')
    })
    await answer(calls[1], ROUTE)
    expect(roads.getState().roads).toEqual([])
    expect(onCreated).not.toHaveBeenCalled()
    expect(onNoPath).toHaveBeenCalledTimes(1)
  })

  it('com o worker em falha, nada é criado e a ferramenta volta ao primeiro passo', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { ui, roads, calls } = setup()
    act(() => ui.getState().setTool('route'))
    clickA()
    clickB()
    await act(async () => calls[0].reject(new Error('falhou')))
    expect(roads.getState().roads).toEqual([])
    expect(hint()).toBe('Clique no pin de origem')
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('Conectar cidades (AC-F5-14)', () => {
  const connectButton = () => screen.getByRole('button', { name: 'Conectar cidades' }) as HTMLButtonElement
  const NETWORK: ConnectResponse = {
    network: {
      links: [
        { from: 0, to: 2, points: [{ u: 0.25, v: 0.25 }, { u: 0.5, v: 0.75 }], cost: 5 },
        { from: 2, to: 1, points: [{ u: 0.5, v: 0.75 }, { u: 0.75, v: 0.5 }], cost: 6 },
      ],
      isolated: [],
    },
    workerMs: 1,
  }

  it('o botão fica na dica do primeiro passo e só habilita com 2 cidades ou mais', () => {
    const { ui, pins } = setup()
    act(() => ui.getState().setTool('route'))
    expect(connectButton().disabled).toBe(false)
    // Com a origem marcada, a dica é do destino, sem o botão.
    clickA()
    expect(screen.queryByRole('button', { name: 'Conectar cidades' })).toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    // Uma cidade só (os outros pins viram NPC e Local): desabilitado.
    act(() => {
      pins.getState().updatePin('b', { type: 'npc' })
      pins.getState().updatePin('c', { type: 'local' })
    })
    expect(connectButton().disabled).toBe(true)
    expect(connectButton().title).toBe('Precisa de 2 cidades ou mais')
  })

  it('pede a malha das cidades, diz "Conectando…" e cria as estradas num passo só do Desfazer', async () => {
    const npc: Pin = { ...pin('n', 'Ferreiro', 0.1, 0.9), type: 'npc' }
    const { ui, roads, history, connects, onConnected } = setup({ extraPins: [npc] })
    act(() => ui.getState().setTool('route'))
    fireEvent.click(connectButton())
    expect(connects).toHaveLength(1)
    // Só as cidades, cada uma no seu grupo (nenhuma estrada ainda).
    expect(connects[0].req).toEqual({
      cities: [
        { u: 0.25, v: 0.25 },
        { u: 0.75, v: 0.5 },
        { u: 0.5, v: 0.75 },
      ],
      groups: [0, 1, 2],
    })
    expect(hint()).toBe('Conectando…')
    expect(screen.queryByRole('button', { name: 'Conectar cidades' })).toBeNull()
    // Os cliques nos pins não fazem nada enquanto calcula.
    clickA()
    expect(screen.getByTestId('route-layer').dataset.from).toBeUndefined()
    const before = history.temporal.getState().pastStates.length
    await act(async () => connects[0].resolve(NETWORK))
    expect(roads.getState().roads.map((r) => [r.name, r.from, r.to, r.kind])).toEqual([
      ['Rota de Vila Alta a Forte', 'a', 'c', 'road'],
      ['Rota de Forte a Porto Sul', 'c', 'b', 'road'],
    ])
    expect(roads.getState().selectedId).toBeNull()
    expect(history.temporal.getState().pastStates.length).toBe(before + 1)
    expect(onConnected).toHaveBeenCalledWith(2, 0)
    expect(hint()).toBe('Clique no pin de origem')
    expect(ui.getState().tool).toBe('route')
    act(() => history.undo())
    expect(roads.getState().roads).toEqual([])
  })

  it('manda as cidades já ligadas por estrada no mesmo grupo', () => {
    const { ui, roads, connects } = setup()
    act(() => {
      roads.getState().addRoad({ points: [{ u: 0.25, v: 0.25 }, { u: 0.75, v: 0.5 }], from: 'a', to: 'b' }, { select: false })
    })
    act(() => ui.getState().setTool('route'))
    fireEvent.click(connectButton())
    expect(connects[0].req.groups).toEqual([0, 0, 1])
  })

  it('Esc e trocar de ferramenta cancelam, e o resultado é descartado', async () => {
    const { ui, roads, connects, onConnected } = setup()
    act(() => ui.getState().setTool('route'))
    fireEvent.click(connectButton())
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(connects[0].signal?.aborted).toBe(true)
    expect(hint()).toBe('Clique no pin de origem')
    expect(ui.getState().tool).toBe('route')
    fireEvent.click(connectButton())
    act(() => ui.getState().setTool('nav'))
    expect(connects[1].signal?.aborted).toBe(true)
    await act(async () => connects[1].resolve(NETWORK))
    expect(roads.getState().roads).toEqual([])
    expect(onConnected).not.toHaveBeenCalled()
  })

  it('uma cidade excluída no meio do cálculo tira as estradas dela; as de fora vão para o toast', async () => {
    const { ui, pins, roads, connects, onConnected } = setup()
    act(() => ui.getState().setTool('route'))
    fireEvent.click(connectButton())
    act(() => {
      pins.getState().removePin('b')
    })
    await act(async () => connects[0].resolve({ ...NETWORK, network: { ...NETWORK.network, isolated: [1] } }))
    expect(roads.getState().roads.map((r) => r.name)).toEqual(['Rota de Vila Alta a Forte'])
    expect(onConnected).toHaveBeenCalledWith(1, 1)
  })
})
