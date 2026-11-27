import { describe, expect, it } from 'vitest'
import { BIOME } from '../types'
import { generateField } from '../world/generateField'
import { cityRoutes, connectCities, type CityNetwork } from './connectCities'
import { buildCostGrid, cellOf, type RouteField } from './costGrid'
import { findRoute, type RoutePoint } from './findRoute'

const WATER: number[] = [BIOME.deepOcean, BIOME.shallowWater, BIOME.lake]

/** Campo sintético `size`², todo campo (planície) e plano, editado por `paint`. */
function field(size: number, paint?: (set: (x: number, y: number, b: number) => void) => void, rivers: RoutePoint[][] = []): RouteField {
  const biome = new Uint8Array(size * size).fill(BIOME.grassland)
  const elevation = new Float32Array(size * size).fill(0.5)
  paint?.((x, y, b) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    biome[y * size + x] = b
  })
  return { width: size, height: size, biome, elevation, rivers }
}

const rect = (set: (x: number, y: number, b: number) => void, x0: number, y0: number, x1: number, y1: number, b: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, b)
}

const at = (x: number, y: number): RoutePoint => ({ u: x / 256, v: y / 256 })

/** Os pares ligados, sem ordem ("0-2"). */
const pairsOf = (net: CityNetwork) => net.links.map((l) => [Math.min(l.from, l.to), Math.max(l.from, l.to)].join('-')).sort()

/** As cidades ligadas entre si (pelos links e pelos grupos), como componentes. */
function components(n: number, net: CityNetwork, groups: readonly number[] = []): number[] {
  const parent = [...Array(n).keys()]
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k])))
  const join = (a: number, b: number) => (parent[find(a)] = find(b))
  for (const l of net.links) join(l.from, l.to)
  groups.forEach((g, k) => groups.forEach((h, j) => g === h && join(k, j)))
  return [...Array(n).keys()].map(find)
}

/** Custo da árvore mínima por força bruta (Prim), com o custo da `findRoute` entre cada par. */
function bruteMst(grid: ReturnType<typeof buildCostGrid>, cities: RoutePoint[]): number {
  const n = cities.length
  const d = cities.map((a) => cities.map((b) => (a === b ? 0 : (findRoute(grid, a, b, 'land')?.cost ?? Infinity))))
  const inTree = new Set([0])
  let total = 0
  while (inTree.size < n) {
    let best = Infinity
    let next = -1
    for (const i of inTree) for (let j = 0; j < n; j++) if (!inTree.has(j) && Math.min(d[i][j], d[j][i]) < best) [best, next] = [Math.min(d[i][j], d[j][i]), j]
    if (next < 0) break
    inTree.add(next)
    total += best
  }
  return total
}

