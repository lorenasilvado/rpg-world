import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCameraStore } from '../../state/cameraStore'
import { createPinsStore } from '../../state/pinsStore'
import { createUiStore } from '../../state/uiStore'
import { MeasureTool } from '../map/MeasureTool'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import { PinDrawer } from './PinDrawer'
import { PinTool } from './PinTool'

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

afterEach(cleanup)

/**
 * O editor de mentira: a área do mapa (`data-testid="map"`, em 0,0 no jsdom), o drawer e as
 * ferramentas. A câmera mostra o mundo com 1 px por unidade, da origem 0,0: o px da tela é a unidade
 * do mundo, e (u, v) = px / 1024.
 */
function setup({ onDelete }: { onDelete?: (id: string) => void } = {}) {
  const ui = createUiStore()
  const camera = createCameraStore()
  camera.getState().update({ zoom: 1, scale: 1, view: { x: 0, y: 0, width: 1024, height: 1024 }, origin: { x: 0, y: 0 } })
  let n = 0
  const pins = createPinsStore([], { newId: () => `p${++n}` })
  const world = createWorldStore(idleGenerator)
  render(
    <div>
      <main data-testid="map">
        <canvas data-testid="canvas" />
      </main>
      <aside>
        <PinDrawer pins={pins} world={world} camera={camera} onDelete={onDelete ?? (() => {})} />
      </aside>
      <MeasureTool ui={ui} world={world} camera={camera} disabled={false} />
      <PinTool ui={ui} pins={pins} camera={camera} disabled={false} onDelete={onDelete} />
    </div>,
  )
  return { ui, pins, camera }
}

function click(x: number, y: number, moveTo: [number, number] = [x, y]) {
  const canvas = screen.getByTestId('canvas')
  fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: x, clientY: y, pointerType: 'mouse' })
  fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: moveTo[0], clientY: moveTo[1], pointerType: 'mouse' })
}

const nameField = () => screen.getByRole('textbox', { name: 'Nome do pin' }) as HTMLInputElement

describe('Adicionar pin (AC-F3-01)', () => {
  it('com P, um clique no mapa cria um Novo pin ali, abre o drawer com o nome em edição e volta para Navegar', () => {
    const { ui, pins } = setup()
    fireEvent.keyDown(document.body, { key: 'p' })
    expect(ui.getState().tool).toBe('pin')
    act(() => click(256, 512))
    expect(pins.getState().pins).toEqual([expect.objectContaining({ id: 'p1', type: 'cidade', name: 'Novo pin', pos: { u: 0.25, v: 0.5 } })])
    expect(pins.getState().selectedId).toBe('p1')
    expect(ui.getState().tool).toBe('nav')
    expect(nameField().value).toBe('Novo pin')
    expect(document.activeElement).toBe(nameField())
    expect(nameField().selectionStart).toBe(0)
    expect(nameField().selectionEnd).toBe('Novo pin'.length)
    expect(screen.getByTestId('pin-drawer-type').textContent).toBe('Cidade')
  })

  it('arrastar (pan) não cria pin, e Navegar não cria pin', () => {
    const { ui, pins } = setup()
    click(100, 100)
    expect(pins.getState().pins).toHaveLength(0)
    act(() => ui.getState().setTool('pin'))
    click(100, 100, [140, 100])
    expect(pins.getState().pins).toHaveLength(0)
  })

  it('Esc, com Adicionar pin e sem pin selecionado, volta para Navegar', () => {
    const { ui } = setup()
    fireEvent.keyDown(document.body, { key: 'P' })
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(ui.getState().tool).toBe('nav')
  })

  it('o nome muda a cada tecla; vazio, volta o último nome ao sair do campo', () => {
    const { ui, pins } = setup()
    act(() => ui.getState().setTool('pin'))
    act(() => click(256, 512))
    fireEvent.change(nameField(), { target: { value: 'Valdora' } })
    expect(pins.getState().pins[0].name).toBe('Valdora')
    fireEvent.change(nameField(), { target: { value: '  ' } })
    fireEvent.blur(nameField())
    expect(nameField().value).toBe('Valdora')
    expect(pins.getState().pins[0].name).toBe('Valdora')
  })
})

