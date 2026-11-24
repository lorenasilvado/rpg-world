import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../../persistence/types'
import { createCameraStore } from '../../state/cameraStore'
import { createPinImages } from '../../state/pinImages'
import { createPinsStore } from '../../state/pinsStore'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import { PinDrawer } from './PinDrawer'
import { IMAGE_MAX_BYTES } from './uploadImage'

// A aba Detalhes do drawer (#160): tipo, ícone, imagem enviada e campos livres (AC-F3-10, AC-F3-11).

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

afterEach(cleanup)

const pin = (id: string, patch: Partial<Pin> = {}): Pin => ({
  id,
  type: 'cidade',
  name: id,
  pos: { u: 0.5, v: 0.5 },
  icon: { kind: 'builtin', key: 'cidade' },
  description: '',
  tags: [],
  fields: {},
  ...patch,
})

function setup(list: Pin[] = [pin('Valdora')], resizeImage: (file: Blob) => Promise<Blob> = async () => new Blob(['png'], { type: 'image/png' })) {
  const pins = createPinsStore(list)
  const world = createWorldStore(idleGenerator)
  const camera = createCameraStore()
  let n = 0
  const images = createPinImages({ worldId: 'w1', newId: () => `img${++n}` })
  render(<PinDrawer pins={pins} images={images} world={world} camera={camera} onDelete={() => {}} resizeImage={resizeImage} />)
  act(() => pins.getState().select(list[0].id))
  fireEvent.click(screen.getByRole('tab', { name: 'Detalhes' }))
  return { pins, images, panel: screen.getByRole('tabpanel', { name: 'Detalhes' }) }
}

/** Um arquivo de `size` bytes (o conteúdo não importa: a redução é trocada nos testes). */
function fakeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const upload = (file: File) => fireEvent.change(screen.getByLabelText(/^(Enviar|Trocar) imagem$/), { target: { files: [file] } })

