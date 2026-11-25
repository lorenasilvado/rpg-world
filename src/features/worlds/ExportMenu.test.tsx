import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExportMenu } from './ExportMenu'

afterEach(cleanup)

const settle = () => act(() => Promise.resolve())
const button = () => screen.getByRole('button', { name: 'Exportar' })
const item = (name: string) => screen.getByRole('menuitem', { name }) as HTMLButtonElement

describe('Exportar da barra do editor (AC-F4-09)', () => {
  it('sem `onExportJson`, o botão fica desabilitado', () => {
    render(<ExportMenu />)
    expect((button() as HTMLButtonElement).disabled).toBe(true)
  })

  it('abre com o foco no .json; setas, Home e End andam pelos habilitados; Esc fecha e devolve o foco', () => {
    render(<ExportMenu onExportJson={() => Promise.resolve()} />)
    expect(button().getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button())
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(item('Arquivo do mundo (.json)'))
    expect(item('Imagem (.png)').disabled).toBe(true)
    // O PNG desabilitado fica de fora: as setas, Home e End ficam no .json.
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      fireEvent.keyDown(document.activeElement!, { key })
      expect(document.activeElement).toBe(item('Arquivo do mundo (.json)'))
    }
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(button())
  })

  it('seta para baixo no botão abre; Tab ou um clique fora fecham', () => {
    render(<ExportMenu onExportJson={() => Promise.resolve()} />)
    fireEvent.keyDown(button(), { key: 'ArrowDown' })
    expect(screen.getByRole('menu', { name: 'Exportar' })).toBeTruthy()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(button())
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('enquanto exporta, o item diz "Exportando…"; ao terminar, o menu fecha e o foco volta ao botão', async () => {
    let finish!: () => void
    const onExportJson = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    render(<ExportMenu onExportJson={onExportJson} />)
    fireEvent.click(button())
    fireEvent.click(item('Arquivo do mundo (.json)'))
    expect(onExportJson).toHaveBeenCalledTimes(1)
    const exporting = item('Exportando…')
    expect(exporting.disabled).toBe(true)
    fireEvent.click(exporting)
    expect(onExportJson).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(button())
  })

  it('se a exportação falha, o menu continua com o aviso; reabrir limpa o aviso', async () => {
    render(<ExportMenu onExportJson={() => Promise.reject(new Error('bloqueado'))} />)
    fireEvent.click(button())
    fireEvent.click(item('Arquivo do mundo (.json)'))
    await settle()
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível exportar o mundo. Tente de novo.')
    expect(item('Arquivo do mundo (.json)').disabled).toBe(false)
    fireEvent.click(button())
    fireEvent.click(button())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
