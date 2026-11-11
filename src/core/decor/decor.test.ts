import { describe, expect, it } from 'vitest'
import { createRandom } from '../rng/random'
import { BIOME, DECOR, type Decor } from '../types'
import { generateField } from '../world/generateField'
import { hashField } from '../world/hashField'
import { DEFAULT_WORLD_PARAMS } from '../world/params'
import { DECOR_BIOMES, DECOR_RULES, DECOR_SPACING, MAX_DECOR, placeDecor, poissonDisk } from './decor'

/** AC-F1-08: decoração por Poisson-disk conforme o bioma, determinística, com no máximo 5.000 ícones. */

function biomeAt(biome: Uint8Array, size: number, u: number, v: number): number {
  return biome[Math.min(size - 1, Math.floor(v * size)) * size + Math.min(size - 1, Math.floor(u * size))]
}

function counts(decor: Decor): Map<number, number> {
  const m = new Map<number, number>()
  for (const k of decor.kind) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

/** Menor distância entre dois pontos (`u`, `v` intercalados), por força bruta numa grade. */
function minDistance(u: ArrayLike<number>, v: ArrayLike<number>): number {
  let best = Infinity
  for (let i = 0; i < u.length; i++) {
    for (let j = i + 1; j < u.length; j++) {
      const du = u[i] - u[j]
      const dv = v[i] - v[j]
      best = Math.min(best, Math.sqrt(du * du + dv * dv))
    }
  }
  return best
}

describe('amostra de Poisson-disk', () => {
  const points = poissonDisk(createRandom('poisson'), 0.05)
  const u = points.filter((_, i) => i % 2 === 0)
  const v = points.filter((_, i) => i % 2 === 1)

  it('nenhum par fica mais perto que a distância mínima, e todos ficam no mapa', () => {
    expect(minDistance(u, v)).toBeGreaterThanOrEqual(0.05)
    for (const x of points) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('cobre o mapa: não sobra lugar para outro ponto a 2× a distância mínima', () => {
    // Bridson é maximal: todo ponto do quadrado fica a menos de 2r de algum ponto da amostra.
    const step = 0.01
    for (let y = step / 2; y < 1; y += step) {
      for (let x = step / 2; x < 1; x += step) {
        let near = false
        for (let k = 0; k < u.length && !near; k++) near = (u[k] - x) ** 2 + (v[k] - y) ** 2 < (2 * 0.05) ** 2
        expect(near, `${x}, ${y}`).toBe(true)
      }
    }
  })

  it('é determinística pela seed', () => {
    expect(poissonDisk(createRandom('poisson'), 0.05)).toEqual(points)
    expect(poissonDisk(createRandom('outra'), 0.05)).not.toEqual(points)
  })
})

describe('decoração do campo (AC-F1-08)', () => {
  const field = generateField('rpg-world', 256)
  const { decor } = field

  it('é determinística: a mesma seed dá os mesmos ícones, outra seed dá outros', () => {
    expect(generateField('rpg-world', 256).decor).toEqual(decor)
    expect(generateField('Aldebaran', 256).decor).not.toEqual(decor)
  })

  it('cada ícone cai num bioma que tem aquele ícone no design system', () => {
    expect(decor.kind.length).toBeGreaterThan(500)
    for (let i = 0; i < decor.kind.length; i++) {
      const b = biomeAt(field.biome, field.width, decor.u[i], decor.v[i])
      expect(DECOR_BIOMES.get(decor.kind[i] as never), `ícone ${i}`).toBe(b)
    }
  })

  it('não há ícone na água rasa, no lago nem no campo gelado', () => {
    const decorated = new Set(DECOR_RULES.map((r) => r.biome))
    for (const b of [BIOME.shallowWater, BIOME.lake, BIOME.frozenField]) expect(decorated.has(b)).toBe(false)
    const cold = generateField('rpg-world', 256, { ...DEFAULT_WORLD_PARAMS, temperature: 0 })
    expect(cold.biome.includes(BIOME.frozenField)).toBe(true)
    for (let i = 0; i < cold.decor.kind.length; i++) {
      const b = biomeAt(cold.biome, 256, cold.decor.u[i], cold.decor.v[i])
      expect([BIOME.shallowWater, BIOME.lake, BIOME.frozenField]).not.toContain(b)
    }
  })

  it('tem os ícones de todos os biomas decorados, mais densos na floresta e nas montanhas', () => {
    const c = counts(decor)
    for (const kind of Object.values(DECOR)) expect(c.get(kind) ?? 0, `tipo ${kind}`).toBeGreaterThan(0)
    // Densidade por célula do bioma: a floresta tem mais árvores por área que o campo tem tufos.
    const cells = (b: number) => field.biome.filter((x) => x === b).length
    expect(c.get(DECOR.tree)! / cells(BIOME.forest)).toBeGreaterThan((3 * c.get(DECOR.tuft)!) / cells(BIOME.grassland))
  })

  it('nenhum par de ícones fica mais perto que a distância mínima (Poisson-disk)', () => {
    expect(minDistance(decor.u, decor.v)).toBeGreaterThanOrEqual(DECOR_SPACING * (1 - 1e-6))
  })

  it('sai de cima para baixo, a ordem de desenho', () => {
    for (let i = 1; i < decor.v.length; i++) expect(decor.v[i]).toBeGreaterThanOrEqual(decor.v[i - 1])
  })

  it('a prévia e o mapa final usam os mesmos pontos: a maioria dos ícones da prévia está no final', () => {
    const final = generateField('rpg-world', 1024).decor
    const key = (d: Decor, i: number) => `${d.u[i]},${d.v[i]},${d.kind[i]}`
    const inFinal = new Set(Array.from(final.kind, (_, i) => key(final, i)))
    const same = Array.from(decor.kind, (_, i) => key(decor, i)).filter((k) => inFinal.has(k)).length
    expect(same / decor.kind.length).toBeGreaterThan(0.9)
  })

  it('tem no máximo 5.000 ícones, com qualquer valor dos sliders', () => {
    expect(MAX_DECOR).toBe(5000)
    // Floresta e montanhas no máximo, pouco oceano: o caso mais denso.
    const dense = generateField('rpg-world', 256, {
      ...DEFAULT_WORLD_PARAMS,
      ocean: 5,
      desert: 0,
      forest: 100,
      mountains: 100,
      snow: 100,
      continentSize: 100,
    })
    expect(dense.decor.kind.length).toBeLessThanOrEqual(MAX_DECOR)
    expect(dense.decor.u).toHaveLength(dense.decor.kind.length)
    expect(dense.decor.v).toHaveLength(dense.decor.kind.length)
  })

  it('acima do limite, fica uma fração uniforme dos ícones, no limite exato', () => {
    const forest = new Uint8Array(64 * 64).fill(BIOME.forest)
    const all = placeDecor('cheio', forest, 64)
    const capped = placeDecor('cheio', forest, 64, 1000)
    expect(all.kind.length).toBeGreaterThan(2000)
    expect(capped.kind).toHaveLength(1000)
    // Os ícones que ficam são do conjunto completo, e a metade de baixo do mapa tem quase metade
    // deles: nenhuma região some.
    const key = (d: Decor, i: number) => `${d.u[i]},${d.v[i]}`
    const full = new Set(Array.from(all.kind, (_, i) => key(all, i)))
    for (let i = 0; i < capped.kind.length; i++) expect(full.has(key(capped, i))).toBe(true)
    const bottom = capped.v.filter((v) => v >= 0.5).length
    expect(bottom / capped.kind.length).toBeGreaterThan(0.45)
    expect(bottom / capped.kind.length).toBeLessThan(0.55)
  })

  it('entra no hash do campo', () => {
    const changed = { ...field, decor: { ...decor, kind: decor.kind.map((k) => (k === DECOR.tree ? DECOR.dune : k)) } }
    expect(hashField(changed)).not.toBe(hashField(field))
  })
})