describe('aba Detalhes: tipo e ícone (AC-F3-10)', () => {
  it('a biblioteca mostra os 7 tipos, com o do pin marcado; escolher outro troca o tipo e o ícone', () => {
    const { pins, panel } = setup()
    const radios = within(panel).getAllByRole('radio')
    expect(radios.map((r) => r.closest('label')!.textContent)).toEqual(['Cidade', 'Vila', 'Castelo', 'Masmorra', 'NPC', 'Ponto de interesse', 'Personalizado'])
    expect((within(panel).getByRole('radio', { name: 'Cidade' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(within(panel).getByRole('radio', { name: 'Masmorra' }))
    expect(pins.getState().pins[0]).toMatchObject({ type: 'masmorra', icon: { kind: 'builtin', key: 'masmorra' } })
    // O cabeçalho acompanha.
    expect(screen.getByTestId('pin-drawer-type').textContent).toBe('Masmorra')
    expect(screen.getByTestId('pin-drawer-icon').querySelector('svg')!.getAttribute('data-pin-type')).toBe('masmorra')
  })

  it('o pin pai ainda não existe: "Em breve"', () => {
    const { panel } = setup()
    expect(within(panel).getByRole('heading', { name: /Pin pai/ }).textContent).toBe('Pin paiEm breve')
  })
})

describe('aba Detalhes: imagem enviada (AC-F3-11)', () => {
  it('PNG, JPG ou SVG de até 1 MB: reduzida, guardada como blob e no círculo do Personalizado', async () => {
    const png = new Blob(['256'], { type: 'image/png' })
    const resizeImage = vi.fn(async () => png)
    const { pins, images } = setup(undefined, resizeImage)
    const files = [
      ['brasao.png', 'image/png'],
      ['brasao.jpg', 'image/jpeg'],
      ['brasao.svg', 'image/svg+xml'],
    ]
    for (const [i, [name, type]] of files.entries()) {
      await act(async () => upload(fakeFile(name, type, IMAGE_MAX_BYTES)))
      expect(pins.getState().pins[0]).toMatchObject({ type: 'custom', icon: { kind: 'image', blobId: `img${i + 1}` } })
      expect(images.blob(`img${i + 1}`)).toBe(png)
    }
    expect(resizeImage).toHaveBeenCalledTimes(3)
    expect(screen.getByTestId('pin-drawer-type').textContent).toBe('Personalizado')
    expect((screen.getByRole('radio', { name: 'Personalizado' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByLabelText('Trocar imagem')).toBeTruthy()
  })

  it('"Remover imagem" volta ao Personalizado com o círculo hachurado', async () => {
    const { pins } = setup()
    await act(async () => upload(fakeFile('a.png', 'image/png', 10)))
    fireEvent.click(screen.getByRole('button', { name: 'Remover imagem' }))
    expect(pins.getState().pins[0]).toMatchObject({ type: 'custom', icon: { kind: 'builtin', key: 'custom' } })
    expect(screen.queryByRole('button', { name: 'Remover imagem' })).toBeNull()
  })

  it('acima de 1 MB, pergunta; Recusar deixa o ícone anterior', () => {
    const resizeImage = vi.fn(async () => new Blob(['png']))
    const { pins } = setup(undefined, resizeImage)
    upload(fakeFile('mapa grande.png', 'image/png', 2.4 * 1024 * 1024))
    const ask = screen.getByRole('alertdialog', { name: 'Imagem acima de 1 MB' })
    expect(ask.textContent).toContain('“mapa grande.png” tem 2,4 MB, e o limite é 1 MB. Recuse o arquivo ou aceite a imagem reduzida para 256 px.')
    expect(document.activeElement).toBe(within(ask).getByRole('button', { name: 'Aceitar com redução' }))
    fireEvent.click(within(ask).getByRole('button', { name: 'Recusar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(resizeImage).not.toHaveBeenCalled()
    expect(pins.getState().pins[0]).toMatchObject({ type: 'cidade', icon: { kind: 'builtin', key: 'cidade' } })
  })

  it('acima de 1 MB, "Aceitar com redução" reduz e guarda', async () => {
    const resizeImage = vi.fn(async () => new Blob(['png']))
    const { pins } = setup(undefined, resizeImage)
    upload(fakeFile('mapa.jpg', 'image/jpeg', 2 * IMAGE_MAX_BYTES))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Aceitar com redução' })))
    expect(resizeImage).toHaveBeenCalledTimes(1)
    expect(pins.getState().pins[0]).toMatchObject({ type: 'custom', icon: { kind: 'image', blobId: 'img1' } })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('outro formato é recusado com a mensagem dos formatos aceitos, e o ícone anterior continua', () => {
    const resizeImage = vi.fn(async () => new Blob(['png']))
    const { pins } = setup([pin('Valdora', { type: 'custom', icon: { kind: 'image', blobId: 'antiga' } })], resizeImage)
    upload(fakeFile('dragao.gif', 'image/gif', 10))
    expect(screen.getByRole('alert').textContent).toBe('Formato não aceitoEnvie uma imagem PNG, JPG ou SVG.')
    expect(resizeImage).not.toHaveBeenCalled()
    expect(pins.getState().pins[0].icon).toEqual({ kind: 'image', blobId: 'antiga' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar mensagem' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('acima de 20 MB, recusa sem perguntar, e o ícone anterior continua', () => {
    const resizeImage = vi.fn(async () => new Blob(['png']))
    const { pins } = setup(undefined, resizeImage)
    upload(fakeFile('enorme.png', 'image/png', 25 * IMAGE_MAX_BYTES))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('alert').textContent).toBe('Imagem grande demaisO arquivo tem 25 MB, e o máximo que dá para reduzir é 20 MB. Envie uma imagem menor.')
    expect(resizeImage).not.toHaveBeenCalled()
    expect(pins.getState().pins[0].type).toBe('cidade')
  })

  it('uma imagem que não abre é recusada, e o ícone anterior continua', async () => {
    const { pins } = setup(undefined, () => Promise.reject(new Error('corrompida')))
    await act(async () => upload(fakeFile('a.png', 'image/png', 10)))
    expect(screen.getByRole('alert').textContent).toBe('Não deu para ler esta imagem. Envie uma imagem PNG, JPG ou SVG.')
    expect(pins.getState().pins[0].type).toBe('cidade')
  })
})

describe('aba Detalhes: campos livres (AC-F3-10)', () => {
  it('mostra os campos do pin, adiciona um com a chave em edição e remove', () => {
    const { pins } = setup([pin('Valdora', { fields: { rei: 'Aldo' } })])
    expect((screen.getByRole('textbox', { name: 'Valor de rei' }) as HTMLInputElement).value).toBe('Aldo')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar campo' }))
    expect(pins.getState().pins[0].fields).toEqual({ rei: 'Aldo', Campo: '' })
    const keys = screen.getAllByRole('textbox', { name: /^Nome do campo \d+$/ }) as HTMLInputElement[]
    expect(keys.map((k) => k.value)).toEqual(['rei', 'Campo'])
    expect(document.activeElement).toBe(keys[1])
    // Cada chave tem o seu nome para o leitor de tela.
    expect(keys.map((k) => k.getAttribute('aria-label'))).toEqual(['Nome do campo 1', 'Nome do campo 2'])
    fireEvent.click(screen.getByRole('button', { name: 'Remover campo rei' }))
    expect(pins.getState().pins[0].fields).toEqual({ Campo: '' })
  })

  it('o valor muda a cada tecla; a chave, ao sair, e vazia ou repetida volta a anterior', () => {
    const { pins } = setup([pin('Valdora', { fields: { rei: 'Aldo', povo: 'elfos' } })])
    fireEvent.change(screen.getByRole('textbox', { name: 'Valor de rei' }), { target: { value: 'Aldo II' } })
    expect(pins.getState().pins[0].fields).toEqual({ rei: 'Aldo II', povo: 'elfos' })

    const [key] = screen.getAllByRole('textbox', { name: /^Nome do campo \d+$/ }) as HTMLInputElement[]
    fireEvent.change(key, { target: { value: 'Governante' } })
    expect(pins.getState().pins[0].fields).toEqual({ rei: 'Aldo II', povo: 'elfos' })
    fireEvent.blur(key)
    expect(Object.entries(pins.getState().pins[0].fields)).toEqual([
      ['Governante', 'Aldo II'],
      ['povo', 'elfos'],
    ])

    for (const bad of ['POVO', '  ']) {
      fireEvent.change(key, { target: { value: bad } })
      fireEvent.blur(key)
      expect(key.value).toBe('Governante')
    }
    expect(Object.keys(pins.getState().pins[0].fields)).toEqual(['Governante', 'povo'])
  })
})
