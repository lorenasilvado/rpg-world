import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_PARAMS } from '../../core'
import { generatorApi } from '../../workers/generatorApi'
import { createNewerOnly } from '../../workers/newerOnly'
import { PRESETS } from '../../state/presets'
import { createThumbnails, loadThumbnails, THUMBNAIL_SIZE, type Thumbnails } from './thumbnails'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('miniaturas dos presets (AC-F1-19)', () => {
  it('gera o RGBA do terreno no tamanho da miniatura, com a seed e o preset pedidos', async () => {
    // O gerador de verdade (a API do worker), sem worker.
    const requests: unknown[] = []
    const gen = createNewerOnly(async (req: Parameters<typeof generatorApi.generate>[0]) => {
      requests.push(req)
      return generatorApi.generate(req)
    })
    const thumbs = createThumbnails({ ...gen, terminate: vi.fn() })
    const rgba = await thumbs.render('corvo-1a2b', PRESETS[1].params)
    expect(rgba?.length).toBe(THUMBNAIL_SIZE * THUMBNAIL_SIZE * 4)
    expect(requests).toEqual([{ seed: 'corvo-1a2b', size: THUMBNAIL_SIZE, params: PRESETS[1].params }])
  })

  it('dispose encerra o worker das miniaturas', () => {
    const terminate = vi.fn()
    createThumbnails({ request: vi.fn(), terminate }).dispose()
    expect(terminate).toHaveBeenCalledOnce()
  })

  it('pede os presets um depois do outro e entrega cada um', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const render = vi.fn(async (seed: string, _params: unknown) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await tick()
      inFlight--
      return new Uint8ClampedArray(seed.length)
    })
    const got: string[] = []
    loadThumbnails({ render, dispose() {} }, 'abc', PRESETS, (id) => got.push(id))
    await vi.waitFor(() => expect(got).toHaveLength(4))
    expect(got).toEqual(PRESETS.map((p) => p.id))
    expect(maxInFlight).toBe(1)
    expect(render.mock.calls.map((c) => c[1])).toEqual(PRESETS.map((p) => p.params))
  })

  it('cancelado, não entrega nem pede mais nada', async () => {
    const render = vi.fn(async () => {
      await tick()
      return new Uint8ClampedArray(4)
    })
    const got: string[] = []
    const cancel = loadThumbnails({ render, dispose() {} }, 'abc', PRESETS, (id) => got.push(id))
    cancel()
    await tick()
    await tick()
    expect(got).toEqual([])
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('uma falha deixa as que faltam sem imagem, sem lançar', async () => {
    const thumbs: Thumbnails = {
      render: vi.fn(async (_seed, params) => {
        if (params === PRESETS[1].params) throw new Error('worker caiu')
        return new Uint8ClampedArray(4)
      }),
      dispose() {},
    }
    const got: string[] = []
    loadThumbnails(thumbs, 'abc', PRESETS, (id) => got.push(id))
    await tick()
    await tick()
    expect(got).toEqual([PRESETS[0].id])
    expect(thumbs.render).toHaveBeenCalledTimes(2)
  })

  it('um pedido substituído (null) não entrega imagem', async () => {
    const got: string[] = []
    loadThumbnails({ render: async () => null, dispose() {} }, 'abc', [{ id: 'x', params: DEFAULT_WORLD_PARAMS }], (id) => got.push(id))
    await tick()
    expect(got).toEqual([])
  })
})
