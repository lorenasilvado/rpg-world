import { describe, expect, it } from 'vitest'
import { sampleCurve } from '../../render/layers/roadMath'
import { BIOME } from '../types'
import { generateField } from '../world/generateField'
import { buildCostGrid, cellOf, type RouteField } from './costGrid'
import { BRIDGE_COST, findRoute, MAX_SEGMENT, segmentCells, SLOPE_COST, type RoutePoint } from './findRoute'

const WATER: number[] = [BIOME.deepOcean, BIOME.shallowWater, BIOME.lake]

/** Campo sintético `size`², todo campo (planície) e plano, editado por `paint`. */
function field(size: number, paint?: (set: (x: number, y: number, b: number) => void) => void, rivers: RoutePoint[][] = []): RouteField {
  const biome = new Uint8Array(size * size).fill(BIOME.grassland)
  const elevation = new Float32Array(size * size).fill(0.5)
  paint?.((x, y, b) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    biome[y * size + x] = b
    if (b === BIOME.rockyMountain || b === BIOME.snow) elevation[y * size + x] = 0.9
  })
  return { width: size, height: size, biome, elevation, rivers }
}

const rect = (set: (x: number, y: number, b: number) => void, x0: number, y0: number, x1: number, y1: number, b: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x < x1 + 1; x++) set(x, y, b)
}

/** O bioma do campo em (u, v). */
const biomeAt = (f: RouteField, p: RoutePoint) =>
  f.biome[Math.min(f.height - 1, Math.floor(p.v * f.height)) * f.width + Math.min(f.width - 1, Math.floor(p.u * f.width))]

/** A polilinha da rota, amostrada a cada 1/4 de célula do campo. */
function dense(points: RoutePoint[], f: RouteField): RoutePoint[] {
  const step = 0.25 / f.width
  const out: RoutePoint[] = []
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]
    const b = points[k]
    const n = Math.max(1, Math.ceil(Math.hypot(b.u - a.u, b.v - a.v) / step))
    for (let s = 0; s < n; s++) out.push({ u: a.u + ((b.u - a.u) * s) / n, v: a.v + ((b.v - a.v) * s) / n })
  }
  out.push(points[points.length - 1])
  return out
}

/** A curva Catmull-Rom do desenho da estrada, amostrada. */
function curve(points: RoutePoint[], f: RouteField): RoutePoint[] {
  const xy = points.map((p) => ({ x: p.u * f.width, y: p.v * f.height }))
  return sampleCurve(xy, 0.25).map((p) => ({ u: p.x / f.width, v: p.y / f.height }))
}

/** Custo de andar a polilinha (para comparar com a reta): o custo do bioma de cada trecho. */
function polylineCost(points: RoutePoint[], f: RouteField): number {
  const cost: Record<number, number> = {
    [BIOME.grassland]: 1,
    [BIOME.forest]: 2.5,
    [BIOME.rockyMountain]: 14,
    [BIOME.snow]: 18,
  }
  const pts = dense(points, f)
  let total = 0
  for (let k = 1; k < pts.length; k++) {
    const d = Math.hypot(pts[k].u - pts[k - 1].u, pts[k].v - pts[k - 1].v) * f.width
    total += d * (cost[biomeAt(f, pts[k])] ?? 1)
  }
  return total
}

/** Quantas vezes a polilinha entra numa célula de rio da grade. */
function riverEntries(points: RoutePoint[], f: RouteField): { entries: number; cells: number } {
  const grid = buildCostGrid(f)
  let entries = 0
  let cells = 0
  let was = false
  let last = -1
  for (const p of dense(points, f)) {
    const c = cellOf(grid.size, p.u, p.v)
    if (c === last) continue
    last = c
    const on = grid.river[c] === 1
    if (on) cells++
    if (on && !was) entries++
    was = on
  }
  return { entries, cells }
}

