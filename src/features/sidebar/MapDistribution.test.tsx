import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import type { CreateMapRenderer } from '../../app/MapView'
import { BIOME, DEFAULT_WORLD_PARAMS, generateField, type CoreField } from '../../core'
import { MAP_SIZE, PREVIEW_SIZE } from '../../state/sizes'
import { createWorldStore } from '../../state/worldStore'
import type { GenerateRequest, GenerateResult } from '../../workers/generatorApi'
import { createNewerOnly } from '../../workers/newerOnly'

/** Gerador falso: cada pedido fica parado até o teste entregar um campo com os biomas pedidos. */
function fakeGenerator() {
  const started: { req: GenerateRequest; finish: (biome: Uint8Array) => void }[] = []
  const gen = createNewerOnly(
    (req: GenerateRequest) =>
      new Promise<GenerateResult>((resolve) => {
        started.push({
          req,
          finish: (biome) => {
            const field: CoreField = { ...generateField(req.seed, 8), width: req.size, biome }
            resolve({
              seed: req.seed,
              size: req.size,
              params: req.params ?? DEFAULT_WORLD_PARAMS,
              field,
              terrainRgba: new Uint8ClampedArray(0),
              workerMs: 0,
              terrainMs: 0,
              recomputed: 'classification',
              memory: { cacheBytes: 0, fieldBytes: 0 },
            })
          },
        })
      }),
  )
  return { gen, started }
}
const noRenderer: CreateMapRenderer = async () => ({ refit() {}, destroy() {} })

/**
 * 1000 células: `ocean`% de oceano e o resto de deserto, com 10 de neve (1%, fora da legenda) e 1
 * de campo gelado (0,1%, que aparece como "<1%").
 */
function biomes(ocean: number) {
  const b = new Uint8Array(1000).fill(BIOME.desert)
  b.fill(BIOME.deepOcean, 0, ocean * 10)
  b.fill(BIOME.snow, 989, 999)
  b[999] = BIOME.frozenField
  return b
}

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
})
afterEach(cleanup)

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('Distribuição do mapa e Gerando (AC-F1-18)', () => {
  it('mostra a porcentagem real de cada bioma do mapa exibido, e "Gerando" com o mapa borrado durante a geração', async () => {
    const { gen, started } = fakeGenerator()
    const world = createWorldStore(gen)
    render(<App world={world} createRenderer={noRenderer} />)
    const bar = screen.getByTestId('map-distribution')
    const map = screen.getByRole('main', { name: 'Mapa' })

    // A região de status existe antes de gerar, vazia: o leitor de tela anuncia o texto que entra nela.
    const status = within(bar).getByRole('status')
    expect(status.textContent).toBe('')
    act(() => world.getState().generate())
    expect(within(bar).getByRole('status')).toBe(status)
    expect(status.textContent).toBe('Gerando')
    expect(map.dataset.blurred).toBe('true')

    started[0].finish(biomes(45))
    await flush()
    expect(within(bar).getByRole('status').textContent).toBe('')
    expect(map.dataset.blurred).toBe('false')
    expect(within(bar).getByRole('img').getAttribute('aria-label')).toBe(
      'Distribuição do mapa: Oceano 45%, Deserto 54%, Neve 1%, Campo gelado <1%',
    )
    const legend = screen.getByTestId('distribution-legend')
    expect(legend.textContent).toContain('Oceano 45%')
    expect(legend.textContent).toContain('Deserto 54%')
    // Neve tem 1%: fica na barra (com o título), fora da legenda.
    expect(legend.textContent).not.toContain('Neve')
    expect(bar.querySelector('[data-biome="snow"]')?.getAttribute('title')).toBe('Neve 1%')
    expect(bar.querySelector('[data-biome="frozenField"]')?.getAttribute('title')).toBe('Campo gelado <1%')
    expect((bar.querySelector('[data-biome="deepOcean"]') as HTMLElement).style.width).toBe('45%')

    // Arrastando: a prévia chega com os valores novos, e continua "Gerando" e borrado até o mapa final.
    act(() => {
      world.getState().dragParams({ ocean: 30 })
    })
    expect(started[1].req.size).toBe(PREVIEW_SIZE)
    started[1].finish(biomes(30))
    await flush()
    expect(legend.textContent).toContain('Oceano 30%')
    expect(within(bar).getByRole('status').textContent).toBe('Gerando')
    expect(map.dataset.blurred).toBe('true')

    act(() => {
      world.getState().releaseParams()
    })
    expect(started[2].req.size).toBe(MAP_SIZE)
    started[2].finish(biomes(31))
    await flush()
    expect(legend.textContent).toContain('Oceano 31%')
    expect(within(bar).getByRole('status').textContent).toBe('')
    expect(map.dataset.blurred).toBe('false')
  })
})
