import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateMapRenderer } from '../../app/MapView'
import { WorldsApp } from '../../app/WorldsApp'
import { PRESETS } from '../../state/presets'
import { MAP_SIZE } from '../../state/sizes'
import type { WorldGenerator } from '../../state/worldStore'
import { memoryRepo } from '../../test/memoryRepo'
import type { GenerateRequest } from '../../workers/generatorApi'
import { THUMBNAIL_SEED_MS, type CreateThumbnails, type Thumbnails } from './thumbnails'

/** Gerador que guarda os pedidos e nunca responde: o teste olha o que foi pedido. */
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
const noRenderer: CreateMapRenderer = async () => ({ refit() {}, destroy() {} })

/** Abre o app na lista vazia e o assistente por "Novo mundo". */
async function openWizard(createThumbnails?: CreateThumbnails) {
  const { generator, requests } = recordingGenerator()
  const repo = memoryRepo()
  render(<WorldsApp repo={repo} generator={generator} createRenderer={noRenderer} createThumbnails={createThumbnails} newId={() => 'novo'} />)
  await act(() => Promise.resolve())
  fireEvent.click(screen.getByRole('button', { name: 'Novo mundo' }))
  return { repo, requests }
}

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
})

const dialog = () => screen.getByRole('dialog', { name: 'Novo mundo' })
const createButton = () => within(dialog()).getByRole('button', { name: 'Criar mundo' })
const seedInput = () => within(dialog()).getByRole('textbox', { name: /^Seed/ }) as HTMLInputElement

describe('Assistente de novo mundo (AC-F1-19, AC-F4-06)', () => {
  it('abre sobre a Lista de mundos, com o foco no nome', async () => {
    await openWizard()
    expect(dialog()).toBeTruthy()
    expect(screen.getByText('Dê um nome e escolha um ponto de partida. Tudo pode ser ajustado depois no editor.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('Nome do mundo'))
    expect(screen.getByTestId('world-list')).toBeTruthy()
    // Os 4 presets, com o Continente temperado marcado; a seed começa sorteada.
    const cards = PRESETS.map((p) => within(dialog()).getByRole('button', { name: new RegExp(p.name) }))
    expect(cards.map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false'])
    expect(seedInput().value).toMatch(/^[a-z]+-[0-9a-f]{4}$/)
    expect(screen.getByText('A mesma seed sempre gera o mesmo mapa.')).toBeTruthy()
  })

  it('cria o mundo com o nome, o preset e a seed escolhidos, salva, gera o mapa final e o abre no editor', async () => {
    const { repo, requests } = await openWizard()
    expect(createButton()).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: '  Ilhas do Corvo ' } })
    fireEvent.click(within(dialog()).getByRole('button', { name: /Arquipélago/ }))
    fireEvent.change(seedInput(), { target: { value: ' corvo-1a2b ' } })
    fireEvent.click(createButton())
    await act(() => Promise.resolve())

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(requests).toEqual([{ seed: 'corvo-1a2b', size: MAP_SIZE, params: PRESETS[1].params }])
    expect(screen.getByTestId('world-name').textContent).toBe('Ilhas do Corvo')
    // A sidebar mostra a seed do mundo novo.
    expect((screen.getByRole('textbox', { name: 'Seed' }) as HTMLInputElement).value).toBe('corvo-1a2b')
    expect(repo.worlds.get('novo')).toMatchObject({ name: 'Ilhas do Corvo', seed: 'corvo-1a2b', params: PRESETS[1].params, pins: [] })
  })

  it('Enter no nome cria o mundo; sem nome (só espaços), não', async () => {
    await openWizard()
    const name = screen.getByLabelText('Nome do mundo')
    fireEvent.change(name, { target: { value: '   ' } })
    expect(createButton()).toHaveProperty('disabled', true)
    fireEvent.submit(name.closest('form')!)
    expect(dialog()).toBeTruthy()
    fireEvent.change(name, { target: { value: 'Brumas' } })
    fireEvent.submit(name.closest('form')!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('world-name').textContent).toBe('Brumas')
  })

  it('com a seed vazia, vale a sorteada ao abrir', async () => {
    const { requests } = await openWizard()
    const rolled = seedInput().value
    fireEvent.change(seedInput(), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: 'Geada' } })
    fireEvent.click(createButton())
    expect(requests.at(-1)?.seed).toBe(rolled)
  })

  it('sortear troca a seed do campo', async () => {
    await openWizard()
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Seed aleatória' }))
    random.mockRestore()
    expect(seedInput().value).toBe('valdora-0000')
  })

  it('Avançado recolhe e abre a seed', async () => {
    await openWizard()
    const toggle = within(dialog()).getByRole('button', { name: 'Avançado' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(within(dialog()).queryByRole('textbox', { name: /^Seed/ })).toBeNull()
    fireEvent.click(toggle)
    expect(seedInput()).toBeTruthy()
  })

  it.each([
    ['Cancelar', () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }))],
    ['o X', () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Fechar' }))],
    ['o Esc', () => fireEvent.keyDown(dialog(), { key: 'Escape' })],
  ])('%s fecha, volta à lista e não cria nada', async (_, close) => {
    const { repo, requests } = await openWizard()
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: 'Não vale' } })
    close()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Nenhum mundo ainda')).toBeTruthy()
    expect(repo.worlds.size).toBe(0)
    expect(requests).toEqual([])
  })

  it('pede as miniaturas dos 4 presets com a seed do campo, e de novo depois da pausa ao trocá-la', async () => {
    const asked: { seed: string; preset: number }[] = []
    const dispose = vi.fn()
    const thumbnails: Thumbnails = {
      async render(seed, params) {
        asked.push({ seed, preset: PRESETS.findIndex((p) => p.params === params) })
        return new Uint8ClampedArray(4)
      },
      dispose,
    }
    await openWizard(() => thumbnails)
    vi.useFakeTimers()
    const rolled = seedInput().value
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(asked).toEqual([0, 1, 2, 3].map((preset) => ({ seed: rolled, preset })))
    expect(dialog().querySelectorAll('canvas[data-ready="true"]')).toHaveLength(4)

    asked.length = 0
    fireEvent.change(seedInput(), { target: { value: 'geada-0001' } })
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_SEED_MS - 1))
    expect(asked).toEqual([])
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(asked.map((a) => a.seed)).toEqual(Array(4).fill('geada-0001'))

    const before = dispose.mock.calls.length
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }))
    expect(dispose.mock.calls.length).toBeGreaterThan(before)
  })
})
