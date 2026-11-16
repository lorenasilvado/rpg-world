import { DECOR } from '../../core/types'

/**
 * Ícones decorativos no estilo Medieval do design system (`docs/design/design-system.md` → Estilo
 * do mapa → Decoração): desenho a nanquim, traço levemente trêmulo. Montanhas e neve usam o desenho
 * v1 (tinta `#3A2A1C`, hachura na face sombreada); os demais, o v2 (tinta `#1C1511`): traço de onda
 * no oceano profundo, pontilhado de areia na praia, tufos no campo, pinheiros com uma árvore redonda
 * na floresta, dunas e cactos no deserto, colinas a traço com hachura.
 *
 * Portado de `rpg-decor-medieval.js → RPG_MEDIEVAL_V2B` do protótipo
 * (`RPG World Builder - Editor.html`). Cada desenho é feito em unidades do protótipo com o pé do
 * ícone em (x, y); `r`, de 0 a 1, escolhe a variação (no protótipo, um hash da posição). Aqui eles
 * viram um spritesheet (`drawDecorSheet`), com `DECOR_VARIANTS` variações de cada ícone. Não é
 * código do núcleo: o seno do hash do traço trêmulo não muda o campo gerado.
 */

/** O que os desenhos usam do contexto 2D (o do `<canvas>` e o do `OffscreenCanvas`). */
export type Ink = Pick<
  CanvasRenderingContext2D,
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'quadraticCurveTo'
  | 'bezierCurveTo'
  | 'arc'
  | 'closePath'
  | 'fill'
  | 'stroke'
  | 'clip'
  | 'fillRect'
  | 'save'
  | 'restore'
  | 'setTransform'
> & {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
}

type Point = readonly [number, number]

/** Tinta das montanhas (desenho v1). */
const INK_V1 = '#3A2A1C'
const INK_V1_SOFT = 'rgba(58,42,28,.55)'
/** Tinta dos demais ícones (desenho v2). */
const INK_V2 = '#1C1511'

/** Hash de 0 a 1 da posição (o mesmo do protótipo), para o tremido do traço. */
function hash(x: number, y: number, n = 0): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + n * 37.719) * 43758.5453
  return v - Math.floor(v)
}

