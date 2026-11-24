import type { PinType } from '../../state/pinTypes'

/**
 * O desenho dos pins (design-system.md → Pins): viewBox 40 × 48, contorno `#2B2420` de 1,5, dois
 * tons (a base deslocada −2,5 sobre a sombra), glifo `#FFF8E8` e a sombra no chão (elipse
 * `#2B2420` a 26%). A âncora é a base central do viewBox (20, 48): o ponto do mapa fica ali.
 *
 * As formas e os glifos vêm do protótipo (`RPG.pinSVG`) e são strings de path do SVG, para servir
 * ao `<svg>` da interface (`PinIcon`) e ao canvas do mapa (`Path2D`, em `drawPin`).
 */
export const PIN_VIEWBOX = { width: 40, height: 48 } as const

/** Largura do pin na tela, em px CSS, em qualquer zoom (a altura é 1,2×). */
export const PIN_SIZE_PX = 32

export const PIN_INK = '#2B2420'
export const PIN_GLYPH = '#FFF8E8'

/** Um pedaço do glifo: claro (`#FFF8E8`) ou escuro (a tinta, como portas e janelas). */
export type GlyphPart = { d: string; dark?: boolean }

export type PinShape = {
  /** Nome da forma (a forma sozinha identifica o tipo). */
  shape: string
  /** Cor da base e da sombra. */
  base: string
  shade: string
  /** Contorno do corpo. */
  body: string
  /** Glifo; o Personalizado não tem: no lugar, o círculo com a imagem enviada (sem ela, hachurado). */
  glyph: readonly GlyphPart[]
}

