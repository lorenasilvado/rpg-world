import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_PARAMS, GENERATOR_VERSION } from '../core'
import type { Thumbnails } from '../features/wizard/thumbnails'
import type { World } from '../persistence/types'
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
    // O "⋯" e Importar ficam desabilitados até o menu e a importação existirem.
    expect(within(cards[0]).getByRole('button', { name: 'Mais ações de Terras de Valdora' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Importar' })).toHaveProperty('disabled', true)
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
    const repo = { list: () => Promise.reject(new Error('bloqueado')), save: () => Promise.resolve() }
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
