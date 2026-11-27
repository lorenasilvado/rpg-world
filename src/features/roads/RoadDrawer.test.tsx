import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pin, Road } from '../../persistence/types'
import { createCameraStore } from '../../state/cameraStore'
import { createWorldHistory } from '../../state/history'
import { createPinImages } from '../../state/pinImages'
import { createPinsStore } from '../../state/pinsStore'
import { createRoadsStore } from '../../state/roadsStore'
import { createUiStore } from '../../state/uiStore'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import { PinTool } from '../pins/PinTool'
import { RoadDrawer } from './RoadDrawer'

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

/** A Estrada Real, de Alda (0,25; 0,5) a Brena (0,5; 0,5): 0,25 do mapa, 200 km num mundo de 800 km. */
const ROAD: Road = { id: 'r1', name: 'Estrada Real', kind: 'road', points: [{ u: 0.25, v: 0.5 }, { u: 0.5, v: 0.5 }], from: 'Alda', to: 'Brena' }

/**
 * O editor de mentira: a área do mapa (em 0,0 no jsdom), o drawer da estrada e o `PinTool`. A câmera
 * mostra o mundo com 1 px por unidade, da origem: o px da tela é a unidade do mundo.
 */
function setup({ onDelete }: { onDelete?: (id: string) => void } = {}) {
  const ui = createUiStore()
  const camera = createCameraStore()
  camera.getState().update({ zoom: 1, scale: 1, view: { x: 0, y: 0, width: 1024, height: 1024 }, origin: { x: 0, y: 0 } })
  const pins = createPinsStore([pin('Alda', 0.25, 0.5), pin('Brena', 0.5, 0.5)])
  const roads = createRoadsStore([ROAD, { id: 'r2', name: 'Solta', kind: 'trail', points: [{ u: 0.1, v: 0.9 }, { u: 0.3, v: 0.9 }] }], pins)
  const world = createWorldStore(idleGenerator)
  world.setState({ sizeKm: 800 })
  const history = createWorldHistory({ world, pins, roads })
  const remove = onDelete ?? ((id: string) => roads.getState().removeRoad(id))
  render(
    <div>
      <main data-testid="map">
        <canvas data-testid="canvas" />
      </main>
      <aside>
        <RoadDrawer roads={roads} pins={pins} images={createPinImages({ worldId: 'local' })} world={world} onDelete={remove} />
      </aside>
      <PinTool ui={ui} pins={pins} camera={camera} roads={roads} disabled={false} onDeleteRoad={remove} />
    </div>,
  )
  return { ui, pins, roads, history }
}

function click(x: number, y: number) {
  const canvas = screen.getByTestId('canvas')
  fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: x, clientY: y, pointerType: 'mouse' })
  fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: x, clientY: y, pointerType: 'mouse' })
}

const nameField = () => screen.getByRole('textbox', { name: 'Nome da estrada' }) as HTMLInputElement

