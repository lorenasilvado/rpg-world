import { describe, expect, it } from 'vitest'
import {
  CULL_MARGIN,
  LOD_LEVELS,
  CULL_REZOOM,
  covers,
  cullWindow,
  decorRank,
  lodLevel,
  markVisible,
  stale,
  worldView,
  type DecorIcons,
} from './decorCull'

/** Ícones de 10 unidades numa grade `n × n` que cobre o mundo de 1024, nenhum fixo. */
function grid(n: number, always = 0): DecorIcons {
  const count = n * n
  const icons: DecorIcons = {
    x: new Float32Array(count),
    y: new Float32Array(count),
    size: new Float32Array(count).fill(10),
    always: new Uint8Array(count).fill(always),
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      icons.x[j * n + i] = ((i + 0.5) / n) * 1024
      icons.y[j * n + i] = ((j + 0.5) / n) * 1024
    }
  }
  return icons
}

const WHOLE = { x: 0, y: 0, width: 1024, height: 1024 }

describe('nível de detalhe', () => {
  it('mostra tudo a partir de 0,8×, metade até 0,55× e um quarto abaixo disso', () => {
    expect(LOD_LEVELS[lodLevel(4)].keep).toBe(1)
    expect(LOD_LEVELS[lodLevel(1)].keep).toBe(1)
    expect(LOD_LEVELS[lodLevel(0.8)].keep).toBe(1)
    expect(LOD_LEVELS[lodLevel(0.79)].keep).toBe(0.5)
    expect(LOD_LEVELS[lodLevel(0.55)].keep).toBe(0.5)
    expect(LOD_LEVELS[lodLevel(0.54)].keep).toBe(0.25)
    expect(LOD_LEVELS[lodLevel(0.4)].keep).toBe(0.25)
  })

  it('a ordem de cada ícone fica entre 0 e 1 e só depende do índice', () => {
    for (let i = 0; i < 5000; i++) {
      const r = decorRank(i)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
    }
    expect(decorRank(17)).toBe(decorRank(17))
  })

  it('cada nível guarda a fração pedida dos ícones, espalhada pelo mapa', () => {
    const icons = grid(70) // 4.900 ícones
    const out = new Uint8Array(icons.x.length)
    for (const { keep } of LOD_LEVELS) {
      const count = markVisible(icons, WHOLE, keep, out)
      expect(count / icons.x.length).toBeCloseTo(keep, 2)
      // Cada quarto do mapa (de cima para baixo) fica com a mesma fração: sem faixas vazias.
      for (let q = 0; q < 4; q++) {
        let inQuarter = 0
        let shown = 0
        for (let i = 0; i < icons.y.length; i++) {
          if (Math.floor(icons.y[i] / 256) !== q) continue
          inQuarter++
          shown += out[i]
        }
        expect(shown / inQuarter).toBeCloseTo(keep, 1)
      }
    }
  })

  it('afastar só tira ícones: cada nível é parte do nível mais perto', () => {
    const icons = grid(40)
    const near = new Uint8Array(icons.x.length)
    const far = new Uint8Array(icons.x.length)
    markVisible(icons, WHOLE, 0.5, near)
    markVisible(icons, WHOLE, 0.25, far)
    for (let i = 0; i < far.length; i++) if (far[i]) expect(near[i]).toBe(1)
  })

  it('montanhas (fixas) ficam em qualquer nível', () => {
    const icons = grid(20, 1)
    const out = new Uint8Array(icons.x.length)
    expect(markVisible(icons, WHOLE, 0.25, out)).toBe(icons.x.length)
  })
})

describe('culling', () => {
  it('a vista é o retângulo da tela na transformação da câmera', () => {
    // Zoom 2×, com o ponto (100, 50) do mundo no canto da tela.
    const t = { x: -200, y: -100, scale: 2 }
    expect(worldView(t, { x: 0, y: 0, width: 800, height: 600 })).toEqual({ x: 100, y: 50, width: 400, height: 300 })
    // Só a área livre, depois de uma sidebar de 320 px.
    expect(worldView(t, { x: 320, y: 0, width: 400, height: 600 })).toEqual({ x: 260, y: 50, width: 200, height: 300 })
  })

  it('a janela tem a folga de cada lado e cobre a vista', () => {
    const view = { x: 100, y: 200, width: 400, height: 200 }
    const w = cullWindow(view)
    expect(w).toEqual({
      x: 100 - 400 * CULL_MARGIN,
      y: 200 - 200 * CULL_MARGIN,
      width: 400 * (1 + 2 * CULL_MARGIN),
      height: 200 * (1 + 2 * CULL_MARGIN),
    })
    expect(covers(w, view)).toBe(true)
    // Um pan menor que a folga continua dentro da janela; maior, sai.
    expect(covers(w, { ...view, x: view.x + 90 })).toBe(true)
    expect(covers(w, { ...view, x: view.x + 110 })).toBe(false)
    expect(covers(w, { ...view, y: view.y - 60 })).toBe(false)
  })

  it('a janela deixa de servir quando a vista sai dela ou a câmera aproxima demais', () => {
    const view = { x: 0, y: 0, width: 400, height: 400 }
    const w = cullWindow(view)
    expect(stale(w, view)).toBe(false)
    expect(stale(w, { ...view, x: 150 })).toBe(true)
    // Aproximar no centro: a vista encolhe dentro da janela.
    const zoomIn = (k: number) => ({ x: 200 - 200 / k, y: 200 - 200 / k, width: 400 / k, height: 400 / k })
    expect(stale(w, zoomIn(CULL_REZOOM * 0.9))).toBe(false)
    expect(stale(w, zoomIn(CULL_REZOOM * 1.1))).toBe(true)
  })

  it('só desenha os ícones que cruzam a janela', () => {
    const icons = grid(64) // um ícone a cada 16 unidades
    const out = new Uint8Array(icons.x.length)
    const window = { x: 256, y: 256, width: 256, height: 256 }
    const count = markVisible(icons, window, 1, out)
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(icons.x.length / 10)
    for (let i = 0; i < out.length; i++) {
      const s = icons.size[i]
      const crosses =
        icons.x[i] + s / 2 >= 256 && icons.x[i] - s / 2 <= 512 && icons.y[i] >= 256 && icons.y[i] - s <= 512
      expect(out[i], `ícone ${i}`).toBe(crosses ? 1 : 0)
    }
  })

  it('o ícone com o pé abaixo da janela, mas a copa dentro dela, é desenhado', () => {
    const icons: DecorIcons = {
      x: new Float32Array([50, 50]),
      y: new Float32Array([108, 112]),
      size: new Float32Array([10, 10]),
      always: new Uint8Array(2),
    }
    const out = new Uint8Array(2)
    markVisible(icons, { x: 0, y: 0, width: 100, height: 100 }, 1, out)
    expect([...out]).toEqual([1, 0])
  })
})
