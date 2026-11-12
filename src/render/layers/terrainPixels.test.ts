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

describe('terreno em textura (AC-F1-22)', () => {
  it('desenha uma célula por pixel, opaca, só com as cores da paleta, da costa e dos rios', () => {
    const f = generateField('valdora', 128)
    const rgba = terrainPixels(f, 'valdora')
    expect(rgba.length).toBe(128 * 128 * 4)
    const allowed = new Set([
      ...BIOMES.flatMap((b) => BIOME_TONES[b]),
      COAST_STROKE.color,
      RIVER_STYLE.color,
      RIVER_STYLE.outline,
    ])
    for (let i = 0; i < 128 * 128; i++) {
      expect(rgba[i * 4 + 3]).toBe(255)
      expect(allowed.has(hex(rgba, i))).toBe(true)
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

  it('desenha os rios na terra, com o miolo e o contorno, e não por cima da água', () => {
    const size = REF_SIZE
    const f = field(size, (x) => (x >= 100 ? [BIOME.grassland, 0] : null))
    const y = 500.5 / size
    f.rivers = [[{ u: 900.5 / size, v: y }, { u: 500.5 / size, v: y }, { u: 99.5 / size, v: y }]]
    const rgba = terrainPixels(f)
    expect(hex(rgba, at(size, 300, 500))).toBe(RIVER_STYLE.color)
    expect(hex(rgba, at(size, 300, 501))).toBe(RIVER_STYLE.color)
    expect(hex(rgba, at(size, 300, 502))).toBe(RIVER_STYLE.outline)
    expect(hex(rgba, at(size, 300, 498))).toBe(RIVER_STYLE.outline)
    expect(tones('grassland')).toContain(hex(rgba, at(size, 300, 504)))
    // Na água, o rio não é pintado.
    expect(hex(rgba, at(size, 99, 500))).toBe(COAST_STROKE.color)
    expect(hex(rgba, at(size, 50, 500))).not.toBe(RIVER_STYLE.color)
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
