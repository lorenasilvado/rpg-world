import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_PARAMS, GENERATOR_VERSION } from '../core'
import type { Thumbnails } from '../features/wizard/thumbnails'
import type { MapImageSource } from '../features/worlds/exportImage'
import type { World } from '../persistence/types'
import type { MapImageOptions } from '../render/mapImage'
import type { WorldGenerator } from '../state/worldStore'
import { memoryRepo } from '../test/memoryRepo'
import type { GenerateRequest } from '../workers/generatorApi'
import type { CreateMapRenderer } from './MapView'
import { WorldsApp } from './WorldsApp'

const NOW = new Date('2026-11-21T12:00:00.000Z')
const noRenderer: CreateMapRenderer = async () => ({ refit() {}, destroy() {} })

function recordingGenerator() {
  const requests: GenerateRequest[] = []
  const generator: WorldGenerator = {
    request: (req) => {
      requests.push(req)
      return new Promise(() => {})
    },
    latestVersion: () => requests.length,
  }
  return { generator, requests }
}

function world(over: Partial<World>): World {
  return {
    id: 'w',
    name: 'Mundo',
    seed: 's',
    generatorVersion: GENERATOR_VERSION,
    sizeKm: 800,
    params: { ...DEFAULT_WORLD_PARAMS },
    pins: [],
    roads: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: NOW.toISOString(),
    ...over,
  }
}

const pin = (id: string): World['pins'][number] => ({
  id,
  type: 'Cidade',
  name: id,
  pos: { u: 0.5, v: 0.5 },
  icon: { kind: 'builtin', key: 'castle' },
  description: '',
  tags: [],
  fields: {},
})

const VALDORA = world({
  id: 'valdora',
  name: 'Terras de Valdora',
  seed: 'valdora-7f3a',
  params: { ...DEFAULT_WORLD_PARAMS, ocean: 60 },
  pins: [pin('a'), pin('b')],
  updatedAt: '2026-11-21T10:00:00.000Z',
})
const SOMBRIO = world({ id: 'sombrio', name: 'Vale Sombrio', seed: 'sombrio', updatedAt: '2026-10-20T12:00:00.000Z' })

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete document.documentElement.dataset.theme
})

function setup(worlds: World[], props: Partial<Parameters<typeof WorldsApp>[0]> = {}) {
  const repo = memoryRepo(worlds)
  const { generator, requests } = recordingGenerator()
  render(<WorldsApp repo={repo} generator={generator} createRenderer={noRenderer} now={() => NOW} {...props} />)
  return { repo, requests }
}
const settle = () => act(() => Promise.resolve())

