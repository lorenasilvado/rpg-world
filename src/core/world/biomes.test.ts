import { describe, expect, it } from 'vitest'
import { BIOME, type CoreField, type WorldParams } from '../types'
import { composeTemperature, sampleClimateNoise } from './climate'
import { distanceToWater } from './coast'
import { composeElevation, sampleTerrainNoise } from './elevation'
import { elevationLevels, generateField } from './generateField'
import { DEFAULT_WORLD_PARAMS } from './params'
import { hillshade } from './shade'

const SEEDS = ['rpg-world', 'Aldebaran', '42', 'valdora', 'mar do norte']
const params = (over: Partial<WorldParams>): WorldParams => ({ ...DEFAULT_WORLD_PARAMS, ...over })
const isWater = (b: number) => b === BIOME.deepOcean || b === BIOME.shallowWater
const count = (f: CoreField, ...biomes: number[]) => f.biome.filter((b) => biomes.includes(b)).length
/** Marca as montanhas: a terra que não é praia, do limiar de montanha para cima. */
function mountainMask(f: CoreField, p: WorldParams): Uint8Array {
  const { mountainLevel } = elevationLevels(f.elevation, p)
  return Uint8Array.from(f.biome, (b, i) => (!isWater(b) && b !== BIOME.beach && f.elevation[i] >= mountainLevel ? 1 : 0))
}
/** Montanhas (rochosas e nevadas) e campos gelados, só pelo bioma de cada célula (AC-F1-25). */
function snowSplit(f: CoreField) {
  const peakSnow = count(f, BIOME.snow)
  return { peaks: count(f, BIOME.rockyMountain) + peakSnow, peakSnow, frozen: count(f, BIOME.frozenField) }
}
/** Base de desertos e florestas: a terra firme que não virou praia nem montanha (o campo gelado entra). */
const baseCells = (f: CoreField) => count(f, BIOME.grassland, BIOME.hill, BIOME.forest, BIOME.desert, BIOME.frozenField)

describe('desertos e florestas por quantil (AC-F1-03)', () => {
  it('atingem o percentual pedido, ± 2%, sobre a terra firme sem montanhas, em várias seeds', () => {
    const cases: Partial<WorldParams>[] = [
      {},
      { desert: 0, forest: 100 },
      { desert: 100, forest: 0 },
      { desert: 62, forest: 10, temperature: 85, mountains: 34 },
      { desert: 4, forest: 42, mountains: 52, temperature: 15 },
      { desert: 50, forest: 50, ocean: 70, beach: 80 },
    ]
    for (const seed of SEEDS) {
      for (const over of cases) {
        const p = params(over)
        const f = generateField(seed, 128, p)
        const base = baseCells(f)
        const label = `${seed} ${JSON.stringify(over)}`
        expect(Math.abs(count(f, BIOME.desert) / base - p.desert / 100), label).toBeLessThanOrEqual(0.02)
        expect(Math.abs(count(f, BIOME.forest) / base - p.forest / 100), label).toBeLessThanOrEqual(0.02)
      }
    }
  })

  it('com Desertos ou Florestas em 0, não há deserto ou floresta', () => {
    expect(count(generateField('rpg-world', 64, params({ desert: 0 })), BIOME.desert)).toBe(0)
    expect(count(generateField('rpg-world', 64, params({ forest: 0 })), BIOME.forest)).toBe(0)
  })

  it('a soma acima de 100% não quebra: a floresta fica com o que sobrou', () => {
    const p = params({ desert: 80, forest: 80 })
    const f = generateField('rpg-world', 64, p)
    expect(count(f, BIOME.desert) + count(f, BIOME.forest)).toBe(baseCells(f))
  })

  it('o deserto fica nas células mais secas e a floresta nas mais úmidas', () => {
    const f = generateField('rpg-world', 128)
    const mean = (b: number) => {
      let sum = 0
      let n = 0
      for (let i = 0; i < f.biome.length; i++) {
        if (f.biome[i] !== b) continue
        sum += f.moisture[i]
        n++
      }
      return sum / n
    }
    expect(mean(BIOME.desert)).toBeLessThan(mean(BIOME.grassland))
    expect(mean(BIOME.grassland)).toBeLessThan(mean(BIOME.forest))
  })
})