describe('Selecionar estrada (AC-F5-06)', () => {
  it('clicar perto da estrada a seleciona e abre o drawer: nome, tipo, km e os pins ligados', () => {
    const { roads } = setup()
    expect(screen.queryByTestId('road-drawer')).toBeNull()
    // No meio da Estrada Real (x 384), 6 px abaixo da linha: dentro da área de clique.
    act(() => click(384, 512 + 6))
    expect(roads.getState().selectedId).toBe('r1')
    const drawer = screen.getByTestId('road-drawer')
    expect(nameField().value).toBe('Estrada Real')
    expect(within(drawer).getByRole('button', { name: 'Estrada' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(drawer).getByRole('button', { name: 'Trilha' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('road-length').textContent).toBe('Extensão aproximada: 200 km')
    expect(within(screen.getByTestId('road-ends')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Alda', 'Brena'])
    expect(within(drawer).getByRole('button', { name: 'Excluir estrada' })).toBeTruthy()
  })

  it('o pin tem prioridade sobre a estrada; longe dela, o clique não seleciona', () => {
    const { pins, roads } = setup()
    // A âncora do pin é a base: o desenho fica acima dela.
    act(() => click(256, 512 - 12))
    expect(pins.getState().selectedId).toBe('Alda')
    expect(roads.getState().selectedId).toBeNull()
    act(() => click(384, 512 + 40))
    expect(roads.getState().selectedId).toBeNull()
  })

  it('com "Estradas" desligada em Camadas, ou com Adicionar pin, o clique não seleciona a estrada', () => {
    const { ui, roads } = setup()
    act(() => ui.getState().setLayer('roads', false))
    act(() => click(384, 512))
    expect(roads.getState().selectedId).toBeNull()
    act(() => ui.getState().setLayer('roads', true))
    act(() => ui.getState().setTool('pin'))
    act(() => click(384, 512))
    expect(roads.getState().selectedId).toBeNull()
  })

  it('Esc e o botão Fechar tiram a seleção; sem pontas ligadas, o aviso', () => {
    const { roads } = setup()
    act(() => roads.getState().select('r2'))
    expect(screen.getByText('Nenhum pin: as pontas ficam soltas no mapa.')).toBeTruthy()
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' })
    })
    expect(roads.getState().selectedId).toBeNull()
    act(() => roads.getState().select('r2'))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(roads.getState().selectedId).toBeNull()
  })
})

describe('Editar estrada (AC-F5-07)', () => {
  it('o nome muda a cada tecla, num passo só do Desfazer; vazio, volta o último nome ao sair', () => {
    const { roads, history } = setup()
    act(() => roads.getState().select('r1'))
    const input = nameField()
    input.focus()
    fireEvent.change(input, { target: { value: 'Estrada' } })
    fireEvent.change(input, { target: { value: 'Estrada Nova' } })
    expect(roads.getState().roads[0].name).toBe('Estrada Nova')
    fireEvent.change(input, { target: { value: '' } })
    expect(roads.getState().roads[0].name).toBe('Estrada Nova')
    act(() => input.blur())
    expect(input.value).toBe('Estrada Nova')
    expect(history.temporal.getState().pastStates).toHaveLength(1)
    act(() => history.undo())
    expect(nameField().value).toBe('Estrada Real')
  })

  it('o tipo de via muda a estrada, e cada troca é um passo', () => {
    const { roads, history } = setup()
    act(() => roads.getState().select('r1'))
    fireEvent.click(screen.getByRole('button', { name: 'Trilha' }))
    expect(roads.getState().roads[0].kind).toBe('trail')
    expect(screen.getByRole('button', { name: 'Trilha' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Rota marítima' }))
    expect(roads.getState().roads[0].kind).toBe('sea')
    expect(history.temporal.getState().pastStates).toHaveLength(2)
    act(() => history.undo())
    expect(roads.getState().roads[0].kind).toBe('trail')
  })

  it('clicar num pin em "Liga" o seleciona (e o drawer da estrada fecha)', () => {
    const { pins, roads } = setup()
    act(() => roads.getState().select('r1'))
    fireEvent.click(within(screen.getByTestId('road-ends')).getByRole('button', { name: 'Brena' }))
    expect(pins.getState().selectedId).toBe('Brena')
    expect(roads.getState().selectedId).toBeNull()
    expect(screen.queryByTestId('road-drawer')).toBeNull()
  })
})

describe('Pins do meio em "Liga" (AC-F5-17)', () => {
  it('lista os pins ligados na ordem da estrada: o do meio e depois a ponta', () => {
    const { roads } = setup()
    const road: Road = { id: 'r3', name: 'Volta', kind: 'road', points: [{ u: 0.1, v: 0.1 }, { u: 0.5, v: 0.5, pin: 'Brena' }, { u: 0.25, v: 0.5 }], to: 'Alda' }
    act(() => {
      roads.getState().replaceRoads([...roads.getState().roads, road])
      roads.getState().select('r3')
    })
    expect(within(screen.getByTestId('road-ends')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Brena', 'Alda'])
  })
})

describe('Excluir estrada (AC-F5-08)', () => {
  it('o botão do drawer e Delete pedem a exclusão da estrada selecionada', () => {
    const onDelete = vi.fn()
    const { roads } = setup({ onDelete })
    act(() => roads.getState().select('r1'))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir estrada' }))
    expect(onDelete).toHaveBeenLastCalledWith('r1')
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(onDelete).toHaveBeenCalledTimes(2)
    // Com o foco no drawer (um botão do tipo), a tecla não exclui; com Ctrl, também não.
    screen.getByRole('button', { name: 'Trilha' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Backspace' })
    fireEvent.keyDown(document.body, { key: 'Delete', ctrlKey: true })
    expect(onDelete).toHaveBeenCalledTimes(2)
  })

  it('Backspace exclui; Desfazer devolve a estrada', () => {
    const { roads, history } = setup()
    act(() => roads.getState().select('r1'))
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Backspace' })
    })
    expect(roads.getState().roads.map((r) => r.id)).toEqual(['r2'])
    expect(screen.queryByTestId('road-drawer')).toBeNull()
    act(() => history.undo())
    expect(roads.getState().roads.map((r) => r.id)).toEqual(['r1', 'r2'])
  })
})