describe('Lista de mundos (AC-F4-04)', () => {
  it('é a tela inicial: cartões esqueleto enquanto carrega, depois "Seus mundos" com a contagem e um cartão por mundo', async () => {
    setup([SOMBRIO, VALDORA])
    expect(screen.getByRole('heading', { name: 'Seus mundos' })).toBeTruthy()
    expect(screen.getByTestId('world-list').dataset.state).toBe('loading')
    expect(screen.getAllByTestId('world-card-skeleton')).toHaveLength(4)
    expect(screen.queryByTestId('editor')).toBeNull()

    await settle()
    expect(screen.queryAllByTestId('world-card-skeleton')).toHaveLength(0)
    expect(screen.getByTestId('world-count').textContent).toBe('2 mundos')
    const cards = screen.getAllByTestId('world-card')
    // Do editado por último ao mais antigo.
    expect(cards.map((c) => within(c).getByTestId('world-card-name').textContent)).toEqual(['Terras de Valdora', 'Vale Sombrio'])
    expect(cards.map((c) => within(c).getByTestId('world-card-caption').textContent)).toEqual([
      'Editado há 2 h · 2 pins',
      'Editado há 1 mês · sem pins',
    ])
    // O "⋯" abre o menu (AC-F4-07); Importar abre o seletor de arquivos (AC-F4-09).
    expect(within(cards[0]).getByRole('button', { name: 'Mais ações de Terras de Valdora' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Importar' })).toHaveProperty('disabled', false)
  })

  it('a contagem fica no singular com um mundo', async () => {
    setup([VALDORA])
    await settle()
    expect(screen.getByTestId('world-count').textContent).toBe('1 mundo')
  })

  it('pede a miniatura de cada mundo com a seed e os parâmetros dele, em ordem, e encerra o worker ao sair', async () => {
    const asked: { seed: string; ocean: number; size?: number }[] = []
    const dispose = vi.fn()
    const thumbnails: Thumbnails = {
      async render(seed, params, size) {
        asked.push({ seed, ocean: params.ocean, size })
        return new Uint8ClampedArray(4)
      },
      dispose,
    }
    setup([VALDORA, SOMBRIO], { createThumbnails: () => thumbnails })
    await settle()
    await settle()
    await settle()
    expect(asked).toEqual([
      { seed: 'valdora-7f3a', ocean: 60, size: 256 },
      { seed: 'sombrio', ocean: DEFAULT_WORLD_PARAMS.ocean, size: 256 },
    ])
    expect(screen.getByTestId('world-list').querySelectorAll('canvas[data-ready="true"]')).toHaveLength(2)
    const before = dispose.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: /^Vale Sombrio/ }))
    expect(dispose.mock.calls.length).toBeGreaterThan(before)
  })

  it('o tema escolhido na lista continua no editor', async () => {
    setup([VALDORA])
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: /^Terras de Valdora/ }))
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeTruthy()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('Lista vazia (AC-F4-05)', () => {
  it('mostra "Nenhum mundo ainda", "Criar meu primeiro mundo" e o link de importar, sem contagem', async () => {
    setup([])
    await settle()
    expect(screen.getByTestId('world-list').dataset.state).toBe('empty')
    expect(screen.getByRole('heading', { name: 'Nenhum mundo ainda' })).toBeTruthy()
    expect(screen.getByText('Gere um continente em poucos segundos e comece a marcar cidades, NPCs e locais.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'importe um arquivo .json' })).toBeTruthy()
    expect(screen.queryByTestId('world-count')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Criar meu primeiro mundo' }))
    expect(screen.getByRole('dialog', { name: 'Novo mundo' })).toBeTruthy()
  })

  it('se o banco não abre, a lista fica vazia', async () => {
    const { generator } = recordingGenerator()
    const repo = { ...memoryRepo(), list: () => Promise.reject(new Error('bloqueado')) }
    render(<WorldsApp repo={repo} generator={generator} createRenderer={noRenderer} />)
    await settle()
    expect(screen.getByText('Nenhum mundo ainda')).toBeTruthy()
  })
})

describe('Abrir e voltar (AC-F4-06)', () => {
  it('clicar num cartão abre o mundo no editor e gera o mapa dele', async () => {
    const { requests } = setup([VALDORA, SOMBRIO])
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^Terras de Valdora/ }))
    expect(screen.getByTestId('editor')).toBeTruthy()
    expect(screen.getByTestId('world-name').textContent).toBe('Terras de Valdora')
    expect((screen.getByRole('textbox', { name: 'Seed' }) as HTMLInputElement).value).toBe('valdora-7f3a')
    expect(requests.at(-1)).toMatchObject({ seed: 'valdora-7f3a', params: VALDORA.params })
  })

  it('abrir o mundo apaga do banco as imagens que nenhum pin dele usa (AC-F3-11)', async () => {
    const pin = { id: 'p', type: 'custom', name: 'Selo', pos: { u: 0.5, v: 0.5 }, icon: { kind: 'image' as const, blobId: 'usada' }, description: '', tags: [], fields: {} }
    const { repo } = setup([{ ...VALDORA, pins: [pin] }, SOMBRIO])
    for (const [id, worldId] of [
      ['usada', VALDORA.id],
      ['trocada', VALDORA.id],
      ['do-outro', SOMBRIO.id],
    ]) repo.images.set(id, { id, worldId, blob: new Blob([id]) })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^Terras de Valdora/ }))
    await settle()
    expect([...repo.images.keys()].sort()).toEqual(['do-outro', 'usada'])
  })

  it('o editor volta à lista pelo cabeçalho da sidebar, com a mudança já salva', async () => {
    const { repo } = setup([VALDORA, SOMBRIO])
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^Vale Sombrio/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Seed' }), { target: { value: 'sombrio-2' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Seed' }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à lista de mundos' }))
    await settle()
    await settle()
    expect(screen.queryByTestId('editor')).toBeNull()
    expect(repo.worlds.get('sombrio')?.seed).toBe('sombrio-2')
    // O mundo editado sobe para o topo, editado agora, e os pins do outro continuam.
    const cards = screen.getAllByTestId('world-card')
    expect(cards.map((c) => within(c).getByTestId('world-card-caption').textContent)).toEqual([
      'Editado agora · sem pins',
      'Editado há 2 h · 2 pins',
    ])
    expect(repo.worlds.get('valdora')?.pins).toHaveLength(2)
  })

  it('"Novo mundo" cria, salva e abre; voltar mostra o mundo novo na lista', async () => {
    setup([VALDORA], { newId: () => 'novo' })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Novo mundo' }))
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: 'Brumas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar mundo' }))
    expect(screen.getByTestId('world-name').textContent).toBe('Brumas')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à lista de mundos' }))
    await settle()
    await settle()
    expect(screen.getByTestId('world-count').textContent).toBe('2 mundos')
    expect(screen.getAllByTestId('world-card-name').map((n) => n.textContent)).toEqual(['Brumas', 'Terras de Valdora'])
  })
})