describe('rota pelo terreno: água (AC-F5-09)', () => {
  it('contorna um lago entre os dois pontos, sem passar por água, nem na curva suavizada', () => {
    const f = field(256, (set) => rect(set, 100, 40, 160, 210, BIOME.lake))
    const route = findRoute(buildCostGrid(f), { u: 0.2, v: 0.5 }, { u: 0.8, v: 0.5 }, 'land')
    expect(route).not.toBeNull()
    for (const p of [...dense(route!.points, f), ...curve(route!.points, f)]) expect(WATER).not.toContain(biomeAt(f, p))
  })

  it('num mapa 1024², a grade é 256² e a rota também não passa pela água', () => {
    const f = field(1024, (set) => {
      rect(set, 400, 100, 640, 900, BIOME.deepOcean)
      // Um canal de 1 célula do campo, mais estreito que uma célula da grade.
      rect(set, 0, 500, 1023, 500, BIOME.shallowWater)
    })
    const grid = buildCostGrid(f)
    expect(grid.size).toBe(256)
    const route = findRoute(grid, { u: 0.1, v: 0.3 }, { u: 0.9, v: 0.3 }, 'land')
    expect(route).not.toBeNull()
    for (const p of [...dense(route!.points, f), ...curve(route!.points, f)]) expect(WATER).not.toContain(biomeAt(f, p))
    // O canal fino separa o norte do sul: não há caminho por terra.
    expect(findRoute(grid, { u: 0.1, v: 0.3 }, { u: 0.1, v: 0.7 }, 'land')).toBeNull()
  })

  it('entre duas ilhas não há caminho por terra, e a rota marítima vai pela água', () => {
    const f = field(256, (set) => {
      rect(set, 0, 0, 255, 255, BIOME.deepOcean)
      rect(set, 20, 100, 70, 150, BIOME.grassland)
      rect(set, 180, 100, 230, 150, BIOME.grassland)
    })
    const grid = buildCostGrid(f)
    const from = { u: 66 / 256, v: 0.49 }
    const to = { u: 184 / 256, v: 0.49 }
    expect(findRoute(grid, from, to, 'land')).toBeNull()
    const sea = findRoute(grid, from, to, 'sea')
    expect(sea).not.toBeNull()
    const water = dense(sea!.points, f).filter((p) => p.u > 80 / 256 && p.u < 170 / 256)
    expect(water.length).toBeGreaterThan(0)
    for (const p of water) expect(WATER).toContain(biomeAt(f, p))
  })

  it('a rota marítima não encontra o mar longe da costa', () => {
    const f = field(256, (set) => rect(set, 0, 0, 255, 20, BIOME.deepOcean))
    expect(findRoute(buildCostGrid(f), { u: 0.2, v: 0.8 }, { u: 0.8, v: 0.8 }, 'sea')).toBeNull()
  })

  it('nos mapas de seeds fixas, nenhum ponto da rota nem da curva é água', () => {
    for (const seed of ['rpg-world', 'rotas', 'arquipelago']) {
      const f = generateField(seed, 256)
      const grid = buildCostGrid(f)
      const land: RoutePoint[] = []
      for (let i = 0; i < f.biome.length && land.length < 12; i += 4099) {
        const p = { u: ((i % 256) + 0.5) / 256, v: (Math.floor(i / 256) + 0.5) / 256 }
        if (grid.cost[cellOf(grid.size, p.u, p.v)] !== Infinity) land.push(p)
      }
      expect(land.length).toBeGreaterThan(3)
      let found = 0
      for (let k = 1; k < land.length; k++) {
        const route = findRoute(grid, land[k - 1], land[k], 'land')
        if (!route) continue
        found++
        for (const p of [...dense(route.points, f), ...curve(route.points, f)]) expect(WATER, seed).not.toContain(biomeAt(f, p))
      }
      expect(found, seed).toBeGreaterThan(0)
    }
  })
})