describe('sliders de limiar e de forma (AC-F1-24)', () => {
  const thresholdSliders: Partial<WorldParams>[] = [
    { ocean: 10 },
    { beach: 90 },
    { desert: 80 },
    { forest: 5 },
    { mountains: 90 },
    { snow: 0 },
    { temperature: 100 },
  ]

  it('os sete sliders de limiar não mudam a elevação gerada pela seed, em várias seeds', () => {
    for (const seed of SEEDS) {
      const base = generateField(seed, 64).elevation
      for (const over of thresholdSliders) {
        expect(generateField(seed, 64, params(over)).elevation, `${seed} ${JSON.stringify(over)}`).toEqual(base)
      }
    }
  })

  it('os sete sliders de limiar não mudam a umidade, e mudam o mapa só pelos limiares', () => {
    // Em 128²: no 64², a faixa de praia é de 1 célula tanto em 30 quanto em 90.
    const base = generateField('rpg-world', 128)
    for (const over of thresholdSliders) {
      const f = generateField('rpg-world', 128, params(over))
      expect(f.moisture, JSON.stringify(over)).toEqual(base.moisture)
      expect(f.biome, JSON.stringify(over)).not.toEqual(base.biome)
    }
  })

  it('Tamanho do continente e Rugosidade da costa só mudam o peso das camadas de ruído da seed', () => {
    const noise = sampleTerrainNoise('rpg-world', 64)
    for (const over of [{ continentSize: 0 }, { continentSize: 100 }, { coastRoughness: 0 }, { coastRoughness: 100 }]) {
      const p = params(over)
      const f = generateField('rpg-world', 64, p)
      // A mesma amostra de ruído, só recombinada: nenhuma camada é amostrada de novo.
      expect(f.elevation, JSON.stringify(over)).toEqual(composeElevation(noise, p))
      expect(f.elevation, JSON.stringify(over)).not.toEqual(generateField('rpg-world', 64).elevation)
    }
  })
})

describe('montanhas e neve por percentil', () => {
  it('a neve fica nas montanhas mais frias, na proporção do slider Neve', () => {
    for (const snow of [0, 25, 40, 80, 100]) {
      const p = params({ snow })
      const { peaks, peakSnow } = snowSplit(generateField('Aldebaran', 128, p))
      expect(Math.abs(peakSnow / peaks - snow / 100), `Neve ${snow}`).toBeLessThanOrEqual(0.01)
    }
    const f = generateField('Aldebaran', 128)
    let warmestSnow = -Infinity
    let coldestRock = Infinity
    for (let i = 0; i < f.biome.length; i++) {
      if (f.biome[i] === BIOME.snow) warmestSnow = Math.max(warmestSnow, f.temperature[i])
      if (f.biome[i] === BIOME.rockyMountain) coldestRock = Math.min(coldestRock, f.temperature[i])
    }
    expect(warmestSnow).toBeLessThanOrEqual(coldestRock)
  })

  it('Temperatura global mais baixa dá mais neve nas montanhas; mais alta, menos', () => {
    const peakSnowAt = (temperature: number) => {
      const p = params({ temperature })
      return snowSplit(generateField('rpg-world', 128, p)).peakSnow
    }
    expect(peakSnowAt(0)).toBeGreaterThan(peakSnowAt(50))
    expect(peakSnowAt(50)).toBeGreaterThan(peakSnowAt(100))
  })

  it('mais Montanhas dá mais montanha', () => {
    const peaksAt = (mountains: number) => {
      const p = params({ mountains })
      return snowSplit(generateField('rpg-world', 128, p)).peaks
    }
    expect(peaksAt(0)).toBe(0)
    expect(peaksAt(30)).toBeGreaterThan(0)
    expect(peaksAt(90)).toBeGreaterThan(peaksAt(30))
  })
})

