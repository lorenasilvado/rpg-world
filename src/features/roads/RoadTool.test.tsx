import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_PARAMS } from '../../core'
import type { Pin } from '../../persistence/types'
import { createCameraStore } from '../../state/cameraStore'
import { createWorldHistory } from '../../state/history'
import { createPinsStore } from '../../state/pinsStore'
import { createRoadsStore } from '../../state/roadsStore'
import { createUiStore } from '../../state/uiStore'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import { MapToolbar } from '../map/MapToolbar'
import { MeasureTool } from '../map/MeasureTool'
import { PinTool } from '../pins/PinTool'
import { RoadTool } from './RoadTool'

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

afterEach(cleanup)

const pin = (id: string, u: number, v: number): Pin => ({
  id,
  type: 'cidade',
  name: id,
  pos: { u, v },
  icon: { kind: 'builtin', key: 'cidade' },
  description: '',
  tags: [],
  fields: {},
})

/**
 * O editor de mentira: a área do mapa (`data-testid="map"`, em 0,0 no jsdom), as ferramentas e os
 * stores. A câmera mostra o mundo com 1 px por unidade, da origem 0,0: o px da tela é a unidade do
 * mundo. O pin "a" fica em 256,256 e o "b" em 768,512 (a âncora é a base do desenho).
 */
function setup({ disabled = false } = {}) {
  const ui = createUiStore()
  const world = createWorldStore(idleGenerator, { params: DEFAULT_WORLD_PARAMS })
  const pins = createPinsStore([pin('a', 0.25, 0.25), pin('b', 0.75, 0.5)])
  let n = 0
  const roads = createRoadsStore([], pins, { newId: () => `r${++n}` })
  const history = createWorldHistory({ world, pins, roads })
  const camera = createCameraStore()
  camera.getState().update({ zoom: 1, scale: 1, view: { x: 0, y: 0, width: 1024, height: 1024 }, origin: { x: 0, y: 0 } })
  render(
    <div>
      <main data-testid="map">
        <canvas data-testid="canvas" />
      </main>
      <input aria-label="Seed" />
      <MapToolbar ui={ui} />
      <MeasureTool ui={ui} world={world} camera={camera} disabled={disabled} />
      <PinTool ui={ui} pins={pins} camera={camera} disabled={disabled} />
      <RoadTool ui={ui} roads={roads} pins={pins} camera={camera} disabled={disabled} />
    </div>,
  )
  return { ui, pins, roads, history }
}

const canvas = () => screen.getByTestId('canvas')
let clock = 0

/** Um clique (ou toque) no mapa; `gap`: ms desde o clique anterior (o duplo clique é rápido). */
function click(x: number, y: number, { gap = 1000, touch = false }: { gap?: number; touch?: boolean } = {}) {
  clock += gap
  const pointerType = touch ? 'touch' : 'mouse'
  fireEvent.pointerDown(canvas(), { pointerId: 1, button: 0, clientX: x, clientY: y, pointerType, timeStamp: clock })
  // O jsdom não leva o timeStamp do init: o evento é criado à mão.
  const up = new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y, pointerType })
  Object.defineProperty(up, 'timeStamp', { value: clock })
  fireEvent(canvas(), up)
}

const hint = () => screen.getByTestId('road-draw-hint').textContent
const points = () => Number(screen.getByTestId('road-draw-layer').dataset.points)

