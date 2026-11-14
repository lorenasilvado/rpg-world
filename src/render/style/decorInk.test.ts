import { describe, expect, it } from 'vitest'
import { DECOR_RULES } from '../../core/decor/decor'
import { DECOR } from '../../core/types'
import {
  DECOR_UNIT,
  DECOR_VARIANTS,
  DECOR_WORLD_SIZE,
  INK_CELL,
  INK_CELL_SIZE,
  INK_FRAME_PX,
  INK_KINDS,
  INK_PX,
  INK_SHEET,
  decorVariant,
  drawDecorIcon,
  drawDecorSheet,
  inkFrame,
  variantShape,
  type Ink,
} from './decorInk'

/**
 * Contexto 2D falso (o jsdom não desenha): guarda cada ponto tocado, já na escala e no
 * deslocamento atuais, as cores usadas e quantos traços e preenchimentos houve. Os pontos depois
 * de um `clip` não contam: o canvas recorta o traço na forma já guardada (a hachura).
 */
function recorder() {
  const points: Array<[number, number]> = []
  const colors = new Set<string>()
  let t = [1, 0, 0, 1, 0, 0]
  let marks = 0
  let depth = 0
  let clippedAt = -1
  const at = (x: number, y: number) => {
    if (clippedAt >= 0) return
    points.push([t[0] * x + t[4], t[3] * y + t[5]])
  }
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    beginPath() {},
    closePath() {},
    moveTo: at,
    lineTo: at,
    quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
      at(cx, cy)
      at(x, y)
    },
    bezierCurveTo(ax: number, ay: number, bx: number, by: number, x: number, y: number) {
      at(ax, ay)
      at(bx, by)
      at(x, y)
    },
    arc(x: number, y: number, r: number) {
      at(x - r, y - r)
      at(x + r, y + r)
    },
    fillRect(x: number, y: number, w: number, h: number) {
      at(x, y)
      at(x + w, y + h)
      marks++
      colors.add(String(ctx.fillStyle))
    },
    fill() {
      marks++
      colors.add(String(ctx.fillStyle))
    },
    stroke() {
      marks++
      colors.add(String(ctx.strokeStyle))
    },
    clip() {
      if (clippedAt < 0) clippedAt = depth
    },
    save() {
      depth++
    },
    restore() {
      if (clippedAt === depth) clippedAt = -1
      depth--
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      t = [a, b, c, d, e, f]
    },
  }
  const bounds = () => ({
    left: Math.min(...points.map((p) => p[0])),
    right: Math.max(...points.map((p) => p[0])),
    top: Math.min(...points.map((p) => p[1])),
    bottom: Math.max(...points.map((p) => p[1])),
  })
  return { ctx: ctx as unknown as Ink, points, colors, bounds, marks: () => marks, depth: () => depth }
}

/** Folga para a meia largura do traço mais grosso (2,3 unidades) e o tremido. */
const PAD = 1.5

describe('ícones no estilo Medieval', () => {
  it('todo tipo que o núcleo gera tem desenho', () => {
    const generated = new Set(DECOR_RULES.flatMap((r) => r.kinds.map((k) => k.kind)))
    for (const kind of generated) expect(INK_KINDS).toContain(kind)
    expect(INK_KINDS).toHaveLength(Object.keys(DECOR).length)
  })

  it.each(Object.entries(DECOR))('%s desenha dentro do quadro, em toda variação', (_, kind) => {
    for (let v = 0; v < DECOR_VARIANTS; v++) {
      const rec = recorder()
      drawDecorIcon(rec.ctx, kind, 0, 0, 1, variantShape(v))
      expect(rec.marks()).toBeGreaterThan(0)
      expect(rec.depth()).toBe(0)
      const b = rec.bounds()
      expect(b.left).toBeGreaterThanOrEqual(-INK_CELL.left + PAD)
      expect(b.right).toBeLessThanOrEqual(INK_CELL.right - PAD)
      expect(b.top).toBeGreaterThanOrEqual(-INK_CELL.up + PAD)
      expect(b.bottom).toBeLessThanOrEqual(INK_CELL.down - PAD)
    }
  })

  it('montanhas com a tinta v1 e hachura na face sombreada; os demais com a tinta v2', () => {
    for (const kind of [DECOR.peak, DECOR.snowPeak]) {
      const rec = recorder()
      drawDecorIcon(rec.ctx, kind, 0, 0, 1, 0.5)
      expect(rec.colors).toContain('#3A2A1C')
      expect(rec.colors).toContain('rgba(58,42,28,.55)')
    }
    for (const kind of [DECOR.tree, DECOR.hill, DECOR.cactus]) {
      const rec = recorder()
      drawDecorIcon(rec.ctx, kind, 0, 0, 1, 0.5)
      expect(rec.colors).toContain('#1C1511')
    }
  })

  it('a floresta junta pinheiros e uma árvore redonda, em toda variação', () => {
    for (let v = 0; v < DECOR_VARIANTS; v++) {
      const rec = recorder()
      drawDecorIcon(rec.ctx, DECOR.tree, 0, 0, 1, variantShape(v))
      expect(rec.colors).toContain('#9CCB6A')
      expect(rec.colors).toContain('#86BE5C')
    }
  })

  it('tipo sem desenho não desenha nada', () => {
    const rec = recorder()
    drawDecorIcon(rec.ctx, 255, 0, 0, 1, 0.5)
    expect(rec.points).toHaveLength(0)
  })
})