describe('rota pelo terreno: montanhas e planícies (AC-F5-10)', () => {
  it('nos mapas de seeds fixas, a rota custa menos que a reta e passa menos por montanha e neve', () => {
    let detours = 0
    for (const seed of ['rpg-world', 'rotas', 'arquipelago', 'cordilheira']) {
      const f = generateField(seed, 256)
      const grid = buildCostGrid(f)
      /**
       * Custo da reta como caminho na grade (Bresenham, 8 vizinhos), no modelo da busca: a média do
       * custo das duas células, a inclinação e uma ponte por célula de rio. `Infinity` se a reta
       * passa pela água ou corta o canto de água ou de rio num passo na diagonal.
       */
      const straightCost = (from: RoutePoint, to: RoutePoint) => {
        const n = grid.size
        let x = Math.floor(from.u * n)
        let y = Math.floor(from.v * n)
        const tx = Math.floor(to.u * n)
        const ty = Math.floor(to.v * n)
        const dx = Math.abs(tx - x)
        const dy = -Math.abs(ty - y)
        const sx = x < tx ? 1 : -1
        const sy = y < ty ? 1 : -1
        let err = dx + dy
        let total = 0
        while (x !== tx || y !== ty) {
          const a = y * n + x
          const e2 = 2 * err
          let nx = x
          let ny = y
          if (e2 >= dy) {
            err += dy
            nx += sx
          }
          if (e2 <= dx) {
            err += dx
            ny += sy
          }
          const b = ny * n + nx
          const diagonal = nx !== x && ny !== y
          if (grid.cost[b] === Infinity) return Infinity
          if (diagonal) {
            const p = y * n + nx
            const q = ny * n + x
            if (grid.cost[p] === Infinity || grid.cost[q] === Infinity) return Infinity
            if ((grid.river[p] || grid.river[q]) && !grid.river[a] && !grid.river[b]) return Infinity
          }
          const slope = Math.abs(grid.elevation[b] - grid.elevation[a]) * n * SLOPE_COST
          const bridge = grid.river[b] && !(nx === tx && ny === ty) ? BRIDGE_COST : 0
          total += (diagonal ? Math.SQRT2 : 1) * ((grid.cost[a] + grid.cost[b]) / 2 + slope) + bridge
          x = nx
          y = ny
        }
        return total
      }
      const high: number[] = [BIOME.rockyMountain, BIOME.snow]
      const mountain = (points: RoutePoint[]) => dense(points, f).filter((p) => high.includes(biomeAt(f, p))).length
      const land: RoutePoint[] = []
      for (let i = 0; i < f.biome.length && land.length < 24; i += 2711) {
        const p = { u: ((i % 256) + 0.5) / 256, v: (Math.floor(i / 256) + 0.5) / 256 }
        if (grid.cost[cellOf(grid.size, p.u, p.v)] !== Infinity) land.push(p)
      }
      for (let k = 1; k < land.length; k++) {
        const from = land[k - 1]
        const to = land[k]
        const straight = straightCost(from, to)
        const route = findRoute(grid, from, to, 'land')
        if (!route || straight === Infinity) continue
        // A reta na grade é um caminho possível: a rota mais barata nunca custa mais que ela.
        expect(route.cost, `${seed} #${k}`).toBeLessThanOrEqual(straight + 1e-6)
        const m = mountain(route.points)
        const ms = mountain([from, to])
        expect(m, `${seed} #${k}`).toBeLessThanOrEqual(ms)
        if (ms > 0 && m < ms) detours++
      }
    }
    // Pelo menos uma reta cruza montanha ou neve, e a rota a desvia.
    expect(detours).toBeGreaterThan(0)
  })

  it('contorna uma cordilheira pelo desvio, com custo menor que o da reta', () => {
    // Uma parede de montanha rochosa e neve de cima até perto de baixo, com um desvio pelo sul.
    const f = field(256, (set) => {
      rect(set, 120, 0, 136, 200, BIOME.rockyMountain)
      rect(set, 124, 0, 132, 150, BIOME.snow)
    })
    const from = { u: 0.3, v: 0.3 }
    const to = { u: 0.7, v: 0.3 }
    const route = findRoute(buildCostGrid(f), from, to, 'land')
    expect(route).not.toBeNull()
    const pts = dense(route!.points, f)
    for (const p of pts) expect([BIOME.rockyMountain, BIOME.snow]).not.toContain(biomeAt(f, p))
    expect(Math.max(...pts.map((p) => p.v))).toBeGreaterThan(200 / 256)
    expect(polylineCost(route!.points, f)).toBeLessThan(polylineCost([from, to], f))
  })

  it('sem desvio, atravessa a cordilheira', () => {
    const f = field(256, (set) => rect(set, 120, 0, 136, 255, BIOME.rockyMountain))
    expect(findRoute(buildCostGrid(f), { u: 0.3, v: 0.5 }, { u: 0.7, v: 0.5 }, 'land')).not.toBeNull()
  })

  it('prefere a planície à floresta quando o desvio é curto', () => {
    // Uma floresta entre os pontos, com um corredor de planície um pouco ao lado.
    const f = field(256, (set) => {
      rect(set, 40, 60, 216, 200, BIOME.forest)
      rect(set, 40, 150, 216, 160, BIOME.grassland)
    })
    const route = findRoute(buildCostGrid(f), { u: 30 / 256, v: 130 / 256 }, { u: 226 / 256, v: 130 / 256 }, 'land')
    expect(route).not.toBeNull()
    const pts = dense(route!.points, f)
    const forest = pts.filter((p) => biomeAt(f, p) === BIOME.forest).length
    expect(forest / pts.length).toBeLessThan(0.35)
  })

  it('o custo pela inclinação faz a rota evitar a encosta íngreme quando há desvio plano', () => {
    const f = field(256)
    // Um morro de campo (sem bioma caro), alto no meio.
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const d = Math.hypot(x - 128, y - 128)
        f.elevation[y * 256 + x] = d < 60 ? 0.5 + (60 - d) / 60 / 2 : 0.5
      }
    }
    const route = findRoute(buildCostGrid(f), { u: 0.2, v: 0.5 }, { u: 0.8, v: 0.5 }, 'land')
    const pts = dense(route!.points, f)
    const closest = Math.min(...pts.map((p) => Math.hypot(p.u * 256 - 128, p.v * 256 - 128)))
    expect(closest).toBeGreaterThan(20)
  })
})

