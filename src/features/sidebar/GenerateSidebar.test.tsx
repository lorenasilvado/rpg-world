import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import type { CreateMapRenderer } from '../../app/MapView'
import { DEFAULT_WORLD_PARAMS, type WorldParams } from '../../core'
import { createUiStore } from '../../state/uiStore'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import { FLASH_MS } from './GenerateSidebar'

/** Gerador que guarda os pedidos e nunca responde: aqui só importa o que a sidebar pede. */
function recordingGenerator() {
  const requests: { size: number; params?: WorldParams }[] = []
  const gen: WorldGenerator = {
    request: (req) => {
      requests.push({ size: req.size, params: req.params })
      return new Promise(() => {})
    },
    latestVersion: () => requests.length,
  }
  return { gen, requests }
}
const noRenderer: CreateMapRenderer = async () => ({ refit() {}, destroy() {} })

let desktop = true
beforeEach(() => {
  desktop = true
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: desktop,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function setup() {
  const { gen, requests } = recordingGenerator()
  const world = createWorldStore(gen)
  const ui = createUiStore()
  render(<App world={world} ui={ui} createRenderer={noRenderer} />)
  return { world, ui, requests }
}

const LABELS = [
  'Oceano',
  'Praias',
  'Desertos',
  'Florestas',
  'Montanhas',
  'Neve',
  'Tamanho do continente',
  'Rugosidade da costa',
  'Temperatura global',
]

describe('Sidebar: seções e sliders', () => {
  it('tem as seções Terreno, Biomas, Relevo e Avançado; Avançado começa fechada (AC-F1-21)', () => {
    setup()
    const sections = ['Terreno', 'Biomas', 'Relevo', 'Avançado'].map((name) => screen.getByRole('button', { name }))
    expect(sections.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'true', 'true', 'false'])
    expect(screen.getByTestId('section-content-terreno').hidden).toBe(false)
    expect(screen.getByTestId('section-content-avancado').hidden).toBe(true)
  })

  it('as seções recolhem e abrem pelo cabeçalho (AC-F1-21)', () => {
    setup()
    const terreno = screen.getByRole('button', { name: 'Terreno' })
    fireEvent.click(terreno)
    expect(terreno.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByTestId('section-content-terreno').hidden).toBe(true)
    fireEvent.click(terreno)
    expect(terreno.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Avançado' }))
    expect(screen.getByRole('group', { name: 'Avançado' }).hidden).toBe(false)
  })

  it('os 9 sliders têm rótulo, vão de 0 a 100 e mostram o valor padrão (AC-F1-13)', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Avançado' }))
    const sliders = LABELS.map((name) => screen.getByRole('slider', { name }))
    expect(sliders.map((s) => Number(s.getAttribute('aria-valuenow')))).toEqual(Object.values(DEFAULT_WORLD_PARAMS))
    for (const s of sliders) {
      expect(s.getAttribute('aria-valuemin')).toBe('0')
      expect(s.getAttribute('aria-valuemax')).toBe('100')
      expect(s.tabIndex).toBe(0)
    }
    expect(within(screen.getByTestId('slider-ocean')).getByText('45%')).toBeTruthy()
    // Amostra de cor só nos sliders de bioma.
    expect(within(screen.getByTestId('slider-ocean')).queryByTestId('swatch')).toBeTruthy()
    expect(within(screen.getByTestId('slider-temperature')).queryByTestId('swatch')).toBeNull()
  })

  it('só com o teclado: setas mudam 1, Shift + seta 10, Home e End vão a 0 e 100 (AC-F1-13)', () => {
    const { world, requests } = setup()
    const ocean = screen.getByRole('slider', { name: 'Oceano' })
    fireEvent.keyDown(ocean, { key: 'ArrowRight' })
    expect(world.getState().params.ocean).toBe(46)
    fireEvent.keyDown(ocean, { key: 'ArrowLeft', shiftKey: true })
    expect(world.getState().params.ocean).toBe(36)
    fireEvent.keyDown(ocean, { key: 'End' })
    expect(world.getState().params.ocean).toBe(100)
    fireEvent.keyDown(ocean, { key: 'Home' })
    expect(world.getState().params.ocean).toBe(0)
    expect(ocean.getAttribute('aria-valuenow')).toBe('0')
    expect(within(screen.getByTestId('slider-ocean')).getByText('0%')).toBeTruthy()
    // Pelo teclado não há arrasto: cada tecla pede direto o mapa final com o valor novo.
    expect(requests.map((r) => [r.size, r.params?.ocean])).toEqual([
      [1024, 46],
      [1024, 36],
      [1024, 100],
      [1024, 0],
    ])
  })

  it('Desertos + Florestas nunca passa de 100%: Florestas recua e pisca por 700 ms (AC-F1-14)', () => {
    vi.useFakeTimers()
    const { world } = setup()
    const desert = screen.getByRole('slider', { name: 'Desertos' })
    const forest = screen.getByRole('slider', { name: 'Florestas' })
    // Desertos de 15 para 70: 15 + 5 × 10 + 5 × 1.
    for (let i = 0; i < 5; i++) fireEvent.keyDown(desert, { key: 'ArrowRight', shiftKey: true })
    for (let i = 0; i < 5; i++) fireEvent.keyDown(desert, { key: 'ArrowRight' })
    expect(world.getState().params).toMatchObject({ desert: 70, forest: 30 })
    expect(forest.getAttribute('aria-valuenow')).toBe('30')
    expect(screen.getByTestId('slider-forest').dataset.flash).toBe('true')
    expect(screen.getByTestId('slider-desert').dataset.flash).toBe('false')
    act(() => vi.advanceTimersByTime(FLASH_MS))
    expect(screen.getByTestId('slider-forest').dataset.flash).toBe('false')

    fireEvent.keyDown(forest, { key: 'End' })
    expect(world.getState().params).toMatchObject({ desert: 0, forest: 100 })
    expect(screen.getByTestId('slider-desert').dataset.flash).toBe('true')
  })

  it('o recuo repetido não reinicia o flash: ele dura 700 ms e só então pode piscar de novo (AC-F1-14)', () => {
    vi.useFakeTimers()
    const { world } = setup()
    const desert = screen.getByRole('slider', { name: 'Desertos' })
    const flashSpan = () => screen.getByTestId('slider-forest').querySelector('.flash-row')
    // Desertos de 15 a 65: a soma chega a 100, sem recuo.
    for (let i = 0; i < 5; i++) fireEvent.keyDown(desert, { key: 'ArrowRight', shiftKey: true })
    expect(flashSpan()).toBeNull()
    // 66: Florestas recua para 34 e pisca.
    fireEvent.keyDown(desert, { key: 'ArrowRight' })
    const first = flashSpan()
    expect(first).toBeTruthy()
    act(() => vi.advanceTimersByTime(FLASH_MS / 2))
    // 67: recua de novo (33) no meio do flash: o mesmo elemento, a animação segue sem recomeçar.
    fireEvent.keyDown(desert, { key: 'ArrowRight' })
    expect(world.getState().params).toMatchObject({ desert: 67, forest: 33 })
    expect(flashSpan()).toBe(first)
    // Os 700 ms contam do primeiro recuo.
    act(() => vi.advanceTimersByTime(FLASH_MS / 2))
    expect(flashSpan()).toBeNull()
    // Depois do fim, um recuo novo pisca de novo.
    fireEvent.keyDown(desert, { key: 'ArrowRight' })
    expect(flashSpan()).toBeTruthy()
  })

  it('o painel recolhe a 48 px e abre pelo botão e pela tecla [ (AC-F1-21)', () => {
    const { ui } = setup()
    const sidebar = screen.getByTestId('sidebar')
    fireEvent.click(screen.getByRole('button', { name: 'Recolher painel' }))
    expect(ui.getState().sidebarCollapsed).toBe(true)
    expect(sidebar.dataset.collapsed).toBe('true')
    expect(screen.queryByRole('slider', { name: 'Oceano' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Expandir painel' }))

    fireEvent.keyDown(document.body, { key: '[' })
    expect(sidebar.dataset.collapsed).toBe('false')
    expect(screen.getByRole('slider', { name: 'Oceano' })).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Oceano' }), { key: '[' })
    expect(sidebar.dataset.collapsed).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Expandir painel' }))
    expect(sidebar.dataset.collapsed).toBe('false')
  })

  it('no trilho recolhido, o ícone da seção abre o painel com ela aberta (AC-F1-21)', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Recolher painel' }))
    const rail = screen.getByTestId('sidebar-rail')
    fireEvent.click(within(rail).getByRole('button', { name: 'Avançado' }))
    const avancado = screen.getByRole('button', { name: 'Avançado' })
    expect(avancado.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(avancado)
    expect(screen.getByRole('slider', { name: 'Temperatura global' })).toBeTruthy()
  })

  it('a tecla [ não vale num campo de texto nem com Ctrl', () => {
    const { ui } = setup()
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: '[' })
    fireEvent.keyDown(document.body, { key: '[', ctrlKey: true })
    expect(ui.getState().sidebarCollapsed).toBe(false)
    input.remove()
  })

  it('num input que não recebe texto (checkbox), a tecla [ continua sendo o atalho', () => {
    const { ui } = setup()
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    document.body.appendChild(checkbox)
    fireEvent.keyDown(checkbox, { key: '[' })
    expect(ui.getState().sidebarCollapsed).toBe(true)
    checkbox.remove()
  })

  it('abaixo de 768 px não há botão de recolher, e a tecla [ abre e fecha o painel sobreposto', () => {
    desktop = false
    const { ui } = setup()
    const sidebar = screen.getByTestId('sidebar')
    expect(screen.queryByRole('button', { name: 'Recolher painel' })).toBeNull()
    fireEvent.keyDown(document.body, { key: '[' })
    expect(sidebar.dataset.open).toBe('true')
    fireEvent.keyDown(document.body, { key: '[' })
    expect(sidebar.dataset.open).toBe('false')
    expect(ui.getState().sidebarCollapsed).toBe(false)
  })
})