describe('campo gelado pela Temperatura global', () => {
  it('mais fria dá mais campo gelado; em 100 não há nenhum, em várias seeds', () => {
    for (const seed of SEEDS) {
      const frozenAt = (temperature: number) => {
        const p = params({ temperature })
        return snowSplit(generateField(seed, 128, p)).frozen
      }
      expect(frozenAt(0), seed).toBeGreaterThan(frozenAt(50))
      expect(frozenAt(50), seed).toBeGreaterThanOrEqual(frozenAt(100))
      expect(frozenAt(100), seed).toBe(0)
    }
  })

  it('muda o mapa também sem montanhas, sem mexer em desertos e florestas', () => {
    for (const seed of SEEDS) {
      const at = (temperature: number) => generateField(seed, 128, params({ mountains: 0, temperature }))
      const cold = at(20)
      const warm = at(80)
      expect(cold.biome, seed).not.toEqual(warm.biome)
      expect(count(cold, BIOME.desert), seed).toBe(count(warm, BIOME.desert))
      expect(count(cold, BIOME.forest), seed).toBe(count(warm, BIOME.forest))
    }
  })

  it('o campo gelado fica nas células mais frias do campo', () => {
    const p = params({ temperature: 20 })
    const f = generateField('valdora', 128, p)
    let warmestFrozen = -Infinity
    let coldestField = Infinity
    for (let i = 0; i < f.biome.length; i++) {
      if (f.biome[i] === BIOME.frozenField) warmestFrozen = Math.max(warmestFrozen, f.temperature[i])
      if (f.biome[i] === BIOME.grassland || f.biome[i] === BIOME.hill) coldestField = Math.min(coldestField, f.temperature[i])
    }
    expect(warmestFrozen).toBeGreaterThan(-Infinity)
    expect(warmestFrozen).toBeLessThan(coldestField)
  })
})

describe('neve de montanha e campo gelado são biomas distintos (AC-F1-25)', () => {
  it('a neve fica só nas montanhas e o campo gelado só fora delas, sem recalcular limiares', () => {
    for (const seed of SEEDS) {
      for (const over of [{}, { temperature: 0 }, { temperature: 20, snow: 80 }, { mountains: 70, temperature: 10 }]) {
        const p = params(over)
        const f = generateField(seed, 128, p)
        // O teste recalcula os limiares só para conferir: quem lê o campo não precisa.
        const mountain = mountainMask(f, p)
        const label = `${seed} ${JSON.stringify(over)}`
        for (let i = 0; i < f.biome.length; i++) {
          if (f.biome[i] === BIOME.snow) expect(mountain[i], label).toBe(1)
          if (f.biome[i] === BIOME.frozenField) expect(mountain[i], label).toBe(0)
        }
      }
    }
  })

  it('com Neve em 0 não há neve de montanha, e o campo gelado continua identificável', () => {
    for (const seed of SEEDS) {
      const f = generateField(seed, 128, params({ snow: 0, temperature: 0 }))
      expect(count(f, BIOME.snow), seed).toBe(0)
      expect(count(f, BIOME.frozenField), seed).toBeGreaterThan(0)
    }
  })

  it('o slider Neve só muda a neve das montanhas: o campo gelado fica igual', () => {
    for (const seed of SEEDS) {
      const at = (snow: number) => generateField(seed, 128, params({ snow, temperature: 20 }))
      const base = at(40)
      const frozen = (f: CoreField) => Uint8Array.from(f.biome, (b) => (b === BIOME.frozenField ? 1 : 0))
      for (const snow of [0, 100]) {
        const f = at(snow)
        expect(frozen(f), `${seed} Neve ${snow}`).toEqual(frozen(base))
        expect(count(f, BIOME.snow), `${seed} Neve ${snow}`).not.toBe(count(base, BIOME.snow))
      }
    }
  })
})