describe('Conectar cidades: a malha (AC-F5-14)', () => {
  it('liga todas as cidades com n−1 estradas, sem repetir pares, pelos vizinhos', () => {
    const cities = [at(30, 128), at(90, 128), at(150, 128), at(210, 128)]
    const net = connectCities(buildCostGrid(field(256)), cities)
    expect(net.isolated).toEqual([])
    expect(net.links).toHaveLength(3)
    expect(new Set(pairsOf(net)).size).toBe(3)
    // Em linha reta numa planície, a menor malha liga só os vizinhos.
    expect(pairsOf(net)).toEqual(['0-1', '1-2', '2-3'])
    expect(new Set(components(4, net)).size).toBe(1)
    for (const l of net.links) {
      expect(l.points[0]).toEqual(cities[l.from])
      expect(l.points.at(-1)).toEqual(cities[l.to])
    }
  })

  it('tem o custo da árvore mínima pelo terreno (o mesmo da força bruta com a findRoute)', () => {
    const f = field(256, (set) => {
      rect(set, 100, 0, 120, 200, BIOME.lake)
      rect(set, 40, 150, 90, 230, BIOME.rockyMountain)
      rect(set, 160, 30, 230, 90, BIOME.forest)
    })
    const grid = buildCostGrid(f)
    const cities = [at(30, 40), at(70, 120), at(200, 60), at(180, 200), at(60, 240), at(230, 230)]
    const net = connectCities(grid, cities)
    expect(net.links).toHaveLength(cities.length - 1)
    const total = net.links.reduce((s, l) => s + l.cost, 0)
    expect(total).toBeCloseTo(bruteMst(grid, cities), 3)
  })

  it('nenhuma estrada da malha passa pela água', () => {
    const f = field(256, (set) => rect(set, 90, 20, 160, 230, BIOME.lake))
    const net = connectCities(buildCostGrid(f), [at(40, 60), at(220, 60), at(40, 200), at(220, 200)])
    expect(net.links).toHaveLength(3)
    for (const l of net.links) {
      for (const p of l.points) {
        const b = f.biome[Math.min(255, Math.floor(p.v * 256)) * 256 + Math.min(255, Math.floor(p.u * 256))]
        expect(WATER).not.toContain(b)
      }
    }
  })

  it('a cidade numa ilha fica de fora (isolated), e as outras são ligadas', () => {
    const f = field(256, (set) => {
      rect(set, 150, 0, 255, 255, BIOME.deepOcean)
      rect(set, 200, 100, 240, 140, BIOME.grassland)
    })
    const net = connectCities(buildCostGrid(f), [at(30, 50), at(220, 120), at(60, 200), at(120, 120)])
    expect(net.isolated).toEqual([1])
    expect(pairsOf(net).every((p) => !p.split('-').includes('1'))).toBe(true)
    expect(net.links).toHaveLength(2)
  })

  it('duas ilhas com duas cidades cada ganham cada uma a sua estrada', () => {
    const f = field(256, (set) => {
      rect(set, 0, 0, 255, 255, BIOME.deepOcean)
      rect(set, 10, 10, 100, 100, BIOME.grassland)
      rect(set, 150, 150, 245, 245, BIOME.grassland)
    })
    const net = connectCities(buildCostGrid(f), [at(20, 20), at(200, 200), at(90, 90), at(160, 160)])
    expect(net.isolated).toEqual([])
    expect(pairsOf(net)).toEqual(['0-2', '1-3'])
  })

  it('não repete um par já ligado e não fecha ciclo com as estradas que já existem', () => {
    const cities = [at(30, 128), at(90, 128), at(150, 128), at(210, 128)]
    const grid = buildCostGrid(field(256))
    // 0–1 e 1–2 já ligadas: só falta ligar o 3.
    const net = connectCities(grid, cities, [0, 0, 0, 3])
    expect(pairsOf(net)).toEqual(['2-3'])
    // Todas já ligadas: nada novo, nenhuma de fora.
    expect(connectCities(grid, cities, [7, 7, 7, 7])).toEqual({ links: [], isolated: [] })
  })

  it('a cidade sem caminho por terra mas já ligada por estrada (rota marítima) não fica de fora', () => {
    const f = field(256, (set) => rect(set, 120, 0, 135, 255, BIOME.deepOcean))
    const net = connectCities(buildCostGrid(f), [at(40, 100), at(200, 100)], [5, 5])
    expect(net).toEqual({ links: [], isolated: [] })
  })

  it('a cidade numa célula com água, na margem, é ponta: a malha chega nela', () => {
    const f = field(256, (set) => rect(set, 60, 60, 70, 70, BIOME.lake))
    const net = connectCities(buildCostGrid(f), [at(60.5, 65.5), at(150, 150)])
    expect(net.links).toHaveLength(1)
    expect(net.isolated).toEqual([])
  })

  it('duas cidades na mesma célula da grade se ligam', () => {
    const grid = buildCostGrid(field(256))
    const net = connectCities(grid, [at(100.2, 100.2), at(100.6, 100.6), at(200, 200)])
    expect(net.links).toHaveLength(2)
    expect(cellOf(grid.size, 100.2 / 256, 100.2 / 256)).toBe(cellOf(grid.size, 100.6 / 256, 100.6 / 256))
    expect(pairsOf(net)).toContain('0-1')
  })

  it('fora das candidatas, a ligação vem da findRoute e a malha continua completa', () => {
    const cities = [at(20, 20), at(30, 20), at(40, 20), at(230, 230), at(240, 230)]
    const net = connectCities(buildCostGrid(field(256)), cities, undefined, { candidates: 1 })
    expect(net.links).toHaveLength(4)
    expect(new Set(components(5, net)).size).toBe(1)
  })

  it('é determinística, e liga 30 cidades num mapa gerado', () => {
    const f = generateField('rpg-world', 256)
    const grid = buildCostGrid(f)
    const cities: RoutePoint[] = []
    for (let i = 7; i < f.biome.length && cities.length < 30; i += 997) {
      const p = { u: ((i % 256) + 0.5) / 256, v: (Math.floor(i / 256) + 0.5) / 256 }
      if (grid.cost[cellOf(grid.size, p.u, p.v)] !== Infinity) cities.push(p)
    }
    expect(cities).toHaveLength(30)
    const net = connectCities(grid, cities)
    expect(connectCities(grid, cities)).toEqual(net)
    // Uma árvore por grupo de cidades alcançáveis: links = cidades − componentes.
    const comps = new Set(components(30, net)).size
    expect(net.links.length).toBe(30 - comps)
    expect(new Set(pairsOf(net)).size).toBe(net.links.length)
  })
})

