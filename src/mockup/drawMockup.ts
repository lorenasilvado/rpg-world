import { DECOR_BY_BIOME, DECOR_DENSITY, DECOR_FRAMES, DECOR_FRAME_SIZE, DECOR_SIZE } from '../render/style/decor'
import { BIOMES, BIOME_TONES, CANVAS_BACKGROUND, COAST_STROKE, hexToRgb } from '../render/style/palette'
import { seededRandom, type MockTerrain } from './terrain'

/** Pixels por célula do terreno no mockup (dá o contorno levemente pixelado da referência). */
export const CELL_PX = 4

/** RGBA de cada célula: o tom do bioma, chapado. */
export function terrainPixels(t: MockTerrain): Uint8ClampedArray<ArrayBuffer> {
  const rgb = BIOMES.map((b) => BIOME_TONES[b].map(hexToRgb))
  const out = new Uint8ClampedArray(new ArrayBuffer(t.width * t.height * 4))
  for (let i = 0; i < t.biome.length; i++) {
    const [r, g, b] = rgb[t.biome[i]][t.tone[i]]
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  }
  return out
}

/** Segmentos da costa (em células): as arestas entre uma célula de terra e uma de água. */
export function coastSegments(t: MockTerrain): [number, number, number, number][] {
  const segs: [number, number, number, number][] = []
  const landAt = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < t.width && y < t.height ? t.land[y * t.width + x] : 0
  for (let y = 0; y < t.height; y++) {
    for (let x = 0; x < t.width; x++) {
      if (!landAt(x, y)) continue
      if (!landAt(x + 1, y)) segs.push([x + 1, y, x + 1, y + 1])
      if (!landAt(x - 1, y)) segs.push([x, y, x, y + 1])
      if (!landAt(x, y + 1)) segs.push([x, y + 1, x + 1, y + 1])
      if (!landAt(x, y - 1)) segs.push([x, y, x + 1, y])
    }
  }
  return segs
}

export type DecorPlacement = { kind: keyof typeof DECOR_FRAMES; x: number; y: number }

/** Posições dos ícones (em células), por amostragem em grade com jitter, ordenadas por y. */
export function placeDecor(t: MockTerrain, seed: string, spacing = 5): DecorPlacement[] {
  const rand = seededRandom(`${seed}:decor`)
  const out: DecorPlacement[] = []
  for (let gy = 0; gy < t.height; gy += spacing) {
    for (let gx = 0; gx < t.width; gx += spacing) {
      const x = gx + rand() * spacing
      const y = gy + rand() * spacing
      const pick = rand()
      const cx = Math.floor(x)
      const cy = Math.floor(y)
      if (cx >= t.width || cy >= t.height) continue
      const kinds = DECOR_BY_BIOME[BIOMES[t.biome[cy * t.width + cx]]]
      if (kinds.length === 0) continue
      const kind = kinds[Math.floor(pick * kinds.length)]
      if (rand() > DECOR_DENSITY[kind]) continue
      out.push({ kind, x, y })
    }
  }
  return out.sort((a, b) => a.y - b.y)
}

/**
 * Desenha o mockup num canvas: terreno chapado, contorno de costa e ícones.
 * O mapa cabe inteiro no canvas (contain), centrado, sobre o fundo do canvas.
 */
export function drawMockup(
  canvas: HTMLCanvasElement,
  terrain: MockTerrain,
  decor: DecorPlacement[],
  sheet: CanvasImageSource,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
) {
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = CANVAS_BACKGROUND
  ctx.fillRect(0, 0, cssWidth, cssHeight)

  const mapW = terrain.width * CELL_PX
  const mapH = terrain.height * CELL_PX
  const scale = Math.min(cssWidth / mapW, cssHeight / mapH)
  const ox = (cssWidth - mapW * scale) / 2
  const oy = (cssHeight - mapH * scale) / 2
  const cell = CELL_PX * scale

  const tile = document.createElement('canvas')
  tile.width = terrain.width
  tile.height = terrain.height
  tile.getContext('2d')?.putImageData(new ImageData(terrainPixels(terrain), terrain.width, terrain.height), 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tile, ox, oy, mapW * scale, mapH * scale)

  ctx.beginPath()
  for (const [x0, y0, x1, y1] of coastSegments(terrain)) {
    ctx.moveTo(ox + x0 * cell, oy + y0 * cell)
    ctx.lineTo(ox + x1 * cell, oy + y1 * cell)
  }
  ctx.strokeStyle = COAST_STROKE.color
  ctx.lineWidth = COAST_STROKE.width
  ctx.lineCap = 'square'
  ctx.stroke()

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  for (const d of decor) {
    const size = DECOR_SIZE[d.kind] * scale
    const f = DECOR_FRAMES[d.kind]
    const px = ox + d.x * cell
    const py = oy + d.y * cell
    // Âncora na base central do quadro (o pé do ícone fica perto da borda de baixo).
    ctx.drawImage(sheet, f.x, f.y, DECOR_FRAME_SIZE, DECOR_FRAME_SIZE, px - size / 2, py - size, size, size)
  }
}
