import { describe, expect, it } from 'vitest'
import type { Road } from '../../persistence/types'
import { ROAD_HIT_PX, roadAt } from './roadHit'

const road = (id: string, points: [number, number][], extra: Partial<Road> = {}): Road => ({
  id,
  name: id,
  kind: 'road',
  points: points.map(([u, v]) => ({ u, v })),
  ...extra,
})

/** Câmera com 1 px por unidade do mundo, da origem: o px da tela é a unidade (u, v = px / 1024). */
const cam = { scale: 1, view: { x: 0, y: 0 }, origin: { x: 0, y: 0 } }
const none = () => undefined

describe('roadAt (AC-F5-06)', () => {
  const h = road('h', [
    [0.1, 0.5],
    [0.4, 0.5],
  ])

  it('acerta até ROAD_HIT_PX da linha do meio, mais largo que o traço', () => {
    const y = 0.5 * 1024
    expect(roadAt(200, y, [h], none, cam)?.id).toBe('h')
    expect(roadAt(200, y + ROAD_HIT_PX - 1, [h], none, cam)?.id).toBe('h')
    expect(roadAt(200, y + ROAD_HIT_PX + 2, [h], none, cam)).toBeNull()
    // Fora das pontas, longe: nada.
    expect(roadAt(600, y, [h], none, cam)).toBeNull()
  })

  it('a tolerância é em px na tela: com zoom 2×, cobre metade do mundo', () => {
    const zoomed = { ...cam, scale: 2 }
    const y = 0.5 * 1024 * 2
    expect(roadAt(400, y + 8, [h], none, zoomed)?.id).toBe('h')
    expect(roadAt(400, y + 14, [h], none, zoomed)).toBeNull()
  })

  it('a mais próxima ganha; a ponta ligada segue o pin', () => {
    const v = road('v', [
      [0.2, 0.3],
      [0.2, 0.7],
    ])
    const y = 0.5 * 1024
    expect(roadAt(0.2 * 1024 + 1, y + 4, [h, v], none, cam)?.id).toBe('v')
    const linked = road('l', [
      [0.6, 0.1],
      [0.6, 0.2],
    ], { to: 'p' })
    const pinPos = (id: string) => (id === 'p' ? { u: 0.6, v: 0.9 } : undefined)
    expect(roadAt(0.6 * 1024, 0.8 * 1024, [linked], pinPos, cam)?.id).toBe('l')
    expect(roadAt(0.6 * 1024, 0.8 * 1024, [linked], none, cam)).toBeNull()
  })
})
