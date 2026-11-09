import type { DecorPlacement } from '../mockup/drawMockup'
import { seededRandom, type MockTerrain } from '../mockup/terrain'
import { DECOR_BY_BIOME } from '../render/style/decor'
import { BIOMES } from '../render/style/palette'

const MAX_ATTEMPTS_PER_SPRITE = 1000

/**
 * Exatamente `count` ícones em posições sorteadas nos biomas com decoração, ordenados por y.
 * Não é a distribuição de produção (Poisson-disk, no M1): o spike só precisa da carga exata.
 */
export function placeSprites(t: MockTerrain, seed: string, count: number): DecorPlacement[] {
  const rand = seededRandom(`${seed}:sprites`)
  const out: DecorPlacement[] = []
  const maxAttempts = count * MAX_ATTEMPTS_PER_SPRITE
  for (let attempt = 0; out.length < count; attempt++) {
    if (attempt >= maxAttempts) throw new Error('o terreno não tem biomas com decoração suficientes')
    const x = rand() * t.width
    const y = rand() * t.height
    const pick = rand()
    const kinds = DECOR_BY_BIOME[BIOMES[t.biome[Math.floor(y) * t.width + Math.floor(x)]]]
    if (kinds.length === 0) continue
    out.push({ kind: kinds[Math.floor(pick * kinds.length)], x, y })
  }
  return out.sort((a, b) => a.y - b.y)
}
