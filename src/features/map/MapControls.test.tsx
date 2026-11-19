import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCameraStore, type CameraStore } from '../../state/cameraStore'
import { createUiStore } from '../../state/uiStore'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import { Minimap } from './Minimap'
import { ZoomControls } from './ZoomControls'

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

function cameraWith(areaWidth: number, view = { x: 256, y: 256, width: 512, height: 512 }) {
  const camera = createCameraStore()
  const controls = { zoomIn: vi.fn(), zoomOut: vi.fn(), center: vi.fn(), centerOn: vi.fn() }
  camera.getState().setControls(controls)
  camera.getState().update({ zoom: 2, scale: 1, view, areaWidth })
  return { camera, controls }
}

const setView = (camera: CameraStore, view: { x: number; y: number; width: number; height: number }) =>
  act(() => camera.getState().update({ ...camera.getState(), view }))

afterEach(cleanup)

describe('Controle de zoom (AC-F2-09)', () => {
  it('mostra a escala em km, a porcentagem, −, + e centralizar, e os botões comandam a câmera', () => {
    const { camera, controls } = cameraWith(992)
    render(<ZoomControls world={createWorldStore(idleGenerator)} camera={camera} />)
    expect(screen.getByTestId('map-scale').textContent).toBe('25 km')
    expect(screen.getByTestId('zoom-percent').textContent).toBe('200%')
    fireEvent.click(screen.getByRole('button', { name: 'Aproximar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Afastar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Centralizar' }))
    expect(controls.zoomIn).toHaveBeenCalledTimes(1)
    expect(controls.zoomOut).toHaveBeenCalledTimes(1)
    expect(controls.center).toHaveBeenCalledTimes(1)
  })

  it('com menos de 860 px de área livre, esconde a escala e a porcentagem', () => {
    const { camera } = cameraWith(720)
    render(<ZoomControls world={createWorldStore(idleGenerator)} camera={camera} />)
    expect(screen.queryByTestId('map-scale')).toBeNull()
    expect(screen.queryByTestId('zoom-percent')).toBeNull()
    expect(screen.getByRole('button', { name: 'Aproximar' })).toBeTruthy()
    act(() => camera.getState().update({ ...camera.getState(), areaWidth: 900 }))
    expect(screen.getByTestId('zoom-percent').textContent).toBe('200%')
  })

  it('antes de a câmera estar pronta, fica compacto (data-compact)', () => {
    const camera = createCameraStore()
    camera.getState().update({ zoom: 1, scale: 1, view: { x: 0, y: 0, width: 1024, height: 1024 }, areaWidth: 992 })
    camera.getState().setControls(null)
    render(<ZoomControls world={createWorldStore(idleGenerator)} camera={camera} />)
    expect(screen.getByTestId('zoom-controls').dataset.compact).toBe('true')
    expect(screen.queryByTestId('zoom-percent')).toBeNull()
  })

  it('a escala usa o sizeKm do mundo', () => {
    const { camera } = cameraWith(992)
    render(<ZoomControls world={createWorldStore(idleGenerator, { sizeKm: 1600 })} camera={camera} />)
    expect(screen.getByTestId('map-scale').textContent).toBe('50 km')
  })

  it('a porcentagem tem o rótulo "Zoom atual" como texto para leitores de tela', () => {
    const { camera } = cameraWith(992)
    render(<ZoomControls world={createWorldStore(idleGenerator)} camera={camera} />)
    const percent = screen.getByTestId('zoom-percent')
    expect(percent.textContent).toBe('200%')
    expect(percent.parentElement?.textContent).toBe('Zoom atual: 200%')
    expect(percent.parentElement?.hasAttribute('aria-label')).toBe(false)
  })

  it('a porcentagem acompanha o zoom', () => {
    const { camera } = cameraWith(992)
    render(<ZoomControls world={createWorldStore(idleGenerator)} camera={camera} />)
    act(() => camera.getState().update({ ...camera.getState(), zoom: 0.92 }))
    expect(screen.getByTestId('zoom-percent').textContent).toBe('92%')
  })
})