function rect(x: number, y: number, w: number, h: number): string {
  return `M${x} ${y}h${w}v${h}h${-w}z`
}

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`
}

/** Estrela de 5 pontas centrada em (cx, cy), com raios externo `R` e interno `r`. */
function star(cx: number, cy: number, R: number, r: number): string {
  let d = ''
  for (let k = 0; k < 10; k++) {
    const a = ((-90 + k * 36) * Math.PI) / 180
    const rad = k % 2 ? r : R
    d += `${k ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`
  }
  return `${d}Z`
}

/** O círculo do Personalizado (centro e raio no viewBox). */
export const CUSTOM_CIRCLE = { cx: 20, cy: 21, r: 11 } as const

export const PIN_SHAPES: Record<PinType, PinShape> = {
  cidade: {
    shape: 'Gota',
    base: '#D9573F',
    shade: '#A93A26',
    body: 'M20 44C14 35 6 29 6 19a14 14 0 0 1 28 0c0 10-8 16-14 25z',
    glyph: [{ d: rect(12.5, 17, 4.5, 9) }, { d: rect(17.75, 11.5, 4.5, 14.5) }, { d: rect(23, 15, 4.5, 11) }],
  },
  vila: {
    shape: 'Etiqueta',
    base: '#4FB0A3',
    shade: '#2F8276',
    body: 'M9 6h22a5 5 0 0 1 5 5v19a5 5 0 0 1-5 5h-6l-5 8-5-8H9a5 5 0 0 1-5-5V11a5 5 0 0 1 5-5z',
    glyph: [{ d: 'M11.5 20.5 20 12.5l8.5 8z' }, { d: rect(13.5, 20, 13, 9) }, { d: rect(18.5, 23.5, 3, 5.5), dark: true }],
  },
  castelo: {
    shape: 'Escudo ameado',
    base: '#7B8FD0',
    shade: '#5466A8',
    body: 'M6 5h5v4h4.5V5h9v4H29V5h5v17c0 10-7 16-14 21C13 38 6 32 6 22z',
    glyph: [
      { d: rect(14, 15.5, 12, 12.5) },
      { d: rect(14, 12.5, 3, 3.5) },
      { d: rect(18.5, 12.5, 3, 3.5) },
      { d: rect(23, 12.5, 3, 3.5) },
      { d: 'M18 28v-4a2 2 0 0 1 4 0v4z', dark: true },
    ],
  },
  masmorra: {
    shape: 'Losango',
    base: '#8E6BA8',
    shade: '#634580',
    body: 'M20 3 37 22 20 43 3 22z',
    glyph: [{ d: 'M13 30v-8a7 7 0 0 1 14 0v8z' }, { d: 'M16.5 30v-7.5a3.5 3.5 0 0 1 7 0V30z', dark: true }],
  },
  npc: {
    shape: 'Hexágono',
    base: '#EE9443',
    shade: '#C06A1E',
    body: 'M20 4l15 8.5v17L23.5 36 20 42l-3.5-6L5 29.5v-17z',
    glyph: [{ d: circle(20, 16.5, 4.5) }, { d: 'M12 30a8 7.5 0 0 1 16 0z' }],
  },
  poi: {
    shape: 'Estrela',
    base: '#F2CF4A',
    shade: '#C9A21F',
    body: star(20, 23, 19.5, 8.8),
    glyph: [{ d: circle(20, 23.5, 3.6) }],
  },
  custom: {
    shape: 'Círculo com imagem',
    base: '#C8892B',
    shade: '#9A6518',
    body: circle(20, 21, 16),
    glyph: [],
  },
}

/** O contexto 2D que `drawPin` usa (o do `<canvas>` ou o do `OffscreenCanvas`). */
export type PinInk = Pick<
  CanvasRenderingContext2D,
  'save' | 'restore' | 'translate' | 'scale' | 'rotate' | 'fill' | 'stroke' | 'clip' | 'beginPath' | 'ellipse' | 'fillRect' | 'drawImage'
> & {
  fillStyle: CanvasRenderingContext2D['fillStyle']
  strokeStyle: CanvasRenderingContext2D['strokeStyle']
  lineWidth: number
  lineJoin: CanvasLineJoin
  globalAlpha: number
}

/** Uma imagem para o círculo do Personalizado, com o tamanho dela. */
export type PinImage = { source: CanvasImageSource; width: number; height: number }

/**
 * O recorte da imagem que cobre um quadrado (o círculo do Personalizado), centrado, como o
 * `object-fit: cover`: o quadrado do meio, com o lado menor da imagem.
 */
export function coverSquare(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height)
  return { sx: (width - side) / 2, sy: (height - side) / 2, side }
}

/**
 * Desenha o pin do `type` com `width` px de largura (e 1,2× de altura), a partir de (0, 0): a sombra
 * no chão, o corpo em dois tons, o contorno e o glifo, como o `<svg>` do `PinIcon`. O Personalizado
 * com `image` a mostra no círculo (no lugar da hachura), cobrindo-o.
 */
export function drawPin(ctx: PinInk, type: PinType, width: number, path: (d: string) => Path2D = (d) => new Path2D(d), image?: PinImage) {
  const s = PIN_SHAPES[type]
  const body = path(s.body)
  ctx.save()
  ctx.scale(width / PIN_VIEWBOX.width, width / PIN_VIEWBOX.width)
  // Sombra no chão.
  ctx.globalAlpha = 0.26
  ctx.fillStyle = PIN_INK
  ctx.beginPath()
  ctx.ellipse(20, 45.5, 8, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  // Corpo: a sombra e, por cima, a base deslocada −2,5, recortada pelo corpo.
  ctx.fillStyle = s.shade
  ctx.fill(body)
  ctx.save()
  ctx.clip(body)
  ctx.translate(-2.5, -2.5)
  ctx.fillStyle = s.base
  ctx.fill(body)
  ctx.restore()
  ctx.strokeStyle = PIN_INK
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.stroke(body)
  // Glifo.
  for (const part of s.glyph) {
    ctx.fillStyle = part.dark ? PIN_INK : PIN_GLYPH
    ctx.fill(path(part.d))
  }
  if (type === 'custom') drawCustomCircle(ctx, path, image)
  ctx.restore()
}

/** O círculo do Personalizado: a imagem enviada ou, sem ela, a hachura (o lugar da imagem). */
function drawCustomCircle(ctx: PinInk, path: (d: string) => Path2D, image?: PinImage) {
  const { cx, cy, r } = CUSTOM_CIRCLE
  const disc = path(circle(cx, cy, r))
  ctx.save()
  ctx.clip(disc)
  ctx.fillStyle = '#EFE6D2'
  ctx.fill(disc)
  if (image && image.width > 0 && image.height > 0) {
    const { sx, sy, side } = coverSquare(image.width, image.height)
    ctx.drawImage(image.source, sx, sy, side, side, cx - r, cy - r, 2 * r, 2 * r)
  } else {
    ctx.translate(cx, cy)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = '#D8C9A8'
    for (let x = -r - 4; x <= r + 4; x += 4) ctx.fillRect(x, -r - 4, 1.6, 2 * r + 8)
  }
  ctx.restore()
  ctx.strokeStyle = PIN_INK
  ctx.lineWidth = 1.2
  ctx.stroke(disc)
}