describe('Selecionar pin (AC-F3-03)', () => {
  it('clicar num pin o seleciona e abre o drawer (sem o nome em edição); Esc fecha', () => {
    const { ui, pins } = setup()
    act(() => ui.getState().setTool('pin'))
    act(() => click(256, 512))
    act(() => pins.getState().select(null))
    expect(screen.queryByTestId('pin-drawer')).toBeNull()
    // O pin tem a âncora em (256, 512): o desenho fica acima dela.
    act(() => click(256, 500))
    expect(pins.getState().selectedId).toBe('p1')
    expect(screen.getByTestId('pin-drawer').dataset.pinId).toBe('p1')
    expect(document.activeElement).not.toBe(nameField())
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' })
    })
    expect(pins.getState().selectedId).toBeNull()
    expect(screen.queryByTestId('pin-drawer')).toBeNull()
  })

  it('com Adicionar pin, clicar num pin o seleciona em vez de criar outro', () => {
    const { ui, pins } = setup()
    act(() => ui.getState().setTool('pin'))
    act(() => click(256, 512))
    act(() => pins.getState().select(null))
    act(() => ui.getState().setTool('pin'))
    act(() => click(256, 500))
    expect(pins.getState().pins).toHaveLength(1)
    expect(pins.getState().selectedId).toBe('p1')
  })

  it('Esc no campo do nome fecha o drawer; o botão Fechar também', () => {
    const { ui, pins } = setup()
    act(() => ui.getState().setTool('pin'))
    act(() => click(256, 512))
    fireEvent.keyDown(nameField(), { key: 'Escape' })
    expect(pins.getState().selectedId).toBeNull()
    act(() => pins.getState().select('p1'))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(pins.getState().selectedId).toBeNull()
  })

  it('com Medir distância, o clique é da medida: não seleciona nem cria', () => {
    const { ui, pins } = setup()
    act(() => ui.getState().setTool('pin'))
    act(() => click(256, 512))
    act(() => pins.getState().select(null))
    act(() => ui.getState().setTool('measure'))
    act(() => click(256, 500))
    expect(pins.getState().selectedId).toBeNull()
    expect(pins.getState().pins).toHaveLength(1)
  })

  it('o mouse sobre um pin o marca como hover', () => {
    const { ui, pins } = setup()
    act(() => ui.getState().setTool('pin'))
    act(() => click(256, 512))
    const canvas = screen.getByTestId('canvas')
    fireEvent.pointerMove(canvas, { clientX: 256, clientY: 500, pointerType: 'mouse' })
    expect(pins.getState().hoveredId).toBe('p1')
    fireEvent.pointerMove(canvas, { clientX: 600, clientY: 600, pointerType: 'mouse' })
    expect(pins.getState().hoveredId).toBeNull()
  })
})