describe('Conectar cidades: o custo de cada par é o da findRoute', () => {
  it('uma cidade num rio, na única passagem entre dois lagos, não bloqueia as outras e cobra a ponte', () => {
    // Uma faixa de terra de uma linha (y = 128) entre dois lagos, cruzada por um rio em x = 128.
    const f = field(
      256,
      (set) => {
        rect(set, 100, 0, 156, 127, BIOME.lake)
        rect(set, 100, 129, 156, 255, BIOME.lake)
      },
      [[{ u: 128.5 / 256, v: 0 }, { u: 128.5 / 256, v: 1 }]],
    )
    const grid = buildCostGrid(f)
    const cities = [at(40.5, 128.5), at(128.5, 128.5), at(220.5, 128.5)]
    expect(grid.river[cellOf(256, cities[1].u, cities[1].v)]).toBe(1)
    const { cost } = cityRoutes(grid, cities)
    for (const [i, j] of [[0, 2], [2, 0], [0, 1], [1, 0], [1, 2]]) {
      const expected = findRoute(grid, cities[i], cities[j], 'land')!.cost
      expect(cost[i * 3 + j]).toBeCloseTo(expected, 6)
    }
  })

  it('num mapa gerado, com cidades nos rios, todo par custa o mesmo que a findRoute', () => {
    const f = generateField('rpg-world', 256)
    const grid = buildCostGrid(f)
    const cities: RoutePoint[] = []
    // Metade nos rios, metade em terra.
    for (let c = 0; c < grid.river.length && cities.length < 5; c += 37) if (grid.river[c] && grid.cost[c] !== Infinity) cities.push({ u: ((c % 256) + 0.5) / 256, v: (Math.floor(c / 256) + 0.5) / 256 })
    for (let c = 11; c < grid.cost.length && cities.length < 10; c += 6007) if (grid.cost[c] !== Infinity && !grid.river[c]) cities.push({ u: ((c % 256) + 0.5) / 256, v: (Math.floor(c / 256) + 0.5) / 256 })
    expect(cities).toHaveLength(10)
    const { cost } = cityRoutes(grid, cities)
    const n = cities.length
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const expected = findRoute(grid, cities[i], cities[j], 'land')?.cost ?? Infinity
        if (expected === Infinity) expect(cost[i * n + j]).toBe(Infinity)
        else expect(cost[i * n + j]).toBeCloseTo(expected, 4)
      }
    }
  })
})
