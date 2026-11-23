import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BIOME, type CoreField } from '../../core'
import type { Pin } from '../../persistence/types'
import { createCameraStore } from '../../state/cameraStore'
import { createPinsStore } from '../../state/pinsStore'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import { CENTER_PIN_ZOOM, PinDrawer } from './PinDrawer'

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

afterEach(cleanup)

const pin = (id: string, patch: Partial<Pin> = {}): Pin => ({
  id,
  type: 'cidade',
  name: id,
  pos: { u: 0.75, v: 0.25 },
  icon: { kind: 'builtin', key: 'cidade' },
  description: '<p>Capital do reino</p>',
  tags: [],
  fields: {},
  ...patch,
})

function setup(list: Pin[] = [pin('Valdora', { tags: ['capital', 'porto'] }), pin('Brumado', { tags: ['militar', 'porto'] })]) {
  let n = 0
  const pins = createPinsStore(list, { newId: () => `c${++n}` })
  const world = createWorldStore(idleGenerator)
  // Campo 2 × 2: o quadrante de cima à direita é Colina.
  const field = { width: 2, height: 2, biome: new Uint8Array([BIOME.deepOcean, BIOME.hill, BIOME.forest, BIOME.desert]) }
  world.setState({ field: field as unknown as CoreField })
  const camera = createCameraStore()
  const focusOn = vi.fn()
  camera.getState().setControls({ zoomIn() {}, zoomOut() {}, center() {}, centerOn() {}, focusOn })
  camera.getState().update({ zoom: 1, scale: 0.5, view: { x: 0, y: 0, width: 1024, height: 1024 }, origin: { x: 0, y: 0 } })
  const onDelete = vi.fn()
  const onCentered = vi.fn()
  render(<PinDrawer pins={pins} world={world} camera={camera} onDelete={onDelete} onCentered={onCentered} />)
  act(() => pins.getState().select(list[0].id))
  return { pins, focusOn, onDelete, onCentered }
}

describe('drawer do pin: cabeçalho (AC-F3-06)', () => {
  it('mostra o ícone, o nome editável, o tipo, o bioma sob o pin e as coordenadas', () => {
    setup()
    expect(screen.getByTestId('pin-drawer-icon').querySelector('svg')).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Nome do pin' }) as HTMLInputElement).value).toBe('Valdora')
    expect(screen.getByTestId('pin-drawer-type').textContent).toBe('Cidade')
    expect(screen.getByTestId('pin-drawer-place').textContent).toBe('Colina · x 768, y 256')
  })

  it('as abas Descrição (ativa), Detalhes e Conexões mudam pelas setas', () => {
    setup()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Descrição', 'Detalhes', 'Conexões'])
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Detalhes' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('pin-tags')).toBeNull()
    fireEvent.keyDown(tabs[1], { key: 'Home' })
    expect(screen.getByTestId('pin-tags')).toBeTruthy()
  })
})

describe('drawer do pin: descrição (AC-F3-07)', () => {
  it('um link salvo ou importado fora de http, https e mailto vira texto', () => {
    const html =
      '<p><a href="https://a.com">web</a> <a href="mailto:a@b.com">mail</a> <a href="ftp://a.com">ftp</a> ' +
      '<a href="tel:+5511999990000">tel</a> <a href="sms:123">sms</a> <a href="javascript:alert(1)">js</a></p>'
    setup([pin('Valdora', { description: html })])
    const editor = screen.getByTestId('pin-description')
    expect([...editor.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://a.com', 'mailto:a@b.com'])
    expect(editor.textContent).toBe('web mail ftp tel sms js')
  })
})

describe('drawer do pin: links salvos (AC-F3-07)', () => {
  it('um javascript: com caractere de controle na frente vira texto, e um link sem esquema vira https', () => {
    const html = '<p><a href="' + String.fromCharCode(1) + 'javascript:alert(1).x">perigo</a> <a href="a.com/x">site</a> <a href="mestre@a.com">mail</a></p>'
    setup([pin('Valdora', { description: html })])
    const editor = screen.getByTestId('pin-description')
    expect([...editor.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://a.com/x', 'mailto:mestre@a.com'])
    expect(editor.textContent).toBe('perigo site mail')
  })
})

describe('drawer do pin: tags (AC-F3-08)', () => {
  const chips = () => screen.getAllByTestId('pin-tag').map((t) => t.textContent)

  it('"+ tag" adiciona com Enter ou vírgula; repetida não entra', () => {
    const { pins } = setup()
    const input = screen.getByRole('textbox', { name: 'Nova tag' })
    fireEvent.change(input, { target: { value: 'reino' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'Porto, mercado,' } })
    expect(chips()).toEqual(['capital', 'porto', 'reino', 'mercado'])
    expect(pins.getState().pins[0].tags).toEqual(['capital', 'porto', 'reino', 'mercado'])
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('o chip remove a tag, e "Usadas no mundo" sugere as dos outros pins', () => {
    const { pins } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Remover a tag capital' }))
    expect(pins.getState().pins[0].tags).toEqual(['porto'])
    const sugg = screen.getByTestId('pin-tag-suggestions')
    expect(within(sugg).getAllByRole('button').map((b) => b.textContent)).toEqual(['+ militar'])
    fireEvent.click(within(sugg).getByRole('button', { name: 'Adicionar a tag militar' }))
    expect(pins.getState().pins[0].tags).toEqual(['porto', 'militar'])
    expect(screen.queryByTestId('pin-tag-suggestions')).toBeNull()
  })
})

describe('drawer do pin: rodapé (AC-F3-05, AC-F3-09)', () => {
  it('Centralizar foca a câmera no pin, aproximando até 1,6×', () => {
    const { focusOn, onCentered } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Centralizar no pin' }))
    expect(focusOn).toHaveBeenCalledWith(768, 256, CENTER_PIN_ZOOM)
    expect(onCentered).toHaveBeenCalled()
  })

  it('Duplicar cria "<nome> (cópia)" ao lado, com a mesma ficha, e a seleciona', () => {
    const { pins } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }))
    const copy = pins.getState().pins.at(-1)!
    // Escala 0,5 px por unidade: 36 px na tela são 72 unidades do mundo.
    expect(copy).toMatchObject({ id: 'c1', name: 'Valdora (cópia)', tags: ['capital', 'porto'], description: '<p>Capital do reino</p>' })
    expect(copy.pos.u).toBeCloseTo(0.75 + 72 / 1024)
    expect(pins.getState().selectedId).toBe('c1')
    expect((screen.getByRole('textbox', { name: 'Nome do pin' }) as HTMLInputElement).value).toBe('Valdora (cópia)')
  })

  it('Excluir chama a exclusão do pin', () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onDelete).toHaveBeenCalledWith('Valdora')
  })
})
