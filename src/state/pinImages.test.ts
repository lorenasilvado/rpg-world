import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pin, StoredImage } from '../persistence/types'
import { createPinImages, pinImageId, pinImageIds } from './pinImages'

const pin = (patch: Partial<Pin>): Pin => ({
  id: 'p',
  type: 'custom',
  name: 'p',
  pos: { u: 0.5, v: 0.5 },
  icon: { kind: 'builtin', key: 'custom' },
  description: '',
  tags: [],
  fields: {},
  ...patch,
})

function fakeRepo() {
  const images = new Map<string, StoredImage>()
  return {
    images,
    saveImage: vi.fn(async (image: StoredImage) => void images.set(image.id, image)),
    getImage: vi.fn(async (id: string) => images.get(id)),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('imagens enviadas dos pins (AC-F3-11)', () => {
  it('a imagem vai para o banco como blob, com o mundo como dono, e ganha um endereço', async () => {
    let n = 0
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:${++n}`, revokeObjectURL: vi.fn() }))
    const repo = fakeRepo()
    const images = createPinImages({ worldId: 'w1', repo, newId: () => 'img-1' })
    const blob = new Blob(['png'], { type: 'image/png' })
    const id = await images.add(blob)
    expect(id).toBe('img-1')
    expect(repo.images.get('img-1')).toEqual({ id: 'img-1', worldId: 'w1', blob })
    expect(images.blob('img-1')).toBe(blob)
    expect(images.store.getState().urls).toEqual({ 'img-1': 'blob:1' })
  })

  it('lê do banco só as que faltam; uma que não está no banco fica de fora', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() }))
    const repo = fakeRepo()
    repo.images.set('a', { id: 'a', worldId: 'w1', blob: new Blob(['a']) })
    const images = createPinImages({ worldId: 'w1', repo })
    await images.load(['a', 'sumiu'])
    await images.load(['a'])
    expect(repo.getImage).toHaveBeenCalledTimes(2)
    expect(Object.keys(images.store.getState().urls)).toEqual(['a'])
    expect(images.blob('sumiu')).toBeUndefined()
  })

  it('se gravar falha, o erro chega a quem enviou e a imagem não entra', async () => {
    const repo = { saveImage: () => Promise.reject(new Error('cheio')), getImage: async () => undefined }
    const images = createPinImages({ worldId: 'w1', repo, newId: () => 'x' })
    await expect(images.add(new Blob(['a']))).rejects.toThrow('cheio')
    expect(images.blob('x')).toBeUndefined()
  })

  it('ao fechar o mundo, os endereços são liberados', async () => {
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:1', revokeObjectURL }))
    const images = createPinImages({ worldId: 'w1' })
    await images.add(new Blob(['a']))
    images.dispose()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:1')
    expect(images.store.getState().urls).toEqual({})
  })

  it('só o Personalizado com imagem mostra a imagem', () => {
    expect(pinImageId(pin({ icon: { kind: 'image', blobId: 'a' } }))).toBe('a')
    expect(pinImageId(pin({ type: 'cidade', icon: { kind: 'image', blobId: 'a' } }))).toBeNull()
    expect(pinImageId(pin({}))).toBeNull()
    expect(pinImageIds([pin({ icon: { kind: 'image', blobId: 'a' } }), pin({ icon: { kind: 'image', blobId: 'a' } }), pin({})])).toEqual(['a'])
  })
})