describe('Tipos escondidos e grupos (AC-F3-14, AC-F3-15)', () => {
  const at = (id: string, x: number, y: number) => ({
    id,
    type: 'cidade',
    name: id,
    pos: { u: x / 1024, v: y / 1024 },
    icon: { kind: 'builtin' as const, key: 'cidade' as const },
    description: '',
    tags: [],
    fields: {},
  })

  it('o pin de um tipo escondido não recebe clique nem hover; com Adicionar pin, o clique cria outro', () => {
    const { ui, pins } = setup()
    act(() => pins.getState().replacePins([at('a', 256, 512)]))
    act(() => ui.getState().setLayer('cidade', false))
    const canvas = screen.getByTestId('canvas')
    fireEvent.pointerMove(canvas, { clientX: 256, clientY: 500, pointerType: 'mouse' })
    expect(pins.getState().hoveredId).toBeNull()
    act(() => click(256, 500))
    expect(pins.getState().selectedId).toBeNull()
    act(() => ui.getState().setTool('pin'))
    act(() => click(256, 500))
    expect(pins.getState().pins).toHaveLength(2)
  })

  it('abaixo de 0,8×, clicar no grupo leva a câmera ao ponto médio no zoom 1,3×, sem selecionar nem criar', () => {
    const { ui, pins, camera } = setup()
    const focusOn = vi.fn()
    act(() => camera.getState().setControls({ zoomIn() {}, zoomOut() {}, center() {}, centerOn() {}, focusOn }))
    act(() => camera.getState().update({ zoom: 0.5, scale: 0.5, view: { x: 0, y: 0, width: 2048, height: 2048 }, origin: { x: 0, y: 0 } }))
    // Pins em 400 e 420 do mundo: 200 e 210 px na tela; o grupo fica em (205, 300 − 16).
    act(() => pins.getState().replacePins([at('a', 400, 600), at('b', 420, 600)]))
    act(() => ui.getState().setTool('pin'))
    const canvas = screen.getByTestId('canvas')
    // Sobre o grupo, sem pin no hover: o cursor é a lupa.
    fireEvent.pointerMove(canvas, { clientX: 205, clientY: 284, pointerType: 'mouse' })
    expect(pins.getState().hoveredId).toBeNull()
    expect(pins.getState().groupHovered).toBe(true)
    act(() => click(205, 284))
    expect(focusOn).toHaveBeenCalledWith(410, 600, 1.3)
    expect(pins.getState().selectedId).toBeNull()
    expect(pins.getState().pins).toHaveLength(2)
    fireEvent.pointerMove(canvas, { clientX: 600, clientY: 600, pointerType: 'mouse' })
    expect(pins.getState().groupHovered).toBe(false)
  })

  it('com o mouse parado, o hover acompanha o zoom: o pin entra no grupo e o cursor vira a lupa; o tipo escondido sai do hover', () => {
    const { ui, pins, camera } = setup()
    const canvas = screen.getByTestId('canvas')
    // O jsdom não acha o elemento sob o ponto: o mouse fica sobre o canvas do mapa.
    const doc = document as Document & { elementFromPoint?: (x: number, y: number) => Element | null }
    const original = doc.elementFromPoint
    doc.elementFromPoint = () => canvas
    // No zoom 1 (1 px por unidade), dois pins a 20 px: soltos.
    act(() => pins.getState().replacePins([at('a', 400, 600), at('b', 420, 600)]))
    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 590, pointerType: 'mouse' })
    expect(pins.getState().hoveredId).toBe('a')
    // Afasta para 0,5: os pins (200 e 210 px) viram um grupo em (205, 284); o mouse, em (400, 590), fica fora dele.
    act(() => camera.getState().update({ zoom: 0.5, scale: 0.5, view: { x: 0, y: 0, width: 2048, height: 2048 }, origin: { x: 0, y: 0 } }))
    expect(pins.getState().hoveredId).toBeNull()
    expect(pins.getState().groupHovered).toBe(false)
    // O mouse sobre o grupo, e a câmera volta ao zoom 1: o grupo se desfaz, e a lupa sai.
    fireEvent.pointerMove(canvas, { clientX: 205, clientY: 284, pointerType: 'mouse' })
    expect(pins.getState().groupHovered).toBe(true)
    act(() => camera.getState().update({ zoom: 1, scale: 1, view: { x: 0, y: 0, width: 1024, height: 1024 }, origin: { x: 0, y: 0 } }))
    expect(pins.getState().groupHovered).toBe(false)
    // Sobre um pin, esconder o tipo dele tira o hover.
    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 590, pointerType: 'mouse' })
    expect(pins.getState().hoveredId).toBe('a')
    act(() => ui.getState().setLayer('cidade', false))
    expect(pins.getState().hoveredId).toBeNull()
    doc.elementFromPoint = original
  })
})