describe('Menu "⋯" do cartão (AC-F4-07)', () => {
  const card = (name: string) => screen.getAllByTestId('world-card').find((c) => within(c).getByTestId('world-card-name').textContent === name)!
  const names = () => screen.getAllByTestId('world-card-name').map((n) => n.textContent)
  const openMenu = (name: string) => {
    fireEvent.click(within(card(name)).getByRole('button', { name: `Mais ações de ${name}` }))
    return screen.getByRole('menu', { name: `Ações de ${name}` })
  }

  it('abre com Renomear, Duplicar, Exportar e Excluir; o cartão ganha o contorno; Esc fecha', async () => {
    setup([VALDORA, SOMBRIO])
    await settle()
    const menu = openMenu('Vale Sombrio')
    expect(within(menu).getAllByRole('menuitem').map((i) => [i.textContent, (i as HTMLButtonElement).disabled])).toEqual([
      ['Renomear', false],
      ['Duplicar', false],
      ['Exportar', false],
      ['Excluir', false],
    ])
    expect(within(menu).getByRole('separator')).toBeTruthy()
    expect(card('Vale Sombrio').dataset.menuOpen).toBe('true')
    expect(card('Terras de Valdora').dataset.menuOpen).toBe('false')
    expect(document.activeElement?.textContent).toBe('Renomear')

    // Setas andam pelos itens e dão a volta; Home e End vão às pontas.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Exportar')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Excluir')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Renomear')
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement?.textContent).toBe('Excluir')

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(card('Vale Sombrio').dataset.menuOpen).toBe('false')
    expect(document.activeElement).toBe(within(card('Vale Sombrio')).getByRole('button', { name: 'Mais ações de Vale Sombrio' }))
  })

  it('só um menu aberto por vez, e um clique fora fecha', async () => {
    setup([VALDORA, SOMBRIO])
    await settle()
    openMenu('Vale Sombrio')
    openMenu('Terras de Valdora')
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Duplicar com falha mostra o toast; "Tentar de novo" duplica e o toast some', async () => {
    const { repo } = setup([VALDORA], { newId: () => 'copia' })
    await settle()
    const duplicate = repo.duplicate
    repo.duplicate = () => Promise.reject(new Error('cota'))
    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Duplicar' }))
    await settle()
    const toast = screen.getByTestId('duplicate-error-toast')
    expect(toast.getAttribute('role')).toBe('alert')
    expect(toast.textContent).toContain('Não foi possível duplicar o mundo')
    expect(names()).toEqual(['Terras de Valdora'])

    repo.duplicate = duplicate
    fireEvent.click(within(toast).getByRole('button', { name: 'Tentar de novo' }))
    await settle()
    await settle()
    expect(screen.queryByTestId('duplicate-error-toast')).toBeNull()
    expect(names()).toEqual(['Terras de Valdora (cópia)', 'Terras de Valdora'])
  })

  it('o toast de falha ao duplicar fecha pelo X', async () => {
    const { repo } = setup([VALDORA])
    await settle()
    repo.duplicate = () => Promise.reject(new Error('cota'))
    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Duplicar' }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(screen.queryByTestId('duplicate-error-toast')).toBeNull()
  })

  it('enquanto grava ou exclui, Esc não fecha o modal e Cancelar fica desabilitado; a falha aparece nele', async () => {
    const { repo } = setup([VALDORA])
    await settle()
    let fail: (e: Error) => void = () => {}
    repo.rename = () => new Promise((_, reject) => (fail = reject))
    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Renomear' }))
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: 'Outro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', true)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Renomear mundo' })).toBeTruthy()
    await act(async () => fail(new Error('cota')))
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível renomear o mundo. Tente de novo.')
    // Com a gravação terminada, Esc volta a fechar.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    repo.remove = () => new Promise((_, reject) => (fail = reject))
    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Excluir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir mundo' }))
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', true)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Excluir “Terras de Valdora”?' })).toBeTruthy()
    await act(async () => fail(new Error('falha')))
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível excluir o mundo. Tente de novo.')
  })

  it('as miniaturas são guardadas pelo terreno: renomear não refaz, e a cópia usa a do original', async () => {
    const asked: string[] = []
    const thumbnails: Thumbnails = {
      async render(seed) {
        asked.push(seed)
        return new Uint8ClampedArray(4)
      },
      dispose() {},
    }
    setup([VALDORA, SOMBRIO], { createThumbnails: () => thumbnails, newId: () => 'copia' })
    for (let i = 0; i < 3; i++) await settle()
    expect(asked).toEqual(['valdora-7f3a', 'sombrio'])

    fireEvent.click(within(openMenu('Vale Sombrio')).getByRole('menuitem', { name: 'Renomear' }))
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: 'Vale das Brumas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))
    for (let i = 0; i < 3; i++) await settle()
    expect(names()).toEqual(['Vale das Brumas', 'Terras de Valdora'])

    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Duplicar' }))
    for (let i = 0; i < 3; i++) await settle()
    // O relógio do teste é fixo: a cópia e o renomeado têm o mesmo `updatedAt`.
    expect(names().sort()).toEqual(['Terras de Valdora', 'Terras de Valdora (cópia)', 'Vale das Brumas'])
    expect(asked).toEqual(['valdora-7f3a', 'sombrio'])
    expect(card('Terras de Valdora (cópia)').querySelector('canvas')?.dataset.ready).toBe('true')
    expect(screen.getByTestId('world-list').querySelectorAll('canvas[data-ready="true"]')).toHaveLength(3)
  })

  it('Renomear grava o nome novo, sem os espaços das pontas, e o mundo sobe para o topo', async () => {
    const { repo } = setup([VALDORA, SOMBRIO])
    await settle()
    fireEvent.click(within(openMenu('Vale Sombrio')).getByRole('menuitem', { name: 'Renomear' }))
    const dialog = screen.getByRole('dialog', { name: 'Renomear mundo' })
    const input = within(dialog).getByLabelText('Nome do mundo') as HTMLInputElement
    expect(input.value).toBe('Vale Sombrio')
    fireEvent.change(input, { target: { value: '   ' } })
    expect(within(dialog).getByRole('button', { name: 'Renomear' })).toHaveProperty('disabled', true)
    fireEvent.change(input, { target: { value: '  Vale das Brumas ' } })
    fireEvent.submit(input.form!)
    await settle()
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(repo.worlds.get('sombrio')).toMatchObject({ name: 'Vale das Brumas', seed: 'sombrio', updatedAt: NOW.toISOString() })
    expect(names()).toEqual(['Vale das Brumas', 'Terras de Valdora'])
    // O foco volta ao "⋯" do cartão.
    expect(document.activeElement).toBe(within(card('Vale das Brumas')).getByRole('button', { name: 'Mais ações de Vale das Brumas' }))
  })

  it('Renomear: Cancelar não muda nada; se a gravação falha, o modal continua com o aviso', async () => {
    const { repo } = setup([VALDORA])
    await settle()
    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Renomear' }))
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: 'Outro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(repo.worlds.get('valdora')?.name).toBe('Terras de Valdora')

    repo.rename = () => Promise.reject(new Error('cota'))
    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Renomear' }))
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: 'Outro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))
    await settle()
    expect(screen.getByRole('dialog', { name: 'Renomear mundo' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível renomear o mundo. Tente de novo.')
  })

  it('Duplicar cria "<nome> (cópia)" com os pins, no topo, e a contagem sobe', async () => {
    const { repo } = setup([VALDORA, SOMBRIO], { newId: () => 'copia' })
    await settle()
    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Duplicar' }))
    await settle()
    await settle()
    expect(screen.getByTestId('world-count').textContent).toBe('3 mundos')
    expect(names()).toEqual(['Terras de Valdora (cópia)', 'Terras de Valdora', 'Vale Sombrio'])
    expect(repo.worlds.get('copia')).toMatchObject({ seed: 'valdora-7f3a', params: VALDORA.params, pins: VALDORA.pins })
    expect(within(card('Terras de Valdora (cópia)')).getByTestId('world-card-caption').textContent).toBe('Editado agora · 2 pins')
  })

  it('Excluir pede confirmação: Cancelar mantém o mundo; "Excluir mundo" o tira da lista', async () => {
    const { repo } = setup([VALDORA, SOMBRIO])
    await settle()
    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Excluir' }))
    let dialog = screen.getByRole('dialog', { name: 'Excluir “Terras de Valdora”?' })
    expect(dialog.textContent).toContain('O mundo e os 2 pins dele serão excluídos deste navegador. Isso não pode ser desfeito.')
    expect(document.activeElement?.textContent).toBe('Cancelar')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(repo.worlds.has('valdora')).toBe(true)

    fireEvent.click(within(openMenu('Terras de Valdora')).getByRole('menuitem', { name: 'Excluir' }))
    dialog = screen.getByRole('dialog', { name: 'Excluir “Terras de Valdora”?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir mundo' }))
    await settle()
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(repo.worlds.has('valdora')).toBe(false)
    expect(names()).toEqual(['Vale Sombrio'])
    expect(screen.getByTestId('world-count').textContent).toBe('1 mundo')
    // O cartão saiu: o foco vai ao "Novo mundo".
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Novo mundo' }))
  })

  it('excluir o último mundo mostra a lista vazia', async () => {
    setup([SOMBRIO])
    await settle()
    fireEvent.click(within(openMenu('Vale Sombrio')).getByRole('menuitem', { name: 'Excluir' }))
    expect(screen.getByRole('dialog').textContent).toContain('O mundo será excluído deste navegador. Isso não pode ser desfeito.')
    fireEvent.click(screen.getByRole('button', { name: 'Excluir mundo' }))
    await settle()
    await settle()
    expect(screen.getByText('Nenhum mundo ainda')).toBeTruthy()
  })
})

