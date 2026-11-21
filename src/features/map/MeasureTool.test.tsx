import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_PARAMS } from '../../core'
import { createCameraStore } from '../../state/cameraStore'
import { createUiStore } from '../../state/uiStore'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import { MapToolbar } from './MapToolbar'
import { MeasureTool } from './MeasureTool'

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

afterEach(cleanup)

/**
 * O editor de mentira: a área do mapa (`data-testid="map"`, em 0,0 no jsdom) e a ferramenta. A câmera
 * mostra o mundo com 1 px por unidade, da origem 0,0: o px da tela é a unidade do mundo.
 */
function setup({ sizeKm = 800, disabled = false } = {}) {
  const ui = createUiStore()
  const world = createWorldStore(idleGenerator, { sizeKm })
  const camera = createCameraStore()
  camera.getState().update({ zoom: 1, scale: 1, view: { x: 0, y: 0, width: 1024, height: 1024 }, origin: { x: 0, y: 0 } })
  const utils = render(
    <div>
      <main data-testid="map">
        <canvas data-testid="canvas" />
      </main>
      <button type="button">fora do mapa</button>
      <input aria-label="Seed" />
      <MapToolbar ui={ui} />
      <MeasureTool ui={ui} world={world} camera={camera} disabled={disabled} />
    </div>,
  )
  return { ui, camera, world, ...utils }
}

const canvas = () => screen.getByTestId('canvas')

function click(x: number, y: number, { moveTo, target = canvas() }: { moveTo?: [number, number]; target?: Element } = {}) {
  fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: x, clientY: y, pointerType: 'mouse' })
  const [ux, uy] = moveTo ?? [x, y]
  fireEvent.pointerUp(target, { pointerId: 1, button: 0, clientX: ux, clientY: uy, pointerType: 'mouse' })
}

const distance = () => screen.queryByTestId('measure-distance')?.textContent ?? null