function line(ctx: Ink, pts: readonly Point[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

/** Linha trêmula: cada ponto desloca até `amp` × `s`, pelo hash da posição. */
function wobble(ctx: Ink, pts: readonly Point[], s: number, seed: number, amp = 0.5) {
  const a = amp * s
  ctx.beginPath()
  pts.forEach((p, i) => {
    const x = p[0] + (hash(p[0], p[1], seed + i) - 0.5) * a
    const y = p[1] + (hash(p[1], p[0], seed - i) - 0.5) * a
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  })
  ctx.stroke()
}

function ink(ctx: Ink, width: number) {
  ctx.strokeStyle = INK_V2
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

// --- v1: montanha e montanha nevada, com hachura na face sombreada ---

function mountain(ctx: Ink, x: number, y: number, s: number, snow: boolean, r: number) {
  const h = (16 + r * 7) * s
  const w = (11 + r * 4) * s
  const top: Point = [x + (r - 0.5) * 3 * s, y - h]
  const left: Point = [x - w, y + 2 * s]
  const right: Point = [x + w * 1.05, y + 2 * s]
  const mid: Point = [x + w * 0.18, y + 2 * s]
  // Face iluminada.
  ctx.beginPath()
  ctx.moveTo(left[0], left[1])
  ctx.lineTo(top[0] - w * 0.35, top[1] + h * 0.42)
  ctx.lineTo(top[0], top[1])
  ctx.lineTo(mid[0], mid[1])
  ctx.closePath()
  ctx.fillStyle = snow ? '#EEF2F2' : '#B9AE9C'
  ctx.fill()
  // Face sombreada, com a hachura recortada nela.
  ctx.beginPath()
  ctx.moveTo(top[0], top[1])
  ctx.lineTo(top[0] + w * 0.45, top[1] + h * 0.5)
  ctx.lineTo(right[0], right[1])
  ctx.lineTo(mid[0], mid[1])
  ctx.closePath()
  ctx.fillStyle = snow ? '#BFC9CE' : '#8C8173'
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = INK_V1_SOFT
  ctx.lineWidth = 0.8 * s
  for (let t = 0; t < 1.6; t += 0.16) {
    const sx = top[0] + t * w * 0.9
    const sy = top[1] + t * h * 0.55
    line(ctx, [
      [sx, sy],
      [sx - 5 * s, sy + 10 * s],
    ])
  }
  ctx.restore()
  if (snow) {
    ctx.beginPath()
    ctx.moveTo(top[0], top[1])
    ctx.lineTo(top[0] - w * 0.3, top[1] + h * 0.36)
    ctx.lineTo(top[0] - w * 0.1, top[1] + h * 0.3)
    ctx.lineTo(top[0] + w * 0.05, top[1] + h * 0.42)
    ctx.lineTo(top[0] + w * 0.32, top[1] + h * 0.34)
    ctx.closePath()
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
  }
  // Contorno a nanquim, aberto na base.
  ctx.strokeStyle = INK_V1
  ctx.lineWidth = 1.25 * s
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  line(ctx, [left, [top[0] - w * 0.35, top[1] + h * 0.42], top, [top[0] + w * 0.45, top[1] + h * 0.5], right])
  ctx.lineWidth = 0.9 * s
  line(ctx, [top, [top[0] + w * 0.06, top[1] + h * 0.45], mid])
}

// --- v2: demais biomas ---

function pine(ctx: Ink, x: number, y: number, s: number, r: number) {
  const H = (10 + r * 3) * s
  const W = (3.6 + r) * s
  const t = y - H
  const base = y - H * 0.2
  ctx.beginPath()
  ctx.moveTo(x, t)
  ctx.lineTo(x + W, base)
  ctx.lineTo(x - W, base)
  ctx.closePath()
  ctx.fillStyle = '#9CCB6A'
  ctx.fill()
  ink(ctx, 1.05 * s)
  wobble(
    ctx,
    [
      [x - W, base],
      [x - W * 0.45, t + H * 0.45],
      [x - W * 0.7, t + H * 0.45],
      [x, t],
      [x + W * 0.7, t + H * 0.45],
      [x + W * 0.45, t + H * 0.45],
      [x + W, base],
      [x - W, base],
    ],
    s,
    1,
    0.35,
  )
  wobble(
    ctx,
    [
      [x, base],
      [x, y],
    ],
    s,
    6,
    0.2,
  )
}

const LOBES: ReadonlyArray<readonly [number, number, number]> = [
  [-0.48, 0.12, 0.58],
  [0.48, 0.14, 0.56],
  [-0.2, -0.42, 0.58],
  [0.26, -0.38, 0.56],
  [0, 0.04, 0.6],
]

function roundTree(ctx: Ink, x: number, y: number, s: number, r: number) {
  const R = (4.2 + r * 1.2) * s
  ink(ctx, 1.1 * s)
  wobble(
    ctx,
    [
      [x, y - R * 0.2],
      [x, y + R * 1.5],
    ],
    s,
    90,
    0.2,
  )
  const crown = () => {
    ctx.beginPath()
    for (const [dx, dy, rr] of LOBES) {
      ctx.moveTo(x + dx * R + rr * R, y + dy * R)
      ctx.arc(x + dx * R, y + dy * R, rr * R, 0, 2 * Math.PI)
    }
  }
  crown()
  ctx.strokeStyle = INK_V2
  ctx.lineWidth = 2.3 * s
  ctx.stroke()
  crown()
  ctx.fillStyle = '#86BE5C'
  ctx.fill()
  ctx.save()
  crown()
  ctx.clip()
  ink(ctx, 0.8 * s)
  const strokes: ReadonlyArray<readonly [number, number, number, number]> = [
    [0.15, 0.05, 0.45, -0.2],
    [-0.35, 0.3, -0.05, 0.1],
    [0.35, 0.45, 0.65, 0.25],
  ]
  strokes.forEach(([x0, y0, x1, y1], i) =>
    wobble(
      ctx,
      [
        [x + R * x0, y + R * y0],
        [x + R * x1, y + R * y1],
      ],
      s,
      91 + i,
      0.3,
    ),
  )
  ctx.restore()
}

/** Tufinho em "^" ao lado do grupo de árvores. */
function caret(ctx: Ink, x: number, y: number, s: number) {
  ink(ctx, 1 * s)
  wobble(
    ctx,
    [
      [x - 2.2 * s, y],
      [x, y - 3 * s],
      [x + 2.2 * s, y],
    ],
    s,
    9,
    0.3,
  )
}

/** Grupo de 2 ou 3 árvores: pinheiros e uma árvore redonda. */
function trees(ctx: Ink, x: number, y: number, s: number, r: number) {
  const spots: Point[] = [
    [-5.5, 1.5],
    [5, 2.5],
    [0.5, -3.5],
  ]
  const round = r < 0.5 ? 1 : 2
  spots
    .slice(0, 2 + Math.floor(r * 2))
    .sort((a, b) => a[1] - b[1])
    // O tamanho de cada árvore vem da variação, não da posição: o quadro do spritesheet é justo.
    .forEach(([dx, dy], i) => (i === round ? roundTree : pine)(ctx, x + dx * s, y + dy * s, s * 0.9, hash(i, r * 1000, 1)))
  if (r > 0.5) caret(ctx, x + 9 * s, y + 4 * s, s)
}

function hill(ctx: Ink, x: number, y: number, s: number) {
  ink(ctx, 1.3 * s)
  wobble(
    ctx,
    [
      [x - 9 * s, y + 2 * s],
      [x - 6 * s, y - 2.5 * s],
      [x - 2 * s, y - 4.5 * s],
      [x + 3 * s, y - 4 * s],
      [x + 7 * s, y - 1 * s],
      [x + 9 * s, y + 2 * s],
    ],
    s,
    40,
  )
  // Hachura na encosta da direita.
  ink(ctx, 0.9 * s)
  wobble(
    ctx,
    [
      [x + 3 * s, y - 2 * s],
      [x + 1.5 * s, y + 1 * s],
    ],
    s,
    41,
  )
  wobble(
    ctx,
    [
      [x + 6 * s, y - 0.5 * s],
      [x + 4.5 * s, y + 2 * s],
    ],
    s,
    42,
  )
}

function dune(ctx: Ink, x: number, y: number, s: number) {
  ink(ctx, 1.1 * s)
  ctx.strokeStyle = 'rgba(60,38,18,.85)'
  wobble(
    ctx,
    [
      [x - 9 * s, y + 1 * s],
      [x - 5 * s, y - 2 * s],
      [x - 1 * s, y - 2.5 * s],
      [x + 3 * s, y],
      [x + 7 * s, y + 1 * s],
    ],
    s,
    50,
    0.4,
  )
  wobble(
    ctx,
    [
      [x - 3 * s, y + 4 * s],
      [x + 1 * s, y + 2.5 * s],
      [x + 5 * s, y + 4 * s],
    ],
    s,
    51,
    0.4,
  )
}

function cactus(ctx: Ink, x: number, y: number, s: number, r: number) {
  const H = (11 + r * 3) * s
  const w = 1.7 * s
  const tp = y - H
  ctx.fillStyle = 'rgba(120,170,85,.6)'
  ctx.fillRect(x - w, tp + w, 2 * w, H - w)
  ink(ctx, 1.25 * s)
  wobble(
    ctx,
    [
      [x - w, y],
      [x - w, tp + w],
      [x - w * 0.5, tp],
      [x + w * 0.5, tp],
      [x + w, tp + w],
      [x + w, y],
    ],
    s,
    60,
    0.4,
  )
  wobble(
    ctx,
    [
      [x - w, y - H * 0.45],
      [x - 5 * s, y - H * 0.45],
      [x - 5.5 * s, y - H * 0.7],
    ],
    s,
    61,
    0.4,
  )
  wobble(
    ctx,
    [
      [x + w, y - H * 0.62],
      [x + 4.6 * s, y - H * 0.62],
      [x + 5 * s, y - H * 0.85],
    ],
    s,
    62,
    0.4,
  )
  ink(ctx, 0.9 * s)
  wobble(
    ctx,
    [
      [x - 6 * s, y + 0.5 * s],
      [x + 6 * s, y + 0.5 * s],
    ],
    s,
    63,
    0.6,
  )
}

function tuft(ctx: Ink, x: number, y: number, s: number) {
  ink(ctx, 1 * s)
  ctx.strokeStyle = 'rgba(28,21,17,.8)'
  const blades: ReadonlyArray<readonly [number, number, number]> = [
    [-3.5, -4.5, -3.5],
    [-1.2, -1.5, -5],
    [1.2, 1.8, -4.5],
    [3.5, 5, -3],
  ]
  blades.forEach(([foot, tip, height], i) =>
    wobble(
      ctx,
      [
        [x + foot * s, y],
        [x + tip * s, y + height * s],
      ],
      s,
      70 + i,
      0.3,
    ),
  )
}

function wave(ctx: Ink, x: number, y: number, s: number) {
  ink(ctx, 1.2 * s)
  ctx.strokeStyle = 'rgba(14,30,45,.75)'
  wobble(
    ctx,
    [
      [x - 7 * s, y],
      [x - 4 * s, y - 2 * s],
      [x - 1 * s, y],
      [x + 2 * s, y - 2 * s],
      [x + 5 * s, y],
    ],
    s,
    80,
    0.3,
  )
}

/** Pontilhado de areia: quatro pontos a nanquim, espalhados conforme a variação `r`. */
function sand(ctx: Ink, x: number, y: number, s: number, r: number) {
  ctx.fillStyle = 'rgba(28,21,17,.6)'
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.arc(x + (hash(r * 1000, i, 5) - 0.5) * 7 * s, y + (hash(i, r * 1000, 6) - 0.5) * 4 * s, 0.6 * s, 0, 2 * Math.PI)
    ctx.fill()
  }
}

/** Desenho de cada tipo do núcleo (`DECOR`), com o pé em (x, y), na escala `s` e na variação `r`. */
const DRAW: Record<number, (ctx: Ink, x: number, y: number, s: number, r: number) => void> = {
  [DECOR.wave]: wave,
  [DECOR.sand]: sand,
  [DECOR.tuft]: tuft,
  [DECOR.tree]: trees,
  [DECOR.dune]: dune,
  [DECOR.cactus]: cactus,
  [DECOR.hill]: hill,
  [DECOR.peak]: (ctx, x, y, s, r) => mountain(ctx, x, y, s, false, r),
  [DECOR.snowPeak]: (ctx, x, y, s, r) => mountain(ctx, x, y, s, true, r),
}

/** Tipos do núcleo que têm desenho, na ordem das colunas do spritesheet. */
export const INK_KINDS: readonly number[] = Object.values(DECOR)

/** Desenha o ícone `kind` do núcleo com o pé em (x, y). Tipo sem desenho: não desenha nada. */
export function drawDecorIcon(ctx: Ink, kind: number, x: number, y: number, s: number, r: number) {
  const draw = DRAW[kind]
  if (!draw) return
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  draw(ctx, x, y, s, r)
  ctx.restore()
}

// --- spritesheet ---

/** Variações de cada ícone no spritesheet (a variação de cada ponto vem de `decorVariant`). */
export const DECOR_VARIANTS = 4

/** Quadro de um ícone em volta do pé, em unidades do protótipo (para a esquerda, a direita, cima e baixo). */
export type InkBox = { readonly left: number; readonly right: number; readonly up: number; readonly down: number }

/**
 * Quadro de cada tipo, do tamanho do desenho (as 4 variações, com folga para a espessura do traço):
 * uma margem transparente maior também é desenhada, e sem GPU o custo cresce com a área. O teste
 * confere que cada desenho cabe no seu quadro.
 */
export const INK_BOXES: ReadonlyMap<number, InkBox> = new Map<number, InkBox>([
  [DECOR.wave, { left: 9, right: 7, up: 4, down: 2 }],
  [DECOR.sand, { left: 6, right: 5, up: 4, down: 4 }],
  [DECOR.tuft, { left: 7, right: 7, up: 7, down: 2 }],
  [DECOR.tree, { left: 11, right: 13, up: 17, down: 11 }],
  [DECOR.dune, { left: 11, right: 9, up: 5, down: 6 }],
  [DECOR.cactus, { left: 8, right: 8, up: 16, down: 3 }],
  [DECOR.hill, { left: 11, right: 11, up: 7, down: 4 }],
  [DECOR.peak, { left: 16, right: 17, up: 24, down: 4 }],
  [DECOR.snowPeak, { left: 16, right: 17, up: 24, down: 4 }],
])

/** Pixels do spritesheet por unidade do protótipo: nítido no zoom máximo, com folga para telas 2×. */
export const INK_PX = 4

/**
 * Unidades do mundo do renderer (o quadrado de 1024, uma por célula do mapa 1024²) por unidade do
 * protótipo: no protótipo, a escala dos ícones é a largura do mapa / 1600 × 1,15 (a escala do
 * editor), com a mesma densidade de ícones do núcleo (um a cada ~1/63 da largura).
 */
export const DECOR_UNIT = (1024 / 1600) * 1.15

/** Altura de uma linha do spritesheet, em unidades do protótipo: a do quadro mais alto. */
const ROW = Math.max(...[...INK_BOXES.values()].map((b) => b.up + b.down))

/** Coluna de cada tipo no spritesheet (borda esquerda, em unidades do protótipo), lado a lado. */
const COLUMN: ReadonlyMap<number, number> = (() => {
  const out = new Map<number, number>()
  let x = 0
  for (const kind of INK_KINDS) {
    out.set(kind, x)
    const b = INK_BOXES.get(kind)!
    x += b.left + b.right
  }
  return out
})()

/** Tamanho do spritesheet, em px: uma coluna por tipo (`INK_KINDS`), uma linha por variação. */
export const INK_SHEET = {
  width: [...INK_BOXES.values()].reduce((w, b) => w + b.left + b.right, 0) * INK_PX,
  height: DECOR_VARIANTS * ROW * INK_PX,
} as const

/** Quadro do tipo `kind` na variação `variant`, em px do spritesheet. */
export function inkFrame(kind: number, variant: number): { x: number; y: number; width: number; height: number } {
  const b = INK_BOXES.get(kind)!
  return {
    x: COLUMN.get(kind)! * INK_PX,
    y: variant * ROW * INK_PX,
    width: (b.left + b.right) * INK_PX,
    height: (b.up + b.down) * INK_PX,
  }
}

/** Pé do ícone `kind` no quadro, em fração da largura e da altura (a âncora do sprite). */
export function inkAnchor(kind: number): { x: number; y: number } {
  const b = INK_BOXES.get(kind)!
  return { x: b.left / (b.left + b.right), y: b.up / (b.up + b.down) }
}

/**
 * Caixa do ícone `kind` no mundo do renderer (mapa de 1024 unidades) em volta do pé: o lado de um
 * quadrado que cobre o desenho acima do pé e para os lados, e o que desce abaixo dele (o culling).
 */
export function inkWorldBox(kind: number): { size: number; down: number } {
  const b = INK_BOXES.get(kind)!
  return { size: Math.max(b.left, b.right, b.up / 2) * 2 * DECOR_UNIT, down: b.down * DECOR_UNIT }
}

/** Variação `r` desenhada na linha `variant`: o centro de cada faixa de 0 a 1. */
export function variantShape(variant: number): number {
  return (variant + 0.5) / DECOR_VARIANTS
}

/** Desenha o spritesheet inteiro no contexto (de `INK_SHEET.width` × `INK_SHEET.height` px). */
export function drawDecorSheet(ctx: Ink) {
  ctx.setTransform(INK_PX, 0, 0, INK_PX, 0, 0)
  for (const kind of INK_KINDS) {
    const b = INK_BOXES.get(kind)!
    for (let v = 0; v < DECOR_VARIANTS; v++) {
      // Cada quadro num lugar diferente do canvas: o tremido do traço muda de um para outro.
      drawDecorIcon(ctx, kind, COLUMN.get(kind)! + b.left, v * ROW + b.up, 1, variantShape(v))
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

/**
 * Variação do ícone no ponto (u, v) do mapa, de 0 a `DECOR_VARIANTS` − 1. Só depende da posição,
 * que é a mesma na prévia e no mapa final: o ícone não troca de desenho ao soltar o slider.
 */
export function decorVariant(u: number, v: number): number {
  return Math.min(DECOR_VARIANTS - 1, Math.floor(hash(u * 1024, v * 1024, 7) * DECOR_VARIANTS))
}
