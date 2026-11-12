import { describe, expect, it } from 'vitest'
import { BIOME, type CoreField } from '../../core/types'
import { generateField } from '../../core/world/generateField'
import { BIOMES, BIOME_TONES, COAST_STROKE, RIVER_STYLE } from '../style/palette'
import { REF_SIZE, terrainPixels } from './terrainPixels'

/** Campo sintético: oceano profundo, com `paint` decidindo bioma e sombra de cada célula. */
function field(size: number, paint: (x: number, y: number) => [number, number] | null = () => null): CoreField {
  const n = size * size
  const biome = new Uint8Array(n).fill(BIOME.deepOcean)
  const shade = new Int8Array(n)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = paint(x, y)
      if (cell) [biome[y * size + x], shade[y * size + x]] = cell
    }
  }
  return {
    width: size,
    height: size,
    elevation: new Float32Array(n),
    moisture: new Float32Array(n),
    temperature: new Float32Array(n),
    biome,
    shade,
    rivers: [],
    decor: { u: new Float32Array(0), v: new Float32Array(0), kind: new Uint8Array(0) },
  }
}

const hex = (rgba: Uint8ClampedArray, i: number) =>
  '#' + [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]].map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')
const tones = (b: (typeof BIOMES)[number]) => BIOME_TONES[b]
const at = (size: number, x: number, y: number) => y * size + x
const rgbOf = (color: string) => [1, 3, 5].map((k) => Number.parseInt(color.slice(k, k + 2), 16))
const WATER_TONES = [...BIOME_TONES.deepOcean, ...BIOME_TONES.shallowWater]
/** A cor fica entre a do rio e algum tom da água, canal a canal (com 1 de arredondamento). */
const betweenRiverAndWater = (color: string) => {
  const c = rgbOf(color)
  const r = rgbOf(RIVER_STYLE.color)
  return WATER_TONES.some((tone) => {
    const t = rgbOf(tone)
    return c.every((v, k) => v >= Math.min(r[k], t[k]) - 1 && v <= Math.max(r[k], t[k]) + 1)
  })
}
/** Largura do rio na coluna x (em volta da linha y), contando as células fora da cor do campo. */
const riverWidth = (rgba: Uint8ClampedArray, size: number, x: number, y: number, land: readonly string[]) => {
  let width = 0
  for (let dy = -12; dy <= 12; dy++) if (!land.includes(hex(rgba, at(size, x, y + dy)))) width++
  return width
}

