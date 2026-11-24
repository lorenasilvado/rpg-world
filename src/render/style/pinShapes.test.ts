import { describe, expect, it, vi } from 'vitest'
import { PIN_TYPES } from '../../state/pinTypes'
import { CUSTOM_CIRCLE, PIN_SHAPES, coverSquare, drawPin, type PinInk } from './pinShapes'

describe('formas dos pins (AC-F3-02, design-system.md → Pins)', () => {
  it('os 7 tipos têm forma, base e sombra do design system', () => {
    expect(Object.fromEntries(PIN_TYPES.map((t) => [t.label, [PIN_SHAPES[t.id].shape, PIN_SHAPES[t.id].base, PIN_SHAPES[t.id].shade]]))).toEqual({
      Cidade: ['Gota', '#D9573F', '#A93A26'],
      Vila: ['Etiqueta', '#4FB0A3', '#2F8276'],
      Castelo: ['Escudo ameado', '#7B8FD0', '#5466A8'],
      Masmorra: ['Losango', '#8E6BA8', '#634580'],
      NPC: ['Hexágono', '#EE9443', '#C06A1E'],
      'Ponto de interesse': ['Estrela', '#F2CF4A', '#C9A21F'],
      Personalizado: ['Círculo com imagem', '#C8892B', '#9A6518'],
    })
  })

  it('cada forma é diferente das outras (a forma sozinha identifica o tipo)', () => {
    const bodies = new Set(PIN_TYPES.map((t) => PIN_SHAPES[t.id].body))
    expect(bodies.size).toBe(PIN_TYPES.length)
  })

  it('desenha a sombra no chão, o corpo em dois tons, o contorno de 1,5 e o glifo, na largura pedida', () => {
    const fills: string[] = []
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      clip: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fillRect: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(function (this: PinInk) {
        fills.push(String(this.fillStyle))
      }),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: 'miter',
      globalAlpha: 1,
    } as unknown as PinInk
    drawPin(ctx, 'vila', 128, (d) => ({ d }) as unknown as Path2D)
    expect(ctx.scale).toHaveBeenCalledWith(128 / 40, 128 / 40)
    expect(fills).toEqual(['#2B2420', '#2F8276', '#4FB0A3', '#FFF8E8', '#FFF8E8', '#2B2420'])
    expect(ctx.lineWidth).toBe(1.5)
    expect(ctx.strokeStyle).toBe('#2B2420')
  })

  it('o Personalizado com imagem a desenha cobrindo o círculo, no lugar da hachura (AC-F3-11)', () => {
    const ink = () => {
      const ctx = { fillStyle: '', strokeStyle: '', lineWidth: 0, lineJoin: 'miter', globalAlpha: 1 } as Record<string, unknown>
      for (const m of ['save', 'restore', 'translate', 'scale', 'rotate', 'clip', 'beginPath', 'ellipse', 'fillRect', 'stroke', 'fill', 'drawImage']) ctx[m] = vi.fn()
      return ctx as unknown as PinInk
    }
    const path = (d: string) => ({ d }) as unknown as Path2D
    const source = {} as CanvasImageSource
    const withImage = ink()
    drawPin(withImage, 'custom', 128, path, { source, width: 300, height: 200 })
    const { cx, cy, r } = CUSTOM_CIRCLE
    expect(withImage.drawImage).toHaveBeenCalledWith(source, 50, 0, 200, 200, cx - r, cy - r, 2 * r, 2 * r)
    expect(withImage.fillRect).not.toHaveBeenCalled()
    const hatched = ink()
    drawPin(hatched, 'custom', 128, path)
    expect(hatched.drawImage).not.toHaveBeenCalled()
    expect(hatched.fillRect).toHaveBeenCalled()
  })

  it('o recorte da imagem é o quadrado do meio', () => {
    expect(coverSquare(300, 200)).toEqual({ sx: 50, sy: 0, side: 200 })
    expect(coverSquare(100, 400)).toEqual({ sx: 0, sy: 150, side: 100 })
  })
})
