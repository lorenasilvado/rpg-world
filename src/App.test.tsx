import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

// jsdom não tem matchMedia: este stub guarda os ouvintes para simular a troca de largura.
let mediaListeners: Array<(e: { matches: boolean }) => void> = []
beforeEach(() => {
  mediaListeners = []
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: false,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => mediaListeners.push(fn),
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      mediaListeners = mediaListeners.filter((l) => l !== fn)
    },
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.theme
})

describe('Layout vazio do editor', () => {
  it('mostra a sidebar, o mapa e o drawer (AC-M0-01)', () => {
    render(<App />)
    expect(screen.getByRole('complementary', { name: 'Gerar mundo' })).toBeTruthy()
    expect(screen.getByRole('main', { name: 'Mapa' })).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'Detalhes' })).toBeTruthy()
  })

  it('alterna entre tema claro e escuro (AC-M0-03)', () => {
    render(<App />)
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('abre e fecha a sidebar e o drawer pelos botões (AC-M0-02)', () => {
    render(<App />)
    const sidebar = screen.getByTestId('sidebar')
    const drawer = screen.getByTestId('drawer')
    expect(sidebar.dataset.open).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel' }))
    expect(sidebar.dataset.open).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    expect(sidebar.dataset.open).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes' }))
    expect(drawer.dataset.open).toBe('true')
    fireEvent.click(screen.getByTestId('scrim'))
    expect(drawer.dataset.open).toBe('false')
  })

  it('Esc fecha o painel aberto e o foco volta ao botão que o abriu', () => {
    render(<App />)
    const opener = screen.getByRole('button', { name: 'Abrir painel' })
    opener.focus()
    fireEvent.click(opener)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar painel' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('sidebar').dataset.open).toBe('false')
    expect(document.activeElement).toBe(opener)

    const drawerOpener = screen.getByRole('button', { name: 'Abrir detalhes' })
    fireEvent.click(drawerOpener)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar detalhes' }))
    fireEvent.click(screen.getByTestId('scrim'))
    expect(document.activeElement).toBe(drawerOpener)
  })

  it('com um painel aberto, o resto da tela fica inert', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel' }))
    expect(screen.getByTestId('actions').hasAttribute('inert')).toBe(true)
    expect(screen.getByTestId('map').hasAttribute('inert')).toBe(true)
    expect(screen.getByTestId('drawer').hasAttribute('inert')).toBe(true)
    expect(screen.getByTestId('sidebar').hasAttribute('inert')).toBe(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('actions').hasAttribute('inert')).toBe(false)
  })

  it('ao passar para 768 px ou mais, os painéis abertos fecham', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes' }))
    expect(screen.getByTestId('drawer').dataset.open).toBe('true')
    act(() => mediaListeners.forEach((fn) => fn({ matches: true })))
    expect(screen.getByTestId('drawer').dataset.open).toBe('false')
  })
})
