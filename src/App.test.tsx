import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import type { CreateMapRenderer } from './app/MapView'
import { createWorldStore, type WorldGenerator } from './state/worldStore'

/** Um gerador que nunca responde: os testes de layout não dependem da geração. */
const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }
const world = () => createWorldStore(idleGenerator)
/** O jsdom não tem WebGL: o mapa não é desenhado nestes testes. */
const noRenderer: CreateMapRenderer = async () => ({ refit() {}, destroy() {} })

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
    render(<App world={world()} createRenderer={noRenderer} />)
    expect(screen.getByRole('complementary', { name: 'Gerar mundo' })).toBeTruthy()
    expect(screen.getByRole('main', { name: 'Mapa' })).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'Detalhes' })).toBeTruthy()
  })

  it('alterna entre tema claro e escuro (AC-M0-03)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('abre e fecha a sidebar e o drawer pelos botões (AC-M0-02)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
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
    render(<App world={world()} createRenderer={noRenderer} />)
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
    render(<App world={world()} createRenderer={noRenderer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel' }))
    expect(screen.getByTestId('actions').hasAttribute('inert')).toBe(true)
    expect(screen.getByTestId('map').hasAttribute('inert')).toBe(true)
    expect(screen.getByTestId('drawer').hasAttribute('inert')).toBe(true)
    expect(screen.getByTestId('sidebar').hasAttribute('inert')).toBe(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('actions').hasAttribute('inert')).toBe(false)
  })

  it('ao passar para 768 px ou mais, os painéis abertos fecham', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes' }))
    expect(screen.getByTestId('drawer').dataset.open).toBe('true')
    act(() => mediaListeners.forEach((fn) => fn({ matches: true })))
    expect(screen.getByTestId('drawer').dataset.open).toBe('false')
  })
})

describe('Barras do editor e Ajuda', () => {
  it('a barra superior tem Buscar, Desfazer, Refazer e Exportar desabilitados, e tema e Ajuda ativos (AC-F2-10)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    const actions = screen.getByTestId('actions')
    for (const name of ['Buscar', 'Desfazer', 'Refazer', 'Exportar']) {
      const button = actions.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)
      expect(button?.disabled, name).toBe(true)
    }
    for (const name of ['Usar tema escuro', 'Ajuda']) {
      expect(actions.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)?.disabled, name).toBe(false)
    }
    expect(screen.getByRole('toolbar', { name: 'Ferramentas' })).toBeTruthy()
  })

  it('Ajuda abre o modal "Atalhos de teclado" com os atalhos que funcionam, e Fechar o fecha (AC-F2-12)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajuda' }))
    const dialog = screen.getByRole('dialog', { name: 'Atalhos de teclado' })
    const rows = Array.from(dialog.querySelectorAll('dt')).map((dt) => `${dt.textContent} ${dt.nextElementSibling?.textContent}`)
    expect(rows).toEqual(['Navegar V', 'Medir distância M', 'Mover o mapa Setas / WASD', 'Zoom + / −', 'Centralizar mapa 0', 'Recolher painel [', 'Cancelar / fechar Esc', 'Atalhos ?'])
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog', { name: 'Atalhos de teclado' })).toBeNull()
  })

  it('a tecla ? abre o modal, menos com o foco num campo (AC-F2-12)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    seed.focus()
    fireEvent.keyDown(seed, { key: '?' })
    expect(screen.queryByRole('dialog', { name: 'Atalhos de teclado' })).toBeNull()
    seed.blur()
    fireEvent.keyDown(document.body, { key: '?' })
    expect(screen.getByRole('dialog', { name: 'Atalhos de teclado' })).toBeTruthy()
  })

  it('com um painel aberto (celular), a tecla ? não abre o modal', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel' }))
    fireEvent.keyDown(document.body, { key: '?' })
    expect(screen.queryByRole('dialog', { name: 'Atalhos de teclado' })).toBeNull()
  })
})

describe('Sem WebGL2 (AC-F1-20)', () => {
  it('mostra o aviso com os navegadores suportados no lugar do editor', () => {
    render(<App world={world()} createRenderer={noRenderer} webgl2={false} />)
    expect(screen.queryByTestId('editor')).toBeNull()
    expect(screen.queryByRole('main', { name: 'Mapa' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Este navegador não tem WebGL2' })).toBeTruthy()
    const browsers = screen.getByRole('list', { name: 'Navegadores suportados' })
    expect(browsers.textContent).toContain('Google Chrome')
    expect(browsers.textContent).toContain('Microsoft Edge')
    expect(browsers.textContent).toContain('Mozilla Firefox')
    expect(browsers.textContent).toContain('Safari')
  })

  it('o aviso alterna entre tema claro e escuro, como o editor', () => {
    render(<App world={world()} createRenderer={noRenderer} webgl2={false} />)
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