describe('Minimapa (AC-F2-08)', () => {
  it('o retângulo acompanha a área visível', () => {
    const { camera } = cameraWith(720)
    render(<Minimap world={createWorldStore(idleGenerator)} ui={createUiStore()} camera={camera} />)
    const rect = screen.getByTestId('minimap-view')
    expect(rect.hidden).toBe(false)
    expect(rect.style.left).toBe('55px')
    expect(rect.style.width).toBe('50px')
    setView(camera, { x: 0, y: 0, width: 1024, height: 1024 })
    expect(rect.style.left).toBe('30px')
    expect(rect.style.width).toBe('100px')
  })

  it('arrastar o retângulo move a área visível, mantendo o ponto pego', () => {
    const { camera, controls } = cameraWith(720)
    render(<Minimap world={createWorldStore(idleGenerator)} ui={createUiStore()} camera={camera} />)
    const surface = screen.getByTestId('minimap-surface')
    // O centro da vista está em (80, 50) no minimapa; pega 10 px à direita dele e arrasta 20 px.
    fireEvent.pointerDown(surface, { button: 0, clientX: 90, clientY: 50, pointerId: 1 })
    expect(controls.centerOn).toHaveBeenLastCalledWith(512, 512)
    fireEvent.pointerMove(surface, { clientX: 110, clientY: 50, pointerId: 1 })
    expect(controls.centerOn).toHaveBeenLastCalledWith(512 + 20 * 10.24, 512)
    fireEvent.pointerUp(surface, { pointerId: 1 })
    fireEvent.pointerMove(surface, { clientX: 130, clientY: 50, pointerId: 1 })
    expect(controls.centerOn).toHaveBeenCalledTimes(2)
  })

  it('tocar fora do retângulo centra a câmera ali', () => {
    const { camera, controls } = cameraWith(720)
    render(<Minimap world={createWorldStore(idleGenerator)} ui={createUiStore()} camera={camera} />)
    fireEvent.pointerDown(screen.getByTestId('minimap-surface'), { button: 0, clientX: 35, clientY: 10, pointerId: 1 })
    expect(controls.centerOn).toHaveBeenLastCalledWith(5 * 10.24, 10 * 10.24)
  })

  it('com o foco nele, as setas movem a área visível 1/10 do mapa, e o atalho da câmera não soma outro passo', () => {
    const { camera, controls } = cameraWith(720)
    render(<Minimap world={createWorldStore(idleGenerator)} ui={createUiStore()} camera={camera} />)
    const surface = screen.getByTestId('minimap-surface')
    expect(surface.tabIndex).toBe(0)
    // Centro da vista em (512, 512).
    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    surface.dispatchEvent(right)
    expect(controls.centerOn).toHaveBeenLastCalledWith(512 + 102.4, 512)
    expect(right.defaultPrevented).toBe(true)
    fireEvent.keyDown(surface, { key: 'ArrowUp' })
    expect(controls.centerOn).toHaveBeenLastCalledWith(512, 512 - 102.4)
    // Com Ctrl, Alt ou Meta, e outras teclas, nada.
    fireEvent.keyDown(surface, { key: 'ArrowLeft', ctrlKey: true })
    fireEvent.keyDown(surface, { key: 'a' })
    expect(controls.centerOn).toHaveBeenCalledTimes(2)
  })

  it('recolhe e abre pelo cabeçalho', () => {
    const ui = createUiStore()
    const { camera } = cameraWith(720)
    render(<Minimap world={createWorldStore(idleGenerator)} ui={ui} camera={camera} />)
    const toggle = screen.getByRole('button', { name: 'Minimapa' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(ui.getState().minimapOpen).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // O corpo fica no DOM, escondido: ao abrir de novo, o terreno não precisa ser redesenhado.
    const body = screen.getByTestId('minimap-surface').parentElement as HTMLElement
    expect(body.hidden).toBe(true)
    fireEvent.click(toggle)
    expect(body.hidden).toBe(false)
  })
})
