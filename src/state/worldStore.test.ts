import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_PARAMS, generateField, type CoreField } from '../core'
import type { GenerateRequest, GenerateResult } from '../workers/generatorApi'
import { createNewerOnly } from '../workers/newerOnly'
import { MAP_SIZE, PREVIEW_SIZE } from './sizes'
import { DEFAULT_SIZE_KM, createWorldStore, isGenerating } from './worldStore'

/** Gerador falso: cada pedido fica parado até o teste chamar `finish` (ou `fail`). */
function fakeGenerator() {
  const started: { req: GenerateRequest; finish: () => void; fail: (e: Error) => void }[] = []
  // Um campo pequeno qualquer: o store não olha o conteúdo, só a versão.
  const field = (req: GenerateRequest): CoreField => ({ ...generateField(req.seed, 8), width: req.size })
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
              field: field(req),
              terrainRgba: new Uint8ClampedArray(0),
              workerMs: 0,
              terrainMs: 0,
              recomputed: 'classification',
              memory: { cacheBytes: 0, fieldBytes: 0 },
            }),
          fail: reject,
        })
      }),
  )
  return { gen, started }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('worldStore (AC-F1-10, AC-F1-11)', () => {
  it('começa com a seed e os parâmetros padrão, sem campo', () => {
    const store = createWorldStore(fakeGenerator().gen)
    const s = store.getState()
    expect(s.seed).toBe('rpg-world')
    expect(s.params).toEqual(DEFAULT_WORLD_PARAMS)
    expect(s.field).toBeNull()
    expect(s.terrainRgba).toBeNull()
    expect(s.status).toBe('idle')
  })

  it('arrastar pede a prévia 256² com os parâmetros novos; soltar pede o mapa 1024²', async () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    store.getState().dragParams({ ocean: 30 })
    expect(started[0].req).toEqual({ seed: 'rpg-world', size: PREVIEW_SIZE, params: { ...DEFAULT_WORLD_PARAMS, ocean: 30 } })
    expect(store.getState().status).toBe('generating')
    started[0].finish()
    await tick()
    // O RGBA do terreno chega do worker junto com o campo.
    expect(store.getState().terrainRgba).toBeInstanceOf(Uint8ClampedArray)
    store.getState().releaseParams({ ocean: 32 })
    await tick()
    expect(started[1].req).toEqual({ seed: 'rpg-world', size: MAP_SIZE, params: { ...DEFAULT_WORLD_PARAMS, ocean: 32 } })
  })

  it('durante o arrasto o mapa continua atualizando, e ao soltar o mapa final substitui a prévia', async () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    const shown: { version: number; size: number; status: string }[] = []
    store.subscribe((s, prev) => {
      if (s.field !== prev.field) shown.push({ version: s.fieldVersion, size: s.field!.width, status: s.status })
    })

    // Arrasto com pedidos mais rápidos que a geração: 3 mudanças por geração.
    let value = 45
    for (let round = 0; round < 3; round++) {
      for (let k = 0; k < 3; k++) store.getState().dragParams({ ocean: ++value })
      started[round].finish()
      await tick()
    }
    // Ainda arrastando: a última prévia pedida está no worker.
    expect(store.getState().status).toBe('generating')
    store.getState().releaseParams()
    started[3].finish()
    await tick()
    started[4].finish()
    await tick()

    expect(started.map((s) => s.req.size)).toEqual([256, 256, 256, 256, 1024])
    // Cada geração que terminou apareceu, em ordem de versão; a última é o mapa final 1024².
    expect(shown.map((s) => s.version)).toEqual([1, 3, 6, 9, 10])
    expect(shown.at(-1)).toEqual({ version: 10, size: MAP_SIZE, status: 'idle' })
    expect(store.getState().params.ocean).toBe(54)
  })

  it('soltar com a prévia na espera: a prévia nem roda, e o mapa final chega', async () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    store.getState().dragParams({ ocean: 40 })
    store.getState().dragParams({ ocean: 41 })
    store.getState().releaseParams()
    started[0].finish()
    await tick()
    started[1].finish()
    await tick()
    expect(started.map((s) => s.req.size)).toEqual([PREVIEW_SIZE, MAP_SIZE])
    expect(store.getState().field?.width).toBe(MAP_SIZE)
    expect(store.getState().fieldVersion).toBe(3)
  })

  it('trocar a seed gera o mapa final da seed nova', async () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    store.getState().setSeed('outra')
    expect(started[0].req).toMatchObject({ seed: 'outra', size: MAP_SIZE })
    started[0].finish()
    await tick()
    expect(store.getState()).toMatchObject({ seed: 'outra', fieldVersion: 1, status: 'idle' })
  })

  it('a falha do pedido mais novo fica no status; o campo exibido continua', async () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    store.getState().generate()
    started[0].finish()
    await tick()
    const field = store.getState().field
    store.getState().dragParams({ ocean: 20 })
    started[1].fail(new Error('worker caiu'))
    await tick()
    expect(store.getState().status).toBe('error')
    expect(store.getState().field).toBe(field)
  })
})

