import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import type { SaveState, SaveStatus } from '../../persistence/autosave'
import { SaveIndicator } from './SaveIndicator'

afterEach(cleanup)

function saveStore(status: SaveStatus) {
  const retry = vi.fn()
  const store = createStore<SaveState>()(() => ({ status, error: null, retry }))
  return { store, retry }
}

describe('SaveIndicator (AC-F4-02)', () => {
  it('mostra "Salvo" e "Salvando…", e anuncia o status', () => {
    const { store } = saveStore('saved')
    render(<SaveIndicator save={store} />)
    expect(screen.getByTestId('save-indicator').textContent).toContain('Salvo')
    expect(screen.getByRole('status').textContent).toBe('Salvo')
    act(() => store.setState({ status: 'saving' }))
    expect(screen.getByTestId('save-indicator').dataset.status).toBe('saving')
    expect(screen.getByRole('status').textContent).toBe('Salvando…')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('com erro, o indicador abre o menu com "Tentar de novo" e "Exportar .json"', () => {
    const { store, retry } = saveStore('error')
    render(<SaveIndicator save={store} />)
    const button = screen.getByRole('button', { name: 'Erro ao salvar' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const retryItem = screen.getByRole('menuitem', { name: 'Tentar de novo' })
    expect(document.activeElement).toBe(retryItem)
    const exportItem = screen.getByRole('menuitem', { name: 'Exportar .json' }) as HTMLButtonElement
    expect(exportItem.disabled).toBe(true)
    fireEvent.click(retryItem)
    expect(retry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('com `onExport`, "Exportar .json" baixa o arquivo do mundo e fecha o menu (AC-F4-02, AC-F4-09)', async () => {
    const { store } = saveStore('error')
    const onExport = vi.fn(() => Promise.resolve())
    render(<SaveIndicator save={store} onExport={onExport} />)
    fireEvent.click(screen.getByRole('button', { name: 'Erro ao salvar' }))
    const exportItem = screen.getByRole('menuitem', { name: 'Exportar .json' }) as HTMLButtonElement
    expect(exportItem.disabled).toBe(false)
    fireEvent.click(exportItem)
    expect(onExport).toHaveBeenCalledTimes(1)
    await act(() => Promise.resolve())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('se "Exportar .json" falha, o menu continua aberto com o aviso; reabrir limpa o aviso', async () => {
    const { store } = saveStore('error')
    render(<SaveIndicator save={store} onExport={() => Promise.reject(new Error('bloqueado'))} />)
    const button = screen.getByRole('button', { name: 'Erro ao salvar' })
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar .json' }))
    await act(() => Promise.resolve())
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível exportar o mundo. Tente de novo.')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Esc fecha o menu e devolve o foco ao indicador; um clique fora também fecha', () => {
    const { store } = saveStore('error')
    render(<SaveIndicator save={store} />)
    const button = screen.getByRole('button', { name: 'Erro ao salvar' })
    fireEvent.click(button)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(button)
    fireEvent.click(button)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('o menu fecha quando o salvamento volta a dar certo', () => {
    const { store } = saveStore('error')
    render(<SaveIndicator save={store} />)
    fireEvent.click(screen.getByRole('button', { name: 'Erro ao salvar' }))
    act(() => store.setState({ status: 'saved' }))
    expect(screen.queryByRole('menu')).toBeNull()
    act(() => store.setState({ status: 'error' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
