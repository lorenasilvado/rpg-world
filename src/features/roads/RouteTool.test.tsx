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
import type { RouteRequest, RouteResponse } from '../../workers/routerApi'
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

/** Um worker de rota de mentira: cada pedido espera até o teste responder (`answer`). */
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

/**
 * O editor de mentira, como no teste do Desenhar estrada: a câmera mostra o mundo com 1 px por
 * unidade. O pin "a" (Vila Alta) fica em 256,256, o "b" (Porto Sul) em 768,512 e o "c" em 512,768;
 * o clique no pin é um pouco acima da âncora (a base do desenho).
 */
function setup({ disabled = false } = {}) {
  const ui = createUiStore()
  const world = createWorldStore(idleGenerator, { params: DEFAULT_WORLD_PARAMS })
  const pins = createPinsStore([pin('a', 'Vila Alta', 0.25, 0.25), pin('b', 'Porto Sul', 0.75, 0.5), pin('c', 'Forte', 0.5, 0.75)])
  let n = 0
  const roads = createRoadsStore([], pins, { newId: () => `r${++n}` })
  const history = createWorldHistory({ world, pins, roads })
  const camera = createCameraStore()
  camera.getState().update({ zoom: 1, scale: 1, view: { x: 0, y: 0, width: 1024, height: 1024 }, origin: { x: 0, y: 0 } })
  const { router, calls } = fakeRouter()
  const onCreated = vi.fn()
  const onNoPath = vi.fn()
  render(
    <div>
      <main data-testid="map">
        <canvas data-testid="canvas" />
      </main>
      <input aria-label="Seed" />
      <MapToolbar ui={ui} />
      <MeasureTool ui={ui} world={world} camera={camera} disabled={disabled} />
      <PinTool ui={ui} pins={pins} camera={camera} roads={roads} disabled={disabled} />
      <RouteTool ui={ui} roads={roads} pins={pins} camera={camera} router={router} disabled={disabled} onCreated={onCreated} onNoPath={onNoPath} />
    </div>,
  )
  return { ui, pins, roads, history, calls, onCreated, onNoPath }
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
    expect(screen.getByRole('status').textContent).toBe('Clique no pin de origem')
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
