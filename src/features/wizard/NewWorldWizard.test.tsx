import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import type { CreateMapRenderer } from '../../app/MapView'
import { DEFAULT_WORLD_PARAMS } from '../../core'
import { PRESETS } from '../../state/presets'
import { MAP_SIZE } from '../../state/sizes'
import { createWorldStore, type WorldGenerator } from '../../state/worldStore'
import type { GenerateRequest } from '../../workers/generatorApi'
import { THUMBNAIL_SEED_MS, type Thumbnails } from './thumbnails'

/** Gerador que guarda os pedidos e nunca responde: o teste olha o que foi pedido. */
function recordingWorld() {
  const requests: GenerateRequest[] = []
  const generator: WorldGenerator = {
    request: (req) => {
      requests.push(req)
      return new Promise(() => {})
    },
    latestVersion: () => requests.length,
  }
  return { world: createWorldStore(generator), requests }
}
const noRenderer: CreateMapRenderer = async () => ({ refit() {}, destroy() {} })

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

describe('Assistente de novo mundo (AC-F1-19)', () => {
  it('abre sobre o editor, com o mundo padrão por trás e o foco no nome', () => {
    const { world } = recordingWorld()
    render(<App world={world} createRenderer={noRenderer} newWorld />)
    expect(dialog()).toBeTruthy()
    expect(screen.getByText('Dê um nome e escolha um ponto de partida. Tudo pode ser ajustado depois no editor.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('Nome do mundo'))
    expect(screen.getByTestId('world-name').textContent).toBe('Terras de Valdora')
    // Os 4 presets, com o Continente temperado marcado; a seed começa sorteada.
    const cards = PRESETS.map((p) => within(dialog()).getByRole('button', { name: new RegExp(p.name) }))
    expect(cards.map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false'])
    expect(seedInput().value).toMatch(/^[a-z]+-[0-9a-f]{4}$/)
    expect(screen.getByText('A mesma seed sempre gera o mesmo mapa.')).toBeTruthy()
  })

  it('sem newWorld, o editor abre sem o assistente', () => {
    const { world } = recordingWorld()
    render(<App world={world} createRenderer={noRenderer} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('cria o mundo com o nome, o preset e a seed escolhidos, gera o mapa final e fecha', () => {
    const { world, requests } = recordingWorld()
    render(<App world={world} createRenderer={noRenderer} newWorld />)
    expect(createButton()).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: '  Ilhas do Corvo ' } })
    fireEvent.click(within(dialog()).getByRole('button', { name: /Arquipélago/ }))
    fireEvent.change(seedInput(), { target: { value: ' corvo-1a2b ' } })
    fireEvent.click(createButton())

    expect(screen.queryByRole('dialog')).toBeNull()
    const s = world.getState()
    expect([s.name, s.seed, s.params]).toEqual(['Ilhas do Corvo', 'corvo-1a2b', PRESETS[1].params])
    expect(requests.at(-1)).toEqual({ seed: 'corvo-1a2b', size: MAP_SIZE, params: PRESETS[1].params })
    expect(screen.getByTestId('world-name').textContent).toBe('Ilhas do Corvo')
    // A sidebar mostra a seed do mundo novo.
    expect((screen.getByRole('textbox', { name: 'Seed' }) as HTMLInputElement).value).toBe('corvo-1a2b')
  })

  it('Enter no nome cria o mundo; sem nome (só espaços), não', () => {
    const { world } = recordingWorld()
    render(<App world={world} createRenderer={noRenderer} newWorld />)
    const name = screen.getByLabelText('Nome do mundo')
    fireEvent.change(name, { target: { value: '   ' } })
    expect(createButton()).toHaveProperty('disabled', true)
    fireEvent.submit(name.closest('form')!)
    expect(dialog()).toBeTruthy()
    fireEvent.change(name, { target: { value: 'Brumas' } })
    fireEvent.submit(name.closest('form')!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(world.getState().name).toBe('Brumas')
  })

  it('com a seed vazia, vale a sorteada ao abrir', () => {
    const { world } = recordingWorld()
    render(<App world={world} createRenderer={noRenderer} newWorld />)
    const rolled = seedInput().value
    fireEvent.change(seedInput(), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: 'Geada' } })
    fireEvent.click(createButton())
    expect(world.getState().seed).toBe(rolled)
  })

  it('sortear troca a seed do campo', () => {
    const { world } = recordingWorld()
    render(<App world={world} createRenderer={noRenderer} newWorld />)
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Seed aleatória' }))
    random.mockRestore()
    expect(seedInput().value).toBe('valdora-0000')
  })

  it('Avançado recolhe e abre a seed', () => {
    const { world } = recordingWorld()
    render(<App world={world} createRenderer={noRenderer} newWorld />)
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
  ])('%s fecha e mantém o mundo padrão', (_, close) => {
    const { world, requests } = recordingWorld()
    render(<App world={world} createRenderer={noRenderer} newWorld />)
    fireEvent.change(screen.getByLabelText('Nome do mundo'), { target: { value: 'Não vale' } })
    close()
    expect(screen.queryByRole('dialog')).toBeNull()
    const s = world.getState()
    expect([s.name, s.seed, s.params]).toEqual(['Terras de Valdora', 'rpg-world', DEFAULT_WORLD_PARAMS])
    expect(requests).toEqual([])
  })

  it('pede as miniaturas dos 4 presets com a seed do campo, e de novo depois da pausa ao trocá-la', async () => {
    vi.useFakeTimers()
    const asked: { seed: string; preset: number }[] = []
    const dispose = vi.fn()
    const thumbnails: Thumbnails = {
      async render(seed, params) {
        asked.push({ seed, preset: PRESETS.findIndex((p) => p.params === params) })
        return new Uint8ClampedArray(4)
      },
      dispose,
    }
    const create = () => thumbnails
    const { world } = recordingWorld()
    render(<App world={world} createRenderer={noRenderer} newWorld createThumbnails={create} />)
    const rolled = seedInput().value
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(asked).toEqual([0, 1, 2, 3].map((preset) => ({ seed: rolled, preset })))
    expect(document.querySelectorAll('canvas[data-ready="true"]')).toHaveLength(4)

    asked.length = 0
    fireEvent.change(seedInput(), { target: { value: 'geada-0001' } })
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_SEED_MS - 1))
    expect(asked).toEqual([])
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(asked.map((a) => a.seed)).toEqual(Array(4).fill('geada-0001'))

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }))
    expect(dispose).toHaveBeenCalled()
  })
})