describe('Medir distância (AC-F2-13)', () => {
  it('a tecla M liga a ferramenta e mostra a dica', () => {
    const { ui } = setup()
    expect(screen.queryByTestId('measure-hint')).toBeNull()
    fireEvent.keyDown(document.body, { key: 'm' })
    expect(ui.getState().tool).toBe('measure')
    expect(screen.getByRole('status').textContent).toBe('Clique em dois pontos para medir')
  })

  it('a tecla M não vale com Ctrl, com o foco num campo nem com um painel sobreposto aberto', () => {
    const { ui } = setup()
    fireEvent.keyDown(document.body, { key: 'm', ctrlKey: true })
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    seed.focus()
    fireEvent.keyDown(seed, { key: 'm' })
    expect(ui.getState().tool).toBe('nav')
    cleanup()
    const closed = setup({ disabled: true })
    fireEvent.keyDown(document.body, { key: 'M' })
    expect(closed.ui.getState().tool).toBe('nav')
  })

  it('dois cliques no mapa mostram a distância em km (com o sizeKm), e o terceiro recomeça', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    click(100, 100)
    expect(screen.getByRole('status').textContent).toBe('Clique no ponto final')
    // Sem o segundo ponto, a linha segue o mouse.
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 356, clientY: 100, pointerType: 'mouse' })
    expect(distance()).toBe('200 km')
    expect(screen.getByTestId('measure-distance').dataset.final).toBe('false')
    // 512 unidades de 1024 num mundo de 800 km: 400 km.
    click(612, 100)
    expect(distance()).toBe('400 km')
    expect(screen.getByTestId('measure-distance').dataset.final).toBe('true')
    // O mouse não mexe mais na medida.
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 900, clientY: 900, pointerType: 'mouse' })
    expect(distance()).toBe('400 km')
    click(10, 10)
    expect(screen.getByTestId('measure-layer').dataset.points).toBe('1')
  })

  it('outro tamanho de mundo muda a distância', () => {
    const { ui } = setup({ sizeKm: 2000 })
    act(() => ui.getState().setTool('measure'))
    click(0, 0)
    click(512, 0)
    expect(distance()).toBe('1000 km')
  })

  it('acompanha a câmera: com zoom, a mesma distância na tela vale menos km', () => {
    const { ui, camera } = setup()
    act(() => ui.getState().setTool('measure'))
    act(() => camera.getState().update({ zoom: 4, scale: 4, view: { x: 0, y: 0, width: 256, height: 256 }, origin: { x: 0, y: 0 } }))
    click(0, 0)
    click(512, 0)
    expect(distance()).toBe('100 km')
  })

  it('arrastar faz pan, não marca ponto; clique fora do mapa não marca', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    click(100, 100, { moveTo: [160, 100] })
    expect(screen.getByTestId('measure-layer').dataset.points).toBe('0')
    click(100, 100, { target: screen.getByRole('button', { name: 'fora do mapa' }) })
    expect(screen.getByTestId('measure-layer').dataset.points).toBe('0')
  })

  it('a pinça (segundo dedo) não marca ponto', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    fireEvent.pointerDown(canvas(), { pointerId: 1, button: 0, clientX: 100, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerDown(canvas(), { pointerId: 2, button: 0, clientX: 200, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerUp(canvas(), { pointerId: 2, button: 0, clientX: 200, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerUp(canvas(), { pointerId: 1, button: 0, clientX: 100, clientY: 100, pointerType: 'touch' })
    expect(screen.getByTestId('measure-layer').dataset.points).toBe('0')
  })

  it('Esc apaga os pontos e, sem pontos, volta para Navegar', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    click(0, 0)
    click(512, 0)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(ui.getState().tool).toBe('measure')
    expect(distance()).toBeNull()
    expect(screen.getByTestId('measure-layer').dataset.points).toBe('0')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(ui.getState().tool).toBe('nav')
    expect(screen.queryByTestId('measure-layer')).toBeNull()
  })

  it('voltar para Navegar e medir de novo começa sem pontos', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    click(0, 0)
    act(() => ui.getState().setTool('nav'))
    act(() => ui.getState().setTool('measure'))
    expect(screen.getByTestId('measure-layer').dataset.points).toBe('0')
  })

  it('Esc com o foco num campo é do campo: não apaga a medida nem volta para Navegar', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    click(0, 0)
    click(512, 0)
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    seed.focus()
    fireEvent.keyDown(seed, { key: 'Escape' })
    expect(distance()).toBe('400 km')
    expect(ui.getState().tool).toBe('measure')
    // Sem medida, o Esc no campo também não volta para Navegar.
    seed.blur()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(distance()).toBeNull()
    seed.focus()
    fireEvent.keyDown(seed, { key: 'Escape' })
    expect(ui.getState().tool).toBe('measure')
  })

  it('com o mouse sobre um controle, a linha fica no último ponto do mapa', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    click(0, 0)
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 256, clientY: 0, pointerType: 'mouse' })
    expect(distance()).toBe('200 km')
    fireEvent.pointerMove(screen.getByRole('button', { name: 'fora do mapa' }), { pointerId: 1, clientX: 900, clientY: 900, pointerType: 'mouse' })
    expect(distance()).toBe('200 km')
    fireEvent.pointerMove(screen.getByRole('button', { name: 'Camadas' }), { pointerId: 1, clientX: 900, clientY: 900, pointerType: 'mouse' })
    expect(distance()).toBe('200 km')
  })

  it('com o popover de Camadas aberto, Esc fecha só o popover e a medida fica', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    click(0, 0)
    click(512, 0)
    fireEvent.click(screen.getByRole('button', { name: 'Camadas' }))
    const decor = screen.getByRole('switch', { name: 'Decoração' })
    decor.focus()
    fireEvent.keyDown(decor, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Camadas' })).toBeNull()
    expect(distance()).toBe('400 km')
    expect(ui.getState().tool).toBe('measure')
    // O Esc seguinte já é da ferramenta.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(distance()).toBeNull()
  })

  it('um mapa novo mantém a medida; um mundo de outro tamanho muda os km', () => {
    const { ui, world } = setup()
    act(() => ui.getState().setTool('measure'))
    click(0, 0)
    click(512, 0)
    act(() => world.getState().setSeed('outra-seed'))
    expect(distance()).toBe('400 km')
    act(() => world.getState().createWorld({ name: 'Maior', sizeKm: 1600, seed: 'maior', params: DEFAULT_WORLD_PARAMS }))
    expect(distance()).toBe('800 km')
    expect(screen.getByTestId('measure-layer').dataset.points).toBe('2')
  })

  it('um toque esquece onde o mouse estava: a linha não vai até lá', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 900, clientY: 900, pointerType: 'mouse' })
    fireEvent.pointerDown(canvas(), { pointerId: 2, button: 0, clientX: 100, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerUp(canvas(), { pointerId: 2, button: 0, clientX: 100, clientY: 100, pointerType: 'touch' })
    expect(screen.getByTestId('measure-layer').dataset.points).toBe('1')
    expect(distance()).toBeNull()
  })

  it('a tecla V volta para Navegar, com as mesmas exceções da tecla M', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    seed.focus()
    fireEvent.keyDown(seed, { key: 'v' })
    fireEvent.keyDown(document.body, { key: 'v', ctrlKey: true })
    expect(ui.getState().tool).toBe('measure')
    fireEvent.keyDown(document.body, { key: 'V' })
    expect(ui.getState().tool).toBe('nav')
    expect(screen.queryByTestId('measure-layer')).toBeNull()
  })

  it('com as duas pontas, a região de status anuncia a distância ao leitor de tela', () => {
    const { ui } = setup()
    act(() => ui.getState().setTool('measure'))
    click(0, 0)
    expect(screen.getByRole('status').textContent).toBe('Clique no ponto final')
    click(512, 0)
    expect(screen.getByRole('status').textContent).toBe('Clique em dois pontos para medir. Distância: 400 km')
    // A dica visível continua a mesma.
    expect(screen.getByTestId('measure-hint').textContent).toBe('Clique em dois pontos para medir')
  })
})
