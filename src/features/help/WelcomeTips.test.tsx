import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import type { CreateMapRenderer } from '../../app/MapView'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import { WELCOME_TIPS_DONE, WELCOME_TIPS_KEY, markWelcomeTipsDone, welcomeTipsDone } from './welcome'

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }
const noRenderer: CreateMapRenderer = async () => ({ refit() {}, destroy() {} })

/** `desktop`: a tela tem 768 px ou mais (todas as media queries valem). */
function stubMedia(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: desktop,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

const renderEditor = (welcomeTips = true) =>
  render(<App world={createWorldStore(idleGenerator)} createRenderer={noRenderer} welcomeTips={welcomeTips} />)
const card = () => screen.queryByTestId('welcome-tips')
const highlighted = () => [...document.querySelectorAll('[data-welcome-highlight="true"]')]

beforeEach(() => {
  localStorage.clear()
  stubMedia(true)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('marca das dicas de boas-vindas', () => {
  it('começa sem a marca e a grava', () => {
    expect(welcomeTipsDone()).toBe(false)
    markWelcomeTipsDone()
    expect(localStorage.getItem(WELCOME_TIPS_KEY)).toBe(WELCOME_TIPS_DONE)
    expect(welcomeTipsDone()).toBe(true)
  })

  it('sem acesso ao armazenamento, não mostra as dicas nem quebra ao gravar', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(welcomeTipsDone(broken)).toBe(true)
    expect(() => markWelcomeTipsDone(broken)).not.toThrow()
  })
})

describe('Dicas de boas-vindas (AC-F1-31)', () => {
  it('apresenta os sliders, a toolbar e o adicionar pin, um por vez, com o destaque de cada um', () => {
    renderEditor()
    expect(screen.getByRole('dialog', { name: 'Molde o mundo' })).toBeTruthy()
    expect(card()?.textContent).toContain('1 de 3')
    expect(highlighted()).toEqual([screen.getByTestId('sidebar')])

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(screen.getByRole('dialog', { name: 'Ferramentas do mapa' })).toBeTruthy()
    expect(highlighted()).toEqual([screen.getByRole('toolbar', { name: 'Ferramentas' })])

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(screen.getByRole('dialog', { name: 'Marque lugares' })).toBeTruthy()
    expect(highlighted()).toEqual([screen.getByRole('button', { name: 'Adicionar pin' })])
    expect(welcomeTipsDone()).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Começar' }))
    expect(card()).toBeNull()
    expect(highlighted()).toEqual([])
    expect(welcomeTipsDone()).toBe(true)
  })

  it('Pular fecha e grava a marca; no próximo acesso, as dicas não aparecem', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Pular' }))
    expect(card()).toBeNull()
    expect(welcomeTipsDone()).toBe(true)
    cleanup()
    renderEditor()
    expect(card()).toBeNull()
  })

  it('o X também pula', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar dicas' }))
    expect(card()).toBeNull()
    expect(welcomeTipsDone()).toBe(true)
  })

  it('fechar o editor sem ver nem pular não grava nada: as dicas voltam', () => {
    renderEditor()
    cleanup()
    expect(welcomeTipsDone()).toBe(false)
    renderEditor()
    expect(card()).not.toBeNull()
  })

  it('abaixo de 768 px, o passo dos sliders fala do Abrir painel e o destaca', () => {
    stubMedia(false)
    renderEditor()
    expect(card()?.textContent).toContain('Abra o painel')
    expect(highlighted()).toEqual([screen.getByRole('button', { name: 'Abrir painel' })])
  })

  it('sem welcomeTips (os testes), as dicas não aparecem', () => {
    renderEditor(false)
    expect(card()).toBeNull()
  })
})