describe('Voltar com "Erro ao salvar" (AC-F4-02, AC-F4-06)', () => {
  /** Abre o Vale Sombrio com o banco falhando, muda a seed e tenta voltar à lista. */
  async function backWithSaveError() {
    const repo = memoryRepo([VALDORA, SOMBRIO])
    const save = repo.save
    const failing = { fail: true }
    repo.save = (w) => (failing.fail ? Promise.reject(new Error('cota')) : save(w))
    const { generator } = recordingGenerator()
    render(<WorldsApp repo={repo} generator={generator} createRenderer={noRenderer} now={() => NOW} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^Vale Sombrio/ }))
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    fireEvent.change(seed, { target: { value: 'sombrio-2' } })
    fireEvent.keyDown(seed, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à lista de mundos' }))
    await settle()
    await settle()
    return { repo, failing }
  }
  const dialog = () => screen.getByRole('dialog', { name: 'Mudanças não salvas' })

  it('não fecha o mundo: pergunta antes, e "Ficar no mundo" mantém o editor', async () => {
    await backWithSaveError()
    expect(dialog()).toBeTruthy()
    expect(screen.getByTestId('editor')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Ficar no mundo' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByRole('textbox', { name: 'Seed' }) as HTMLInputElement).value).toBe('sombrio-2')
  })

  it('"Tentar de novo" grava e volta à lista se der certo; se falhar de novo, o modal continua', async () => {
    const { repo, failing } = await backWithSaveError()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Tentar de novo' }))
    await settle()
    await settle()
    expect(dialog()).toBeTruthy()
    expect(screen.getByTestId('editor')).toBeTruthy()

    failing.fail = false
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Tentar de novo' }))
    await settle()
    await settle()
    await settle()
    expect(screen.queryByTestId('editor')).toBeNull()
    expect(repo.worlds.get('sombrio')?.seed).toBe('sombrio-2')
  })

  it('"Voltar sem salvar" volta à lista, e o mundo fica como estava no banco', async () => {
    const { repo } = await backWithSaveError()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Voltar sem salvar' }))
    await settle()
    expect(screen.queryByTestId('editor')).toBeNull()
    expect(repo.worlds.get('sombrio')?.seed).toBe('sombrio')
  })
})