describe('Arrastar pin (AC-F3-04)', () => {
  /** Um pin em (0,5; 0,5): a âncora fica em 512, 512 na tela. */
  function withPin() {
    const t = setup()
    act(() => {
      t.pins.getState().addPin({ u: 0.5, v: 0.5 })
      t.pins.getState().select(null)
    })
    return t
  }
  const canvas = () => screen.getByTestId('canvas')
  const pointer = (x: number, y: number) => ({ pointerId: 1, button: 0, clientX: x, clientY: y, pointerType: 'mouse' })

  it('apertar no pin e andar o arrasta, com o ponto pego preso ao ponteiro; soltar o deixa ali', () => {
    const { pins } = withPin()
    fireEvent.pointerDown(canvas(), pointer(512, 500))
    fireEvent.pointerMove(canvas(), pointer(560, 460))
    expect(pins.getState().dragging).toEqual({ id: 'p1', pos: { u: 560 / 1024, v: 472 / 1024 } })
    // Durante o arrasto, a lista ainda não mudou.
    expect(pins.getState().pins[0].pos).toEqual({ u: 0.5, v: 0.5 })
    fireEvent.pointerMove(canvas(), pointer(612, 400))
    fireEvent.pointerUp(canvas(), pointer(612, 400))
    expect(pins.getState().dragging).toBeNull()
    expect(pins.getState().pins[0].pos).toEqual({ u: 612 / 1024, v: 412 / 1024 })
    // O arrasto não seleciona.
    expect(pins.getState().selectedId).toBeNull()
  })

  it('o aperto no pin segura o pan da câmera até soltar e segue para a página (o "clique fora" dos popovers); fora dos pins, não segura', () => {
    const { camera } = withPin()
    const holdPan = vi.fn()
    camera.getState().setControls({ zoomIn() {}, zoomOut() {}, center() {}, centerOn() {}, focusOn() {}, holdPan })
    const onCanvas = vi.fn()
    const onDocument = vi.fn()
    canvas().addEventListener('pointerdown', onCanvas)
    document.addEventListener('pointerdown', onDocument)
    try {
      fireEvent.pointerDown(canvas(), pointer(512, 500))
      expect(holdPan).toHaveBeenLastCalledWith(true)
      expect(onCanvas).toHaveBeenCalledTimes(1)
      expect(onDocument).toHaveBeenCalledTimes(1)
      fireEvent.pointerMove(canvas(), pointer(600, 420))
      fireEvent.pointerUp(canvas(), pointer(600, 420))
      expect(holdPan).toHaveBeenLastCalledWith(false)
      expect(holdPan).toHaveBeenCalledTimes(2)

      fireEvent.pointerDown(canvas(), pointer(100, 100))
      fireEvent.pointerUp(canvas(), pointer(100, 100))
      expect(holdPan).toHaveBeenCalledTimes(2)
    } finally {
      document.removeEventListener('pointerdown', onDocument)
    }
  })

  it('o segundo dedo e o pointercancel soltam o pan', () => {
    const { camera } = withPin()
    const holdPan = vi.fn()
    camera.getState().setControls({ zoomIn() {}, zoomOut() {}, center() {}, centerOn() {}, focusOn() {}, holdPan })
    fireEvent.pointerDown(canvas(), pointer(512, 500))
    fireEvent.pointerDown(canvas(), { ...pointer(700, 700), pointerId: 2, pointerType: 'touch' })
    expect(holdPan).toHaveBeenLastCalledWith(false)
    fireEvent.pointerUp(canvas(), pointer(512, 500))
    fireEvent.pointerUp(canvas(), { ...pointer(700, 700), pointerId: 2, pointerType: 'touch' })

    fireEvent.pointerDown(canvas(), pointer(512, 500))
    expect(holdPan).toHaveBeenLastCalledWith(true)
    fireEvent.pointerCancel(canvas(), pointer(512, 500))
    expect(holdPan).toHaveBeenLastCalledWith(false)
  })

  it('para fora do mapa, a posição fica presa entre 0 e 1', () => {
    const { pins } = withPin()
    fireEvent.pointerDown(canvas(), pointer(512, 500))
    fireEvent.pointerMove(canvas(), pointer(-400, 3000))
    fireEvent.pointerUp(canvas(), pointer(-400, 3000))
    expect(pins.getState().pins[0].pos).toEqual({ u: 0, v: 1 })
  })

  it('andar até a folga do clique seleciona, sem arrastar', () => {
    const { pins } = withPin()
    fireEvent.pointerDown(canvas(), pointer(512, 500))
    fireEvent.pointerMove(canvas(), pointer(514, 501))
    fireEvent.pointerUp(canvas(), pointer(514, 501))
    expect(pins.getState().pins[0].pos).toEqual({ u: 0.5, v: 0.5 })
    expect(pins.getState().selectedId).toBe('p1')
  })

  it('Esc devolve o pin e encerra o arrasto: mexer depois não arrasta, soltar não grava, o pan é solto e a seleção fica', () => {
    const { pins, camera } = withPin()
    const holdPan = vi.fn()
    camera.getState().setControls({ zoomIn() {}, zoomOut() {}, center() {}, centerOn() {}, focusOn() {}, holdPan })
    act(() => pins.getState().select('p1'))
    fireEvent.pointerDown(canvas(), pointer(512, 500))
    fireEvent.pointerMove(canvas(), pointer(700, 700))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(pins.getState().dragging).toBeNull()
    expect(holdPan).toHaveBeenLastCalledWith(false)
    // O Esc foi do arrasto: o drawer continua aberto.
    expect(pins.getState().selectedId).toBe('p1')
    fireEvent.pointerMove(canvas(), pointer(800, 300))
    expect(pins.getState().dragging).toBeNull()
    fireEvent.pointerUp(canvas(), pointer(800, 300))
    expect(pins.getState().pins[0].pos).toEqual({ u: 0.5, v: 0.5 })
    expect(pins.getState().selectedId).toBe('p1')
  })

  it('o pointercancel devolve o pin ao lugar', () => {
    const { pins } = withPin()

    fireEvent.pointerDown(canvas(), pointer(512, 500))
    fireEvent.pointerMove(canvas(), pointer(700, 700))
    fireEvent.pointerCancel(canvas(), pointer(700, 700))
    expect(pins.getState().dragging).toBeNull()
    expect(pins.getState().pins[0].pos).toEqual({ u: 0.5, v: 0.5 })
  })
})

describe('Excluir pin (AC-F3-05)', () => {
  it('Delete pede a exclusão do pin selecionado; sem seleção, nada', () => {
    const onDelete = vi.fn()
    const { pins } = setup({ onDelete })
    act(() => {
      pins.getState().addPin({ u: 0.5, v: 0.5 })
    })
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(onDelete).toHaveBeenCalledWith('p1')
    act(() => pins.getState().select(null))
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('com o foco num botão do drawer (um chip, uma aba, o rodapé), Delete e Backspace não excluem', () => {
    const onDelete = vi.fn()
    const { pins } = setup({ onDelete })
    act(() => {
      pins.getState().addPin({ u: 0.5, v: 0.5 })
    })
    for (const name of ['Duplicar', 'Detalhes']) {
      const target = within(screen.getByTestId('pin-drawer')).getByRole(name === 'Detalhes' ? 'tab' : 'button', { name })
      fireEvent.keyDown(target, { key: 'Backspace' })
      fireEvent.keyDown(target, { key: 'Delete' })
    }
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(onDelete).toHaveBeenCalledWith('p1')
  })
})