describe('terreno em textura (AC-F1-22)', () => {
  it('desenha uma célula por pixel, opaca, só com as cores da paleta, da costa e dos rios', () => {
    const f = generateField('valdora', 128)
    const rgba = terrainPixels(f, 'valdora')
    expect(rgba.length).toBe(128 * 128 * 4)
    const allowed = new Set([
      ...BIOMES.flatMap((b) => BIOME_TONES[b]),
      COAST_STROKE.color,
      RIVER_STYLE.color,
    ])
    for (let i = 0; i < 128 * 128; i++) {
      expect(rgba[i * 4 + 3]).toBe(255)
      // Na foz, a cor do rio passa para a da água: fica entre as duas, canal a canal.
      const color = hex(rgba, i)
      expect(allowed.has(color) || betweenRiverAndWater(color)).toBe(true)
    }
  })

  it('cada célula fora da costa e dos rios tem um dos 3 tons do seu bioma (paleta posterizada)', () => {
    const f = generateField('valdora', 128)
    f.rivers = []
    const rgba = terrainPixels(f, 'valdora')
    for (let i = 0; i < f.biome.length; i++) {
      const color = hex(rgba, i)
      if (color === COAST_STROKE.color) continue
      expect(BIOME_TONES[BIOMES[f.biome[i]]]).toContain(color)
    }
  })

  it('pinta a água encostada na terra com o traço da costa, também em volta dos lagos', () => {
    // Ilha de campo no meio (x e y de 24 a 39) com um lago de 4×4 dentro.
    const size = 64
    const f = field(size, (x, y) => {
      if (x >= 30 && x < 34 && y >= 30 && y < 34) return [BIOME.lake, 0]
      if (x >= 24 && x < 40 && y >= 24 && y < 40) return [BIOME.grassland, 0]
      return null
    })
    const rgba = terrainPixels(f)
    expect(hex(rgba, at(size, 23, 30))).toBe(COAST_STROKE.color)
    expect(hex(rgba, at(size, 40, 30))).toBe(COAST_STROKE.color)
    expect(hex(rgba, at(size, 30, 30))).toBe(COAST_STROKE.color)
    expect(hex(rgba, at(size, 2, 2))).not.toBe(COAST_STROKE.color)
    expect(tones('deepOcean')).toContain(hex(rgba, at(size, 2, 2)))
  })

  it('a costa tem 2 células no mapa 1024² e 1 na prévia', () => {
    const coastWidth = (size: number) => {
      const half = size / 2
      const f = field(size, (x) => (x >= half ? [BIOME.grassland, 0] : null))
      const rgba = terrainPixels(f)
      let count = 0
      for (let x = 0; x < half; x++) if (hex(rgba, at(size, x, half)) === COAST_STROKE.color) count++
      return count
    }
    expect(coastWidth(REF_SIZE)).toBe(2)
    expect(coastWidth(256)).toBe(1)
  })

  it('na prévia 256², a água que só encosta na terra pela diagonal também recebe a costa', () => {
    const size = 256
    // Uma célula de terra em (100, 100): a água em (101, 101) só a toca pela diagonal.
    const f = field(size, (x, y) => (x === 100 && y === 100 ? [BIOME.beach, 0] : null))
    const rgba = terrainPixels(f)
    expect(hex(rgba, at(size, 101, 101))).toBe(COAST_STROKE.color)
    expect(hex(rgba, at(size, 101, 100))).toBe(COAST_STROKE.color)
    expect(hex(rgba, at(size, 102, 102))).not.toBe(COAST_STROKE.color)
    // A praia junto da água fica com o tom de luz, na prévia e no mapa final.
    expect(hex(rgba, at(size, 100, 100))).toBe(tones('beach')[2])
  })

  it('a praia que só toca a água pela diagonal tem o tom de luz', () => {
    const size = REF_SIZE
    // Bloco de praia de 10×10 com terra (campo) em volta, e uma célula de água no canto de fora.
    const f = field(size, (x, y) => {
      if (x === 509 && y === 509) return null
      if (x >= 500 && x < 520 && y >= 500 && y < 520) return x >= 510 && y >= 510 ? [BIOME.beach, 0] : [BIOME.grassland, 0]
      return [BIOME.grassland, 0]
    })
    const rgba = terrainPixels(f)
    expect(hex(rgba, at(size, 510, 510))).toBe(tones('beach')[2])
    expect(hex(rgba, at(size, 512, 512))).toBe(tones('beach')[1])
  })

  it('a água rasa clareia junto do traço da costa: luz logo depois dele, base e sombra mais longe', () => {
    const size = REF_SIZE
    // Terra à direita; água rasa nas 160 colunas antes dela. A costa ocupa as 2 últimas (798 e 799).
    const f = field(size, (x) => (x >= 800 ? [BIOME.grassland, 0] : x >= 640 ? [BIOME.shallowWater, 0] : null))
    const rgba = terrainPixels(f)
    const [shadow, base, light] = tones('shallowWater')
    expect(hex(rgba, at(size, 798, 100))).toBe(COAST_STROKE.color)
    // 6 células de luz depois da costa (797 a 792), base até 16 (791 a 782), depois sombra.
    expect(hex(rgba, at(size, 797, 100))).toBe(light)
    expect(hex(rgba, at(size, 792, 100))).toBe(light)
    expect(hex(rgba, at(size, 791, 100))).toBe(base)
    expect(hex(rgba, at(size, 782, 100))).toBe(base)
    expect(hex(rgba, at(size, 781, 100))).toBe(shadow)
    // O oceano profundo logo depois do anel fica com o tom de luz.
    expect(hex(rgba, at(size, 639, 100))).toBe(tones('deepOcean')[2])
  })

  it('na prévia 256², a faixa clara também aparece depois da costa', () => {
    const size = 256
    const f = field(size, (x) => (x >= 200 ? [BIOME.grassland, 0] : x >= 160 ? [BIOME.shallowWater, 0] : null))
    const rgba = terrainPixels(f)
    expect(hex(rgba, at(size, 199, 100))).toBe(COAST_STROKE.color)
    expect(hex(rgba, at(size, 198, 100))).toBe(tones('shallowWater')[2])
  })

  it('o hillshade clareia a encosta virada para a luz e escurece a outra, mais forte no relevo', () => {
    const size = 64
    const f = field(size, (x, y) => {
      if (x < 8 || x >= 56 || y < 8 || y >= 56) return null
      const relief = y < 32
      const kind = relief ? BIOME.rockyMountain : BIOME.grassland
      return [kind, x < 32 ? 127 : -127]
    })
    // O hillshade em ±127 pesa mais que as manchas no relevo.
    const rgba = terrainPixels(f, 'sem-manchas')
    const [shadow, , light] = tones('rockyMountain')
    expect(hex(rgba, at(size, 20, 20))).toBe(light)
    expect(hex(rgba, at(size, 44, 20))).toBe(shadow)
  })

  it('desenha os rios na terra, sem contorno, e abre a costa na foz', () => {
    const size = REF_SIZE
    const f = field(size, (x) => (x >= 100 ? [BIOME.grassland, 0] : null))
    const y = 500.5 / size
    f.rivers = [[{ u: 900.5 / size, v: y }, { u: 500.5 / size, v: y }, { u: 99.5 / size, v: y }]]
    const rgba = terrainPixels(f)
    expect(hex(rgba, at(size, 300, 500))).toBe(RIVER_STYLE.color)
    expect(hex(rgba, at(size, 300, 501))).toBe(RIVER_STYLE.color)
    // Sem contorno: logo depois do miolo já é o campo.
    expect(tones('grassland')).toContain(hex(rgba, at(size, 300, 502)))
    expect(tones('grassland')).toContain(hex(rgba, at(size, 300, 498)))
    // Na foz, o traço da costa dá lugar ao rio, já com a cor da água; ao lado, a costa continua.
    expect(hex(rgba, at(size, 99, 500))).toBe(hex(rgba, at(size, 97, 500)))
    expect(hex(rgba, at(size, 98, 500))).toBe(hex(rgba, at(size, 97, 500)))
    expect(hex(rgba, at(size, 99, 515))).toBe(COAST_STROKE.color)
    // Fora da costa, a água não recebe o rio.
    expect(hex(rgba, at(size, 50, 500))).not.toBe(RIVER_STYLE.color)
    expect(hex(rgba, at(size, 97, 500))).not.toBe(RIVER_STYLE.color)
  })

  it('o rio afina perto da nascente', () => {
    const size = REF_SIZE
    const f = field(size, () => [BIOME.grassland, 0])
    const y = 500.5 / size
    f.rivers = [Array.from({ length: 9 }, (_, k) => ({ u: (100.5 + k * 100) / size, v: y }))]
    const rgba = terrainPixels(f)
    // Largura do miolo, em células.
    const width = (x: number) => {
      let w = 0
      for (let dy = -10; dy <= 10; dy++) if (hex(rgba, at(size, x, 500 + dy)) === RIVER_STYLE.color) w++
      return w
    }
    expect(width(110)).toBeLessThan(width(890))
  })

  it('não desenha rio sobre montanha rochosa nem neve: ele aparece a partir do pé da montanha (AC-F1-26)', () => {
    const size = REF_SIZE
    // Neve de x 800 em diante, montanha rochosa de 650 a 799, colina de 600 a 649, campo até a água.
    const f = field(size, (x) =>
      x >= 800 ? [BIOME.snow, 0] : x >= 650 ? [BIOME.rockyMountain, 0] : x >= 600 ? [BIOME.hill, 0] : x >= 100 ? [BIOME.grassland, 0] : null,
    )
    const y = 500.5 / size
    f.rivers = [Array.from({ length: 851 }, (_, k) => ({ u: (950.5 - k) / size, v: y }))]
    const rgba = terrainPixels(f)
    const river = (x: number, yy: number) => hex(rgba, at(size, x, yy)) === RIVER_STYLE.color
    for (let x = 650; x < size; x++) for (let dy = -6; dy <= 6; dy++) expect(river(x, 500 + dy)).toBe(false)
    // Na colina, logo no pé da montanha, o rio já aparece, mais fino que perto da foz.
    expect(river(648, 500)).toBe(true)
    const land = [...tones('grassland'), ...tones('hill')]
    expect(riverWidth(rgba, size, 645, 500, land)).toBeLessThan(riverWidth(rgba, size, 120, 500, land))
  })

  it('o rio que só passa por montanha e neve até a água não aparece (AC-F1-26)', () => {
    const size = 256
    const f = field(size, (x) => (x >= 100 ? [x >= 150 ? BIOME.snow : BIOME.rockyMountain, 0] : null))
    const y = 100.5 / size
    f.rivers = [Array.from({ length: 101 }, (_, k) => ({ u: (199.5 - k) / size, v: y }))]
    const withRiver = terrainPixels(f)
    f.rivers = []
    expect(withRiver).toEqual(terrainPixels(f))
  })

  it('na foz, o rio alarga aos poucos e a cor passa suavemente para a da água, sem degrau (AC-F1-27)', () => {
    const size = REF_SIZE
    // Campo de x 100 em diante; água rasa antes, até o oceano profundo.
    const f = field(size, (x) => (x >= 100 ? [BIOME.grassland, 0] : x >= 40 ? [BIOME.shallowWater, 0] : null))
    const y = 500.5 / size
    f.rivers = [Array.from({ length: 802 }, (_, k) => ({ u: (900.5 - k) / size, v: y }))]
    const rgba = terrainPixels(f)
    const land = tones('grassland')
    // Largura: cresce aos poucos nas últimas células, sem saltos.
    const widths = Array.from({ length: 20 }, (_, k) => riverWidth(rgba, size, 119 - k, 500, land))
    for (let k = 1; k < widths.length; k++) {
      expect(widths[k]).toBeGreaterThanOrEqual(widths[k - 1])
      expect(widths[k] - widths[k - 1]).toBeLessThanOrEqual(2)
    }
    expect(widths[widths.length - 1]).toBeGreaterThan(widths[0])
    // Cor: no miolo, longe da foz, é a do rio; até a costa, vai para a da água rasa clara, aos poucos.
    expect(hex(rgba, at(size, 200, 500))).toBe(RIVER_STYLE.color)
    const water = tones('shallowWater')[2]
    expect(hex(rgba, at(size, 97, 500))).toBe(water)
    expect(hex(rgba, at(size, 98, 500))).toBe(water)
    expect(hex(rgba, at(size, 99, 500))).toBe(water)
    const target = rgbOf(water)
    const gap = (x: number) => rgbOf(hex(rgba, at(size, x, 500))).reduce((sum, v, k) => sum + Math.abs(v - target[k]), 0)
    for (let x = 100; x < 130; x++) {
      expect(gap(x)).toBeGreaterThanOrEqual(gap(x - 1))
      expect(gap(x) - gap(x - 1)).toBeLessThanOrEqual(12)
    }
  })

  it('o afluente, que termina em outro rio, não alarga nem muda de cor no encontro', () => {
    const size = REF_SIZE
    const f = field(size, () => [BIOME.grassland, 0])
    const y = 500.5 / size
    f.rivers = [Array.from({ length: 401 }, (_, k) => ({ u: (700.5 - k) / size, v: y }))]
    const rgba = terrainPixels(f)
    const land = tones('grassland')
    expect(hex(rgba, at(size, 302, 500))).toBe(RIVER_STYLE.color)
    expect(riverWidth(rgba, size, 305, 500, land)).toBe(riverWidth(rgba, size, 340, 500, land))
  })

  it('as faixas do oceano acompanham a forma da costa, sem degraus retangulares', () => {
    // Uma célula de água rasa no meio do oceano: a faixa de luz em volta dela é arredondada, então
    // na diagonal ela acaba antes do que na reta (numa distância de 8 vizinhos, seria um quadrado).
    const size = REF_SIZE
    const f = field(size, (x, y) => (x === 512 && y === 512 ? [BIOME.shallowWater, 0] : null))
    const rgba = terrainPixels(f)
    const [, base, light] = tones('deepOcean')
    expect(hex(rgba, at(size, 512 + 11, 512))).toBe(light)
    expect(hex(rgba, at(size, 512 + 11, 512 + 11))).toBe(base)
  })

  it('é determinístico: mesmo campo e mesma seed dão os mesmos pixels', () => {
    const f = generateField('valdora', 64)
    expect(terrainPixels(f, 'valdora')).toEqual(terrainPixels(f, 'valdora'))
  })
})
