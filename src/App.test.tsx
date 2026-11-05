import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import App from './App'

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
})