describe('Exportar e importar o mundo em JSON (AC-F4-09, AC-F4-10)', () => {
  const names = () => screen.getAllByTestId('world-card-name').map((n) => n.textContent)
  const card = (name: string) => screen.getAllByTestId('world-card').find((c) => within(c).getByTestId('world-card-name').textContent === name)!
  const input = () => screen.getByTestId('import-input') as HTMLInputElement
  const flush = async () => {
    for (let i = 0; i < 4; i++) await settle()
  }
  const choose = async (file: File) => {
    fireEvent.change(input(), { target: { files: [file] } })
    await flush()
  }
  const drop = async (target: Element, file: File) => {
    fireEvent.drop(target, { dataTransfer: { types: ['Files'], files: [file] } })
    await flush()
  }
  const jsonFile = (text: string, name = 'mundo.json') => new File([text], name, { type: 'application/json' })
  const dialog = () => screen.getByRole('dialog', { name: 'Importar mundo' })
  const TORRE: World['pins'][number] = { ...pin('torre'), type: 'custom', icon: { kind: 'image', blobId: 'img-1' } }
  const COM_IMAGEM = { ...VALDORA, pins: [pin('a'), TORRE] }
  const exportFromMenu = async (name: string) => {
    fireEvent.click(within(card(name)).getByRole('button', { name: `Mais ações de ${name}` }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar' }))
    await flush()
  }

  /** A lista com a Valdora (e a imagem do pin dela) e o Vale Sombrio, com os downloads guardados. */
  async function withExport(props: Partial<Parameters<typeof WorldsApp>[0]> = {}) {
    const downloads: { name: string; text: Promise<string> }[] = []
    const download = (blob: Blob, name: string) => void downloads.push({ name, text: blob.text() })
    const ids = ['importado', 'img-novo']
    const out = setup([COM_IMAGEM, SOMBRIO], { download, newId: () => ids.shift() ?? 'extra', ...props })
    await out.repo.saveImage({ id: 'img-1', worldId: VALDORA.id, blob: new Blob(['png'], { type: 'image/png' }) })
    await settle()
    return { ...out, downloads }
  }

  it('Exportar no menu "⋯" baixa o arquivo do mundo, com a imagem do pin; importá-lo cria um mundo igual, no topo', async () => {
    const { repo, downloads } = await withExport()
    await exportFromMenu('Terras de Valdora')
    expect(downloads.map((d) => d.name)).toEqual(['terras-de-valdora.json'])
    const text = await downloads[0].text
    expect(JSON.parse(text).images).toEqual([{ id: 'img-1', type: 'image/png', data: btoa('png') }])

    await choose(jsonFile(text, 'terras-de-valdora.json'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(names()).toEqual(['Terras de Valdora', 'Terras de Valdora', 'Vale Sombrio'])
    expect(repo.worlds.get('importado')).toEqual({
      ...COM_IMAGEM,
      id: 'importado',
      pins: [pin('a'), { ...TORRE, icon: { kind: 'image', blobId: 'img-novo' } }],
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })
    const image = repo.images.get('img-novo')!
    expect(image.worldId).toBe('importado')
    expect(await image.blob.text()).toBe('png')
  })

  it('um arquivo inválido abre o modal com o motivo; outro arquivo é escolhido sem fechar, e o válido fecha o modal', async () => {
    const { downloads } = await withExport()
    await exportFromMenu('Vale Sombrio')
    const valid = await downloads[0].text
    const noSeed = JSON.parse(valid)
    delete noSeed.world.seed

    await choose(jsonFile(JSON.stringify(noSeed), 'reino-antigo.json'))
    expect(within(dialog()).getByTestId('import-file-name').textContent).toBe('reino-antigo.json')
    expect(within(dialog()).getByText('Não aceito')).toBeTruthy()
    expect(within(dialog()).getByRole('alert').textContent).toContain('Este arquivo não é um mundo válido')
    expect(within(dialog()).getByTestId('import-reason').textContent).toBe(
      'Falta a parte do terreno. Abra o mundo de origem, use Exportar › Arquivo do mundo (.json) e tente de novo.',
    )
    expect(document.activeElement).toBe(within(dialog()).getByRole('button', { name: 'Escolher outro arquivo' }))

    // "Escolher outro arquivo" abre o seletor; um arquivo que não é JSON troca o motivo, sem fechar.
    const click = vi.spyOn(input(), 'click').mockImplementation(() => {})
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Escolher outro arquivo' }))
    expect(click).toHaveBeenCalledTimes(1)
    await choose(jsonFile('não é json', 'notas.txt'))
    expect(dialog().dataset.reason).toBe('not-json')
    expect(within(dialog()).getByTestId('import-file-name').textContent).toBe('notas.txt')

    await choose(jsonFile(valid, 'vale.json'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(names()).toEqual(['Vale Sombrio', 'Terras de Valdora', 'Vale Sombrio'])
  })

  it('soltar um arquivo na lista importa; soltar outro no modal troca o arquivo; Cancelar fecha e devolve o foco ao Importar', async () => {
    await withExport()
    await drop(screen.getByTestId('world-list'), jsonFile('{"format":"outro"}', 'outro.json'))
    expect(dialog().dataset.reason).toBe('not-world')
    const newer = {
      format: 'rpg-world-builder/world',
      version: 1,
      world: { seed: 's', params: DEFAULT_WORLD_PARAMS, generatorVersion: GENERATOR_VERSION + 1 },
    }
    await drop(dialog(), jsonFile(JSON.stringify(newer)))
    expect(dialog().dataset.reason).toBe('newer-version')
    expect(within(dialog()).getByTestId('import-reason').textContent).toContain('versão mais nova do gerador')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // O Radix devolve o foco depois de desmontar o modal, num timer.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Importar' }))
    expect(names()).toEqual(['Terras de Valdora', 'Vale Sombrio'])
  })

  it('se o banco não grava o mundo importado, o modal diz que não foi possível importar', async () => {
    const { repo, downloads } = await withExport()
    await exportFromMenu('Vale Sombrio')
    repo.importWorld = () => Promise.reject(new Error('cota'))
    await choose(jsonFile(await downloads[0].text))
    expect(dialog().dataset.reason).toBe('save-failed')
    expect(within(dialog()).getByRole('alert').textContent).toContain('Não foi possível importar o mundo')
  })

  it('se o arquivo não pode ser lido, o modal diz que não foi possível ler o arquivo', async () => {
    await withExport()
    const file = jsonFile('{}', 'sumiu.json')
    file.text = () => Promise.reject(new DOMException('não encontrado', 'NotFoundError'))
    await choose(file)
    expect(dialog().dataset.reason).toBe('unreadable')
    expect(within(dialog()).getByRole('alert').textContent).toContain('Não foi possível ler o arquivo')
    expect(within(dialog()).getByTestId('import-reason').textContent).toContain('Escolha o arquivo de novo.')
  })

  it('um arquivo solto enquanto outro é importado não se perde: entra logo depois', async () => {
    const { repo, downloads } = await withExport({ newId: (() => { let n = 0; return () => `id-${++n}` })() })
    await exportFromMenu('Vale Sombrio')
    const text = await downloads[0].text
    const importWorld = repo.importWorld
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    repo.importWorld = async (world, images) => {
      await gate
      return importWorld(world, images)
    }
    await drop(screen.getByTestId('world-list'), jsonFile(text, 'primeiro.json'))
    expect((screen.getByRole('button', { name: 'Importar' }) as HTMLButtonElement).disabled).toBe(true)
    // O segundo chega no meio do primeiro: é inválido, e o modal aparece depois.
    await drop(screen.getByTestId('world-list'), jsonFile('não é json', 'segundo.json'))
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => release())
    await flush()
    expect(names()).toEqual(['Vale Sombrio', 'Terras de Valdora', 'Vale Sombrio'])
    expect(dialog().dataset.reason).toBe('not-json')
    expect(within(dialog()).getByTestId('import-file-name').textContent).toBe('segundo.json')
    // Com o modal aberto, a lista fica escondida da árvore de acessibilidade.
    expect((screen.getByRole('button', { name: 'Importar', hidden: true }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('Exportar com falha mostra o toast "Não foi possível exportar o mundo"', async () => {
    await withExport({
      download: () => {
        throw new Error('bloqueado')
      },
    })
    await exportFromMenu('Vale Sombrio')
    expect(screen.getByTestId('export-error-toast').textContent).toContain('Não foi possível exportar o mundo')
  })

  it('na lista vazia, o link "importe um arquivo .json" abre o seletor', async () => {
    setup([])
    await settle()
    const click = vi.spyOn(input(), 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'importe um arquivo .json' }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('no editor, Exportar › Arquivo do mundo (.json) baixa o mundo como está na tela, com as imagens dos pins', async () => {
    const { downloads } = await withExport()
    fireEvent.click(screen.getByRole('button', { name: /^Terras de Valdora/ }))
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    fireEvent.change(seed, { target: { value: 'valdora-2' } })
    fireEvent.keyDown(seed, { key: 'Enter' })

    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    const menu = screen.getByRole('menu', { name: 'Exportar' })
    expect(within(menu).getAllByRole('menuitem').map((i) => [i.textContent, (i as HTMLButtonElement).disabled])).toEqual([
      ['Arquivo do mundo (.json)', false],
      ['Imagem (.png)', true],
    ])
    // Sem `renderImage` (os testes), o PNG fica desabilitado.
    expect(document.activeElement?.textContent).toBe('Arquivo do mundo (.json)')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Arquivo do mundo (.json)' }))
    await flush()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(downloads.map((d) => d.name)).toEqual(['terras-de-valdora.json'])
    const file = JSON.parse(await downloads[0].text)
    expect(file.world.seed).toBe('valdora-2')
    expect(file.world.pins).toEqual([pin('a'), TORRE])
    expect(file.images.map((i: { id: string }) => i.id)).toEqual(['img-1'])
  })

  it('no editor, Exportar › Imagem (.png) baixa o PNG do mapa aberto na escala escolhida (AC-F4-11)', async () => {
    const renderImage = vi.fn(async (_source: MapImageSource, _options: MapImageOptions) => new Blob(['png'], { type: 'image/png' }))
    const { downloads } = await withExport({ renderImage })
    fireEvent.click(screen.getByRole('button', { name: /^Terras de Valdora/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Imagem (.png)' }))
    const dialog = screen.getByRole('dialog', { name: 'Exportar imagem' })
    fireEvent.click(within(dialog).getByRole('radio', { name: /^2×/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Pins e rótulos' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Baixar PNG' }))
    await flush()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(renderImage).toHaveBeenCalledTimes(1)
    const [source, options] = renderImage.mock.calls[0]
    expect(options).toEqual({ scale: 2, pins: false })
    expect(source.world.getState().name).toBe('Terras de Valdora')
    expect(source.pins.getState().pins).toEqual([pin('a'), TORRE])
    expect(downloads.map((d) => d.name)).toEqual(['terras-de-valdora-2x.png'])
  })
})

describe('Sem WebGL2 (AC-F4-12)', () => {
  it('a lista funciona; abrir um mundo mostra o aviso no lugar do editor, sem gerar, e o aviso volta à lista', async () => {
    const { requests } = setup([VALDORA], { webgl2: false })
    await settle()
    expect(screen.getAllByTestId('world-card')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /^Terras de Valdora/ }))
    expect(screen.getByTestId('no-webgl2')).toBeTruthy()
    expect(screen.queryByTestId('editor')).toBeNull()
    expect(requests).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à lista' }))
    await settle()
    await settle()
    expect(screen.getAllByTestId('world-card')).toHaveLength(1)
  })
})