describe('spritesheet', () => {
  it('uma coluna por tipo e uma linha por variação, em quadros quadrados', () => {
    expect(INK_CELL.up + INK_CELL.down).toBe(INK_CELL_SIZE)
    expect(INK_SHEET).toEqual({ width: INK_KINDS.length * INK_FRAME_PX, height: DECOR_VARIANTS * INK_FRAME_PX })
    expect(INK_FRAME_PX).toBe(INK_CELL_SIZE * INK_PX)
    expect(inkFrame(INK_KINDS[2], 3)).toEqual({ x: 2 * INK_FRAME_PX, y: 3 * INK_FRAME_PX })
  })

  it('cada ícone fica dentro do seu quadro', () => {
    for (const [col, kind] of INK_KINDS.entries()) {
      for (let v = 0; v < DECOR_VARIANTS; v++) {
        const rec = recorder()
        rec.ctx.setTransform(INK_PX, 0, 0, INK_PX, 0, 0)
        drawDecorIcon(rec.ctx, kind, col * INK_CELL_SIZE + INK_CELL.left, v * INK_CELL_SIZE + INK_CELL.up, 1, variantShape(v))
        const b = rec.bounds()
        const f = inkFrame(kind, v)
        expect(b.left).toBeGreaterThanOrEqual(f.x)
        expect(b.right).toBeLessThanOrEqual(f.x + INK_FRAME_PX)
        expect(b.top).toBeGreaterThanOrEqual(f.y)
        expect(b.bottom).toBeLessThanOrEqual(f.y + INK_FRAME_PX)
      }
    }
  })

  it('o spritesheet inteiro cabe no canvas e volta a transformação ao fim', () => {
    const rec = recorder()
    drawDecorSheet(rec.ctx)
    const b = rec.bounds()
    expect(b.left).toBeGreaterThanOrEqual(0)
    expect(b.top).toBeGreaterThanOrEqual(0)
    expect(b.right).toBeLessThanOrEqual(INK_SHEET.width)
    expect(b.bottom).toBeLessThanOrEqual(INK_SHEET.height)
    rec.points.length = 0
    rec.ctx.moveTo(1, 1)
    expect(rec.points).toEqual([[1, 1]])
  })

  it('o quadro no mundo segue a escala dos ícones do protótipo no editor', () => {
    expect(DECOR_UNIT).toBeCloseTo((1024 / 1600) * 1.15)
    expect(DECOR_WORLD_SIZE).toBeCloseTo(INK_CELL_SIZE * DECOR_UNIT)
  })

  it('a variação só depende da posição e usa todas as linhas', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) {
      const u = (i * 0.618) % 1
      const v = (i * 0.377) % 1
      const k = decorVariant(u, v)
      expect(k).toBe(decorVariant(u, v))
      expect(k).toBeGreaterThanOrEqual(0)
      expect(k).toBeLessThan(DECOR_VARIANTS)
      seen.add(k)
    }
    expect(seen.size).toBe(DECOR_VARIANTS)
  })
})