describe('rota pelo terreno: rios (AC-F5-11)', () => {
  const river = (x: number, y0: number, y1: number, size = 256): RoutePoint[] => {
    const line: RoutePoint[] = []
    // Um rio com curvas leves na diagonal, como os do campo (8 vizinhos).
    for (let y = y0; y <= y1; y++) line.push({ u: (x + ((y >> 3) % 2) + 0.5) / size, v: (y + 0.5) / size })
    return line
  }

  it('cruza o rio uma vez só, como ponte, quando ele corta o mapa', () => {
    const f = field(256, undefined, [river(128, 0, 255)])
    const route = findRoute(buildCostGrid(f), { u: 0.2, v: 0.3 }, { u: 0.8, v: 0.7 }, 'land')
    expect(route).not.toBeNull()
    const { entries, cells } = riverEntries(route!.points, f)
    expect(entries).toBe(1)
    expect(cells).toBeLessThanOrEqual(3)
  })

  it('não cruza o rio quando os dois pontos estão do mesmo lado, nem segue por dentro dele', () => {
    const f = field(256, undefined, [river(128, 0, 255)])
    const route = findRoute(buildCostGrid(f), { u: 0.48, v: 0.1 }, { u: 0.48, v: 0.9 }, 'land')
    expect(riverEntries(route!.points, f).entries).toBe(0)
  })

  it('contorna a nascente quando o desvio sai mais barato que a ponte', () => {
    const f = field(256, undefined, [river(128, 120, 255)])
    const route = findRoute(buildCostGrid(f), { u: 0.45, v: 0.45 }, { u: 0.55, v: 0.45 }, 'land')
    expect(riverEntries(route!.points, f).entries).toBe(0)
  })

  it('não passa entre duas células de rio na diagonal', () => {
    // Um rio só na diagonal: sem a linha 4-conectada, a rota passaria entre as células.
    const line: RoutePoint[] = []
    for (let k = 0; k < 256; k++) line.push({ u: (k + 0.5) / 256, v: (k + 0.5) / 256 })
    const f = field(256, undefined, [line])
    const route = findRoute(buildCostGrid(f), { u: 0.2, v: 0.8 }, { u: 0.8, v: 0.2 }, 'land')
    expect(riverEntries(route!.points, f).entries).toBe(1)
  })
})

describe('caminho simplificado', () => {
  it('começa e termina nos pontos exatos, com trechos de até MAX_SEGMENT células', () => {
    const f = field(256, (set) => rect(set, 100, 40, 160, 210, BIOME.lake))
    const from = { u: 0.2031, v: 0.4977 }
    const to = { u: 0.8123, v: 0.5011 }
    const { points } = findRoute(buildCostGrid(f), from, to, 'land')!
    expect(points[0]).toEqual(from)
    expect(points[points.length - 1]).toEqual(to)
    // Bem menos pontos que células do caminho.
    expect(points.length).toBeLessThan(100)
    for (let k = 1; k < points.length; k++) {
      const len = Math.hypot(points[k].u - points[k - 1].u, points[k].v - points[k - 1].v) * 256
      expect(len).toBeLessThanOrEqual(MAX_SEGMENT + 1e-9)
    }
  })

  it('os dois pontos na mesma célula dão uma rota de dois pontos', () => {
    const f = field(64)
    const route = findRoute(buildCostGrid(f), { u: 0.5, v: 0.5 }, { u: 0.501, v: 0.501 }, 'land')
    expect(route!.points).toEqual([
      { u: 0.5, v: 0.5 },
      { u: 0.501, v: 0.501 },
    ])
  })

  it('segmentCells visita as células do trecho, e as duas do canto', () => {
    const cells: number[] = []
    segmentCells(4, { x: 0.5, y: 0.5 }, { x: 2.5, y: 2.5 }, (c) => (cells.push(c), true))
    expect(cells).toEqual([0, 1, 4, 5, 6, 9, 10])
    const flat: number[] = []
    segmentCells(4, { x: 0.2, y: 1.5 }, { x: 3.7, y: 1.5 }, (c) => (flat.push(c), true))
    expect(flat).toEqual([4, 5, 6, 7])
  })
})

describe('desempenho (AC-F5-11)', () => {
  it('uma rota num mapa 1024² leva menos de 300 ms', () => {
    const f = generateField('rpg-world', 1024)
    const grid = buildCostGrid(f)
    // Pontas de terra longe uma da outra.
    const land = (u0: number, v0: number) => {
      for (let r = 0; r < 0.5; r += 0.01) {
        for (const [du, dv] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
          const p = { u: u0 + du, v: v0 + dv }
          if (p.u > 0 && p.u < 1 && p.v > 0 && p.v < 1 && grid.cost[cellOf(grid.size, p.u, p.v)] !== Infinity) return p
        }
      }
      throw new Error('sem terra')
    }
    const from = land(0.3, 0.3)
    const to = land(0.7, 0.7)
    findRoute(grid, from, to, 'land')
    const start = performance.now()
    findRoute(grid, from, to, 'land')
    expect(performance.now() - start).toBeLessThan(300)
  }, 30_000)
})
