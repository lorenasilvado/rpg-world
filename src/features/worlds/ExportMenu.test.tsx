import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapImageOptions } from '../../render/mapImage'
import { ExportMenu } from './ExportMenu'

afterEach(cleanup)

const settle = () => act(() => Promise.resolve())
/** O Radix devolve o foco depois de fechar o modal, num timer. */
const focusSettles = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
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
    // Sem `onExportImage`, o PNG fica desabilitado e de fora: as setas, Home e End ficam no .json.
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

describe('Exportar › Imagem (.png) (AC-F4-11)', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Exportar imagem' })
  const openDialog = (onExportImage: (o: MapImageOptions) => Promise<void>) => {
    render(<ExportMenu onExportJson={() => Promise.resolve()} onExportImage={onExportImage} />)
    fireEvent.click(button())
    expect(item('Imagem (.png)').disabled).toBe(false)
    fireEvent.click(item('Imagem (.png)'))
    expect(screen.queryByRole('menu')).toBeNull()
    return dialog()
  }

  it('abre o modal com 1× e os pins ligados; as escalas mostram o tamanho em px', () => {
    const d = openDialog(() => Promise.resolve())
    const radios = within(d).getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.closest('label')!.textContent)).toEqual(['1×1024 × 1024 px', '2×2048 × 2048 px', '4×4096 × 4096 px'])
    expect(radios.map((r) => r.checked)).toEqual([true, false, false])
    expect((within(d).getByRole('checkbox', { name: 'Pins e rótulos' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByTestId('export-image-slow')).toBeNull()
    fireEvent.click(radios[2])
    expect(screen.getByTestId('export-image-slow').textContent).toBe('Em 4×, gerar a imagem pode levar até um minuto.')
  })

  it('Baixar PNG exporta com a escala e a opção escolhidas; enquanto gera, nada fecha o modal; no fim fecha e o foco volta ao Exportar', async () => {
    let finish!: () => void
    const onExportImage = vi.fn((_o: MapImageOptions) => new Promise<void>((resolve) => (finish = resolve)))
    const d = openDialog(onExportImage)
    fireEvent.click(within(d).getByRole('radio', { name: /^4×/ }))
    fireEvent.click(within(d).getByRole('checkbox', { name: 'Pins e rótulos' }))
    fireEvent.click(within(d).getByRole('button', { name: 'Baixar PNG' }))
    expect(onExportImage).toHaveBeenCalledWith({ scale: 4, pins: false })
    const busy = within(d).getByRole('button', { name: 'Gerando imagem…' }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    expect((within(d).getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(d).getByRole('radio', { name: /^1×/ }).matches(':disabled')).toBe(true)
    fireEvent.keyDown(document.activeElement ?? d, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    await act(async () => finish())
    expect(screen.queryByRole('dialog')).toBeNull()
    await focusSettles()
    expect(document.activeElement).toBe(button())
  })

  it('se falha, o modal continua com o aviso e dá para tentar de novo', async () => {
    const onExportImage = vi.fn().mockRejectedValueOnce(new Error('sem memória')).mockResolvedValueOnce(undefined)
    const d = openDialog(onExportImage)
    fireEvent.click(within(d).getByRole('button', { name: 'Baixar PNG' }))
    await settle()
    expect(within(d).getByRole('alert').textContent).toBe('Não foi possível exportar a imagem. Tente de novo.')
    fireEvent.click(within(d).getByRole('button', { name: 'Baixar PNG' }))
    await settle()
    expect(onExportImage).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Cancelar fecha sem exportar e devolve o foco ao Exportar', async () => {
    const onExportImage = vi.fn(() => Promise.resolve())
    const d = openDialog(onExportImage)
    fireEvent.click(within(d).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onExportImage).not.toHaveBeenCalled()
    await focusSettles()
    expect(document.activeElement).toBe(button())
  })
})