describe('Desenhar estrada (AC-F5-04, AC-F5-05)', () => {
  it('a tecla R e a ferramenta da toolbar ligam a ferramenta, com a dica', () => {
    const { ui } = setup()
    expect(screen.queryByTestId('road-draw-layer')).toBeNull()
    fireEvent.keyDown(document.body, { key: 'r' })
    expect(ui.getState().tool).toBe('road')
    expect(screen.getByRole('status').textContent).toBe('Clique no mapa ou num pin para começar a estrada')
    act(() => ui.getState().setTool('nav'))
    const button = screen.getByRole('button', { name: 'Desenhar estrada' })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    expect(ui.getState().tool).toBe('road')
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('a tecla R não vale com o foco num campo nem com um painel sobreposto aberto', () => {
    const { ui } = setup()
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    seed.focus()
    fireEvent.keyDown(seed, { key: 'r' })
    expect(ui.getState().tool).toBe('nav')
    cleanup()
    const closed = setup({ disabled: true })
    fireEvent.keyDown(document.body, { key: 'R' })
    expect(closed.ui.getState().tool).toBe('nav')
  })

  it('cliques adicionam pontos, com a prévia até o cursor; Enter termina, e a estrada fica selecionada e é um passo no Desfazer', () => {
    const { ui, roads, history } = setup()
    act(() => ui.getState().setTool('road'))
    click(100, 100)
    expect(points()).toBe(1)
    expect(hint()).toBe('Clique para adicionar pontos · Enter ou duplo clique termina · Esc cancela')
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 300, clientY: 140, pointerType: 'mouse' })
    const preview = screen.getByTestId('road-draw-preview')
    expect([preview.getAttribute('x1'), preview.getAttribute('y1'), preview.getAttribute('x2'), preview.getAttribute('y2')]).toEqual(['100', '100', '300', '140'])
    // Com 1 ponto, Enter não termina.
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(roads.getState().roads).toEqual([])
    // Arrastar é pan: não adiciona ponto.
    fireEvent.pointerDown(canvas(), { pointerId: 1, button: 0, clientX: 400, clientY: 400, pointerType: 'mouse' })
    fireEvent.pointerUp(canvas(), { pointerId: 1, button: 0, clientX: 460, clientY: 400, pointerType: 'mouse' })
    expect(points()).toBe(1)
    click(512, 256)
    click(512, 768)
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(roads.getState().roads).toEqual([
      {
        id: 'r1',
        name: 'Nova estrada',
        kind: 'road',
        points: [
          { u: 100 / 1024, v: 100 / 1024 },
          { u: 0.5, v: 0.25 },
          { u: 0.5, v: 0.75 },
        ],
      },
    ])
    expect(roads.getState().selectedId).toBe('r1')
    expect(ui.getState().tool).toBe('nav')
    expect(screen.queryByTestId('road-draw-layer')).toBeNull()
    expect(history.temporal.getState().pastStates).toHaveLength(1)
    act(() => history.undo())
    expect(roads.getState().roads).toEqual([])
  })

  it('o duplo clique termina, com o ponto do primeiro clique', () => {
    const { ui, roads } = setup()
    act(() => ui.getState().setTool('road'))
    click(100, 100)
    click(200, 100)
    click(202, 101, { gap: 150 })
    expect(roads.getState().roads).toHaveLength(1)
    expect(roads.getState().roads[0].points).toEqual([
      { u: 100 / 1024, v: 100 / 1024 },
      { u: 200 / 1024, v: 100 / 1024 },
    ])
  })

  it('com o toque, cada toque adiciona um ponto, e o duplo toque termina', () => {
    const { ui, roads } = setup()
    act(() => ui.getState().setTool('road'))
    click(100, 100, { touch: true })
    click(300, 300, { touch: true })
    expect(points()).toBe(2)
    expect(screen.queryByTestId('road-draw-preview')).toBeNull()
    click(310, 290, { touch: true, gap: 200 })
    expect(roads.getState().roads).toHaveLength(1)
  })

  it('começar e terminar num pin liga as pontas a ele, na posição do pin, sem selecioná-lo', () => {
    const { ui, pins, roads } = setup()
    act(() => ui.getState().setTool('road'))
    click(256, 245)
    expect(pins.getState().selectedId).toBeNull()
    click(512, 400)
    click(768, 500)
    click(768, 500, { gap: 100 })
    expect(roads.getState().roads[0]).toMatchObject({
      from: 'a',
      to: 'b',
      points: [
        { u: 0.25, v: 0.25 },
        { u: 0.5, v: 400 / 1024 },
        { u: 0.75, v: 0.5 },
      ],
    })
    expect(pins.getState().pins.map((p) => p.pos)).toEqual([
      { u: 0.25, v: 0.25 },
      { u: 0.75, v: 0.5 },
    ])
  })

  it('a estrada criada tira a seleção do pin', () => {
    const { ui, pins, roads } = setup()
    act(() => pins.getState().select('a'))
    act(() => ui.getState().setTool('road'))
    click(100, 100)
    click(200, 200)
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(roads.getState().selectedId).toBe('r1')
    expect(pins.getState().selectedId).toBeNull()
  })

  it('Esc apaga o desenho; sem desenho, volta para Navegar', () => {
    const { ui, pins, roads } = setup()
    act(() => pins.getState().select('a'))
    act(() => ui.getState().setTool('road'))
    click(100, 100)
    click(200, 200)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(points()).toBe(0)
    expect(hint()).toBe('Clique no mapa ou num pin para começar a estrada')
    // O pin continua selecionado: o Esc foi do desenho.
    expect(pins.getState().selectedId).toBe('a')
    expect(ui.getState().tool).toBe('road')
    // Com um pin selecionado, o Esc tira a seleção antes; depois, volta para Navegar.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(pins.getState().selectedId).toBeNull()
    expect(ui.getState().tool).toBe('road')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(ui.getState().tool).toBe('nav')
    expect(roads.getState().roads).toEqual([])
  })

  it('trocar de ferramenta no meio descarta o desenho', () => {
    const { ui, roads } = setup()
    act(() => ui.getState().setTool('road'))
    click(100, 100)
    click(200, 200)
    fireEvent.keyDown(document.body, { key: 'm' })
    expect(ui.getState().tool).toBe('measure')
    fireEvent.keyDown(document.body, { key: 'r' })
    expect(points()).toBe(0)
    expect(roads.getState().roads).toEqual([])
  })

  it('com o popover de Camadas aberto, o Esc fecha só o popover; o desenho continua', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('road'))
    click(100, 100)
    click(200, 200)
    fireEvent.click(screen.getByRole('button', { name: 'Camadas' }))
    expect(screen.getByRole('button', { name: 'Camadas' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Camadas' }).getAttribute('aria-expanded')).toBe('false')
    expect(points()).toBe(2)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(points()).toBe(0)
  })

  it('o Enter num botão focado é do botão: não termina a estrada', () => {
    const { ui, roads } = setup()
    act(() => ui.getState().setTool('road'))
    click(100, 100)
    click(200, 200)
    const camadas = screen.getByRole('button', { name: 'Camadas' })
    camadas.focus()
    fireEvent.keyDown(camadas, { key: 'Enter' })
    expect(roads.getState().roads).toEqual([])
    expect(points()).toBe(2)
    // Com o foco no mapa (ou em lugar nenhum), o Enter termina.
    camadas.blur()
    fireEvent.keyDown(canvas(), { key: 'Enter' })
    expect(roads.getState().roads).toHaveLength(1)
  })
})
