import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createUiStore } from '../../state/uiStore'
import { MapToolbar } from './MapToolbar'

afterEach(cleanup)

describe('Toolbar de ferramentas (AC-F2-10)', () => {
  it('mostra as seis ferramentas; Navegar fica ativa e as funções que ainda não existem, desabilitadas', () => {
    render(<MapToolbar ui={createUiStore()} />)
    const toolbar = screen.getByRole('toolbar', { name: 'Ferramentas' })
    const names = Array.from(toolbar.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Navegar', 'Adicionar pin', 'Desenhar estrada', 'Rota automática', 'Camadas', 'Medir distância'])
    const nav = screen.getByRole('button', { name: 'Navegar' })
    expect(nav.getAttribute('aria-pressed')).toBe('true')
    expect((nav as HTMLButtonElement).disabled).toBe(false)
    for (const name of ['Adicionar pin', 'Desenhar estrada', 'Rota automática', 'Medir distância']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    }
    expect((screen.getByRole('button', { name: 'Camadas' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('o hover do mouse mostra o tooltip com o nome e o atalho', () => {
    render(<MapToolbar ui={createUiStore()} />)
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Adicionar pin' }).parentElement!, { pointerType: 'mouse' })
    expect(screen.getByRole('tooltip').textContent).toBe('Adicionar pinP')
    fireEvent.pointerLeave(screen.getByRole('button', { name: 'Adicionar pin' }).parentElement!, { pointerType: 'mouse' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('em pé, a toolbar diz a orientação vertical', () => {
    render(<MapToolbar ui={createUiStore()} vertical />)
    expect(screen.getByRole('toolbar').getAttribute('aria-orientation')).toBe('vertical')
  })
})

describe('Camadas (AC-F2-11)', () => {
  it('abre o popover, e o interruptor "Decoração" liga e desliga a decoração', () => {
    const ui = createUiStore()
    render(<MapToolbar ui={ui} />)
    const layers = screen.getByRole('button', { name: 'Camadas' })
    expect(layers.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(layers)
    expect(layers.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('group', { name: 'Camadas' })).toBeTruthy()

    const decor = screen.getByRole('switch', { name: 'Decoração' })
    expect(decor.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(decor)
    expect(ui.getState().layers.decor).toBe(false)
    expect(decor.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(decor)
    expect(ui.getState().layers.decor).toBe(true)
  })

  it('o interruptor acompanha o estado (desligado por fora)', () => {
    const ui = createUiStore()
    render(<MapToolbar ui={ui} />)
    fireEvent.click(screen.getByRole('button', { name: 'Camadas' }))
    act(() => ui.getState().setLayer('decor', false))
    expect(screen.getByRole('switch', { name: 'Decoração' }).getAttribute('aria-checked')).toBe('false')
  })

  it('fecha por Camadas de novo, por Esc (o foco volta a Camadas) e por um clique fora', () => {
    render(<MapToolbar ui={createUiStore()} />)
    const layers = screen.getByRole('button', { name: 'Camadas' })
    fireEvent.click(layers)
    fireEvent.click(layers)
    expect(screen.queryByRole('group', { name: 'Camadas' })).toBeNull()

    fireEvent.click(layers)
    screen.getByRole('switch', { name: 'Decoração' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Camadas' })).toBeNull()
    expect(document.activeElement).toBe(layers)

    fireEvent.click(layers)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('group', { name: 'Camadas' })).toBeNull()
  })
})