describe('worldStore: Desertos + Florestas (AC-F1-14)', () => {
  it('arrastar Desertos acima do que sobra faz Florestas recuar, e a prévia já usa o recuo', () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    expect(store.getState().dragParams({ desert: 70 })).toBe('forest')
    expect(store.getState().params).toMatchObject({ desert: 70, forest: 30 })
    expect(started[0].req.params).toMatchObject({ desert: 70, forest: 30 })
  })

  it('soltar também respeita o limite e diz qual recuou', () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    expect(store.getState().releaseParams({ forest: 90 })).toBe('desert')
    expect(started[0].req).toMatchObject({ size: MAP_SIZE, params: { forest: 90, desert: 10 } })
    expect(store.getState().releaseParams({ ocean: 20 })).toBeNull()
  })
})

describe('worldStore: presets e "Restaurar padrão" (AC-F1-16, AC-F1-17)', () => {
  it('setParams troca todos os parâmetros, mantém a seed e pede o mapa final 1024²', async () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen, { seed: 'valdora' })
    const arid = { ocean: 32, beach: 25, desert: 62, forest: 10, mountains: 34, snow: 12, continentSize: 74, coastRoughness: 45, temperature: 85 }
    store.getState().setParams(arid)
    expect(store.getState().params).toEqual(arid)
    expect(started[0].req).toEqual({ seed: 'valdora', size: MAP_SIZE, params: arid })
    started[0].finish()
    await tick()
    store.getState().setParams(DEFAULT_WORLD_PARAMS)
    expect(store.getState().params).toEqual(DEFAULT_WORLD_PARAMS)
    expect(store.getState().seed).toBe('valdora')
    expect(started[1].req).toMatchObject({ size: MAP_SIZE, params: DEFAULT_WORLD_PARAMS })
  })

  it('o store guarda uma cópia: o objeto do preset não é alterado depois', () => {
    const { gen } = fakeGenerator()
    const store = createWorldStore(gen)
    store.getState().setParams(DEFAULT_WORLD_PARAMS)
    store.getState().dragParams({ ocean: 10 })
    expect(DEFAULT_WORLD_PARAMS.ocean).toBe(45)
  })
})

describe('worldStore: gerando (AC-F1-18)', () => {
  it('gera enquanto o pedido mais novo não chega e enquanto o mapa exibido é a prévia', async () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    expect(isGenerating(store.getState())).toBe(false)
    store.getState().dragParams({ ocean: 30 })
    expect(isGenerating(store.getState())).toBe(true)
    // A prévia chegou e é o pedido mais novo: o status volta a `idle`, mas o mapa ainda é a prévia.
    started[0].finish()
    await tick()
    expect(store.getState().status).toBe('idle')
    expect(isGenerating(store.getState())).toBe(true)
    store.getState().releaseParams()
    started[1].finish()
    await tick()
    expect(store.getState().field?.width).toBe(MAP_SIZE)
    expect(isGenerating(store.getState())).toBe(false)
  })

  it('não gera mais depois de uma falha', async () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    store.getState().generate()
    started[0].fail(new Error('falhou'))
    await tick()
    expect(store.getState().status).toBe('error')
    expect(isGenerating(store.getState())).toBe(false)
  })
})

describe('createWorld (assistente de novo mundo, AC-F1-19)', () => {
  it('começa com o mundo padrão, que tem nome', () => {
    expect(createWorldStore(fakeGenerator().gen).getState().name).toBe('Terras de Valdora')
  })

  it('troca o nome, a seed e os parâmetros juntos e pede um mapa final só', async () => {
    const { gen, started } = fakeGenerator()
    const store = createWorldStore(gen)
    const params = { ...DEFAULT_WORLD_PARAMS, ocean: 66, desert: 8 }
    store.getState().createWorld({ name: 'Ilhas do Corvo', seed: 'corvo-1a2b', params })
    expect(started.map((s) => s.req)).toEqual([{ seed: 'corvo-1a2b', size: MAP_SIZE, params }])
    const s = store.getState()
    expect([s.name, s.seed, s.params]).toEqual(['Ilhas do Corvo', 'corvo-1a2b', params])
    expect(s.status).toBe('generating')
    started[0].finish()
    await tick()
    expect(store.getState().field?.width).toBe(MAP_SIZE)
    expect(store.getState().status).toBe('idle')
  })
})

describe('worldStore: largura do mundo em km (escala, AC-F2-09)', () => {
  it('vem dos dados iniciais, como o nome e a seed; sem ela, 800 km', () => {
    expect(createWorldStore(fakeGenerator().gen).getState().sizeKm).toBe(DEFAULT_SIZE_KM)
    expect(DEFAULT_SIZE_KM).toBe(800)
    expect(createWorldStore(fakeGenerator().gen, { sizeKm: 1200 }).getState().sizeKm).toBe(1200)
  })

  it('um valor inválido (zero, negativo ou não finito) volta para a padrão', () => {
    for (const sizeKm of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(createWorldStore(fakeGenerator().gen, { sizeKm }).getState().sizeKm).toBe(DEFAULT_SIZE_KM)
    }
  })

  it('o mundo novo do assistente traz a sua, ou a padrão', () => {
    const store = createWorldStore(fakeGenerator().gen, { sizeKm: 1200 })
    const params = store.getState().params
    store.getState().createWorld({ name: 'Novo', sizeKm: 400, seed: 's', params })
    expect(store.getState().sizeKm).toBe(400)
    store.getState().createWorld({ name: 'Outro', seed: 't', params })
    expect(store.getState().sizeKm).toBe(DEFAULT_SIZE_KM)
  })
})