describe('praias por distância da costa', () => {
  it('ficam junto da água, e a faixa cresce com o slider Praias', () => {
    const beachAt = (beach: number) => count(generateField('rpg-world', 128, params({ beach })), BIOME.beach)
    expect(beachAt(0)).toBe(0)
    expect(beachAt(10)).toBeGreaterThan(0)
    expect(beachAt(60)).toBeGreaterThan(beachAt(10))
    expect(beachAt(100)).toBeGreaterThan(beachAt(60))
  })

  it('toda praia tem água a no máximo a largura da faixa', () => {
    const size = 128
    const f = generateField('valdora', size, params({ beach: 50 }))
    const water = Uint8Array.from(f.biome, (b) => (isWater(b) ? 1 : 0))
    const distance = distanceToWater(water, size)
    for (let i = 0; i < f.biome.length; i++) {
      if (f.biome[i] === BIOME.beach) expect(distance[i]).toBeLessThanOrEqual(Math.max(1, 0.5 * 0.02 * size))
    }
  })

  it('a distância até a água é chanfrada: 1 por passo reto, 4/3 por diagonal', () => {
    const size = 5
    const water = new Uint8Array(size * size)
    water[2 * size + 2] = 1
    const d = distanceToWater(water, size)
    expect(d[2 * size + 2]).toBe(0)
    expect(d[2 * size + 3]).toBe(1)
    expect(d[3 * size + 3]).toBeCloseTo(4 / 3)
    expect(d[2 * size + 4]).toBe(2)
    expect(d[0]).toBeCloseTo(8 / 3)
  })
})

describe('clima', () => {
  it('a umidade só depende da seed e fica entre 0 e 1', () => {
    const a = sampleClimateNoise('rpg-world', 32)
    expect(sampleClimateNoise('rpg-world', 32)).toEqual(a)
    expect(sampleClimateNoise('outra', 32).moisture).not.toEqual(a.moisture)
    for (const m of a.moisture) {
      expect(m).toBeGreaterThanOrEqual(0)
      expect(m).toBeLessThanOrEqual(1)
    }
  })

  it('a temperatura cai com a altitude e com a distância do equador, e sobe com a Temperatura global', () => {
    const size = 32
    const climate = { size, moisture: new Float32Array(size * size), heat: new Float32Array(size * size) }
    const flat = new Float32Array(size * size).fill(0.3)
    const t = composeTemperature(climate, flat, 50)
    const equator = (size / 2) * size + 5
    const pole = 5
    expect(t[equator]).toBeGreaterThan(t[pole])
    const high = flat.slice()
    high[equator] = 0.9
    expect(composeTemperature(climate, high, 50)[equator]).toBeLessThan(t[equator])
    expect(composeTemperature(climate, flat, 100)[equator]).toBeGreaterThan(t[equator])
    expect(composeTemperature(climate, flat, 0)[equator]).toBeLessThan(t[equator])
  })
})

describe('hillshade', () => {
  it('é um Int8Array: encosta virada para o noroeste clara, para o sudeste escura, água e plano em 0', () => {
    const size = 16
    const water = new Uint8Array(size * size)
    // Rampa que sobe para o sudeste: a encosta olha para o noroeste, de onde vem a luz.
    const ramp = new Float32Array(size * size)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) ramp[y * size + x] = (x + y) / (4 * size)
    const lit = hillshade(ramp, water, size)
    expect(lit).toBeInstanceOf(Int8Array)
    expect(lit[8 * size + 8]).toBeGreaterThan(0)
    const down = hillshade(ramp.map((e) => 1 - e), water, size)
    expect(down[8 * size + 8]).toBeLessThan(0)
    expect(hillshade(new Float32Array(size * size).fill(0.5), water, size).every((s) => s === 0)).toBe(true)
    water.fill(1)
    expect(hillshade(ramp, water, size).every((s) => s === 0)).toBe(true)
  })

  it('no campo gerado, a terra tem sombra e luz, e a água fica em 0', () => {
    const f = generateField('rpg-world', 128)
    let lit = 0
    let dark = 0
    for (let i = 0; i < f.shade.length; i++) {
      if (isWater(f.biome[i])) expect(f.shade[i]).toBe(0)
      else if (f.shade[i] > 0) lit++
      else if (f.shade[i] < 0) dark++
    }
    expect(lit).toBeGreaterThan(0)
    expect(dark).toBeGreaterThan(0)
  })
})
