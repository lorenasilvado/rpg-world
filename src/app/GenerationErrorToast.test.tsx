import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_PARAMS, generateField } from '../core'
import { createWorldStore } from '../state/worldStore'
import type { GenerateRequest, GenerateResult } from '../workers/generatorApi'
import { createNewerOnly } from '../workers/newerOnly'
import { GenerationErrorToast } from './GenerationErrorToast'

/** Gerador falso: cada pedido fica parado até o teste chamar `finish` ou `fail`. */
function fakeGenerator() {
  const started: { req: GenerateRequest; finish: () => void; fail: (e: Error) => void }[] = []
  const gen = createNewerOnly(
    (req: GenerateRequest) =>
      new Promise<GenerateResult>((resolve, reject) => {
        started.push({
          req,
          finish: () =>
            resolve({
              seed: req.seed,
              size: req.size,
              params: req.params ?? DEFAULT_WORLD_PARAMS,
              field: generateField(req.seed, 8),
              workerMs: 0,
              recomputed: 'classification',
              memory: { cacheBytes: 0, fieldBytes: 0 },
            }),
          fail: reject,
        })
      }),
  )
  return { gen, started }
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 0)))

afterEach(cleanup)

describe('toast de erro da geração (AC-F1-12)', () => {
  it('sem falha, não aparece', async () => {
    const { gen, started } = fakeGenerator()
    const world = createWorldStore(gen)
    render(<GenerationErrorToast world={world} />)
    act(() => world.getState().generate())
    started[0].finish()
    await settle()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a geração falha: aparece "Não foi possível gerar o mapa" com "Tentar de novo", que gera de novo', async () => {
    const { gen, started } = fakeGenerator()
    const world = createWorldStore(gen)
    render(<GenerationErrorToast world={world} />)
    act(() => world.getState().generate())
    started[0].fail(new Error('o worker de geração falhou'))
    await settle()

    const toast = screen.getByRole('alert')
    expect(toast.textContent).toContain('Não foi possível gerar o mapa')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    // Pediu de novo o mapa final, com a mesma seed e os mesmos parâmetros; o toast some.
    await settle()
    expect(started).toHaveLength(2)
    expect(started[1].req).toEqual(started[0].req)
    expect(screen.queryByRole('alert')).toBeNull()

    started[1].finish()
    await settle()
    expect(world.getState().status).toBe('idle')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a falha de um pedido já superado não mostra o toast', async () => {
    const { gen, started } = fakeGenerator()
    const world = createWorldStore(gen)
    render(<GenerationErrorToast world={world} />)
    act(() => {
      world.getState().dragParams({ ocean: 30 })
      world.getState().releaseParams({ ocean: 31 })
    })
    started[0].fail(new Error('falhou'))
    await settle()
    expect(screen.queryByRole('alert')).toBeNull()
    started[1].finish()
    await settle()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
