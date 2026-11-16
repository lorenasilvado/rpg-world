import { Texture, type Sprite } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { DECOR, type Decor } from '../../core/types'
import { createUiStore } from '../../state/uiStore'
import { DECOR_UNIT, DECOR_VARIANTS, INK_KINDS, INK_PX, inkAnchor } from '../style/decorInk'
import { DecorLayer, bindDecorLayer, writeDecorState, type DecorTextures } from './DecorLayer'

// Sem WebGL no jsdom: os sprites existem, mas nada é desenhado. Aqui fica quais ficam visíveis.
const textures: DecorTextures = new Map(
  INK_KINDS.map((k) => [k, Array.from({ length: DECOR_VARIANTS }, () => new Texture({ source: Texture.WHITE.source }))]),
)

function decor(items: Array<[u: number, v: number, kind: number]>): Decor {
  return {
    u: Float32Array.from(items.map((i) => i[0])),
    v: Float32Array.from(items.map((i) => i[1])),
    kind: Uint8Array.from(items.map((i) => i[2])),
  }
}

const visible = (layer: DecorLayer) => layer.view.children.filter((c) => c.visible).length
const WHOLE = { x: 0, y: 0, width: 1024, height: 1024 }

describe('DecorLayer', () => {
  it('desenha todos os tipos do design system, com o pé na âncora do quadro', () => {
    const layer = new DecorLayer(textures)
    layer.setDecor(
      decor([
        [0.5, 0.25, DECOR.tree],
        [0.25, 0.75, DECOR.peak],
        [0.1, 0.5, DECOR.wave],
        [0.9, 0.9, DECOR.tuft],
        [0.3, 0.3, DECOR.sand],
        [0.4, 0.4, DECOR.dune],
        [0.6, 0.6, DECOR.hill],
        [0.7, 0.7, 255],
      ]),
    )
    // O tipo sem desenho (255) fica de fora.
    expect(layer.count).toBe(7)
    const [tree, peak] = layer.view.children as Sprite[]
    expect([tree.x, tree.y]).toEqual([512, 256])
    expect([peak.x, peak.y]).toEqual([256, 768])
    // Cada tipo com a âncora do seu quadro; todos na mesma escala (px do spritesheet → mundo).
    expect([peak.anchor.x, peak.anchor.y]).toEqual([inkAnchor(DECOR.peak).x, inkAnchor(DECOR.peak).y])
    expect([tree.anchor.x, tree.anchor.y]).toEqual([inkAnchor(DECOR.tree).x, inkAnchor(DECOR.tree).y])
    expect(peak.scale.y).toBeCloseTo(DECOR_UNIT / INK_PX)
    expect(tree.scale.y).toBeCloseTo(DECOR_UNIT / INK_PX)
  })

  it('o sprite reaproveitado para outro tipo troca de âncora', () => {
    const layer = new DecorLayer(textures)
    layer.setDecor(decor([[0.5, 0.5, DECOR.tree]]))
    layer.setDecor(decor([[0.5, 0.5, DECOR.wave]]))
    const [wave] = layer.view.children as Sprite[]
    expect([wave.anchor.x, wave.anchor.y]).toEqual([inkAnchor(DECOR.wave).x, inkAnchor(DECOR.wave).y])
  })

  it('cada ícone usa a textura do seu tipo, numa das variações', () => {
    const layer = new DecorLayer(textures)
    layer.setDecor(decor([[0.1, 0.2, DECOR.hill], [0.5, 0.5, DECOR.tree]]))
    const [hill, tree] = layer.view.children as Sprite[]
    expect(textures.get(DECOR.hill)).toContain(hill.texture)
    expect(textures.get(DECOR.tree)).toContain(tree.texture)
  })

  it('esconde os ícones fora da janela de culling e os devolve ao voltar', () => {
    const layer = new DecorLayer(textures)
    layer.setDecor(decor([[0.1, 0.1, DECOR.tree], [0.9, 0.9, DECOR.tree]]))
    layer.update({ x: 0, y: 0, width: 200, height: 200 }, 4)
    expect(layer.drawn).toBe(1)
    expect(visible(layer)).toBe(1)
    layer.update({ x: 824, y: 824, width: 200, height: 200 }, 4)
    expect(visible(layer)).toBe(1)
    expect(layer.view.children[1].visible).toBe(true)
    layer.update(WHOLE, 1)
    expect(visible(layer)).toBe(2)
  })

  it('aproximar sem sair da janela também refaz o culling', () => {
    const layer = new DecorLayer(textures)
    layer.setDecor(decor([[0.1, 0.1, DECOR.tree], [0.5, 0.5, DECOR.tree]]))
    layer.update(WHOLE, 1)
    expect(layer.drawn).toBe(2)
    // 4× no centro: a vista fica dentro da janela do mapa inteiro, mas bem menor.
    layer.update({ x: 384, y: 384, width: 256, height: 256 }, 4)
    expect(layer.drawn).toBe(1)
  })

  it('afastado, desenha menos ícones, mas todas as montanhas', () => {
    const items: Array<[number, number, number]> = []
    for (let i = 0; i < 400; i++) items.push([(i % 20) / 20 + 0.02, Math.floor(i / 20) / 20 + 0.04, i % 4 === 0 ? DECOR.peak : DECOR.tree])
    const layer = new DecorLayer(textures)
    layer.setDecor(decor(items))
    layer.update(WHOLE, 1)
    expect(layer.drawn).toBe(400)
    layer.update(WHOLE, 0.4)
    expect(layer.drawn).toBeLessThan(200)
    const peaks = layer.view.children.filter((_, i) => i % 4 === 0)
    expect(peaks.every((p) => p.visible)).toBe(true)
  })

  it('um campo novo reaproveita os sprites e mostra todos de novo', () => {
    const layer = new DecorLayer(textures)
    layer.setDecor(decor([[0.1, 0.1, DECOR.tree], [0.9, 0.9, DECOR.tree], [0.5, 0.5, DECOR.cactus]]))
    const first = layer.view.children[0]
    layer.update({ x: 0, y: 0, width: 200, height: 200 }, 4)
    layer.setDecor(decor([[0.8, 0.8, DECOR.snowPeak], [0.2, 0.2, DECOR.tree]]))
    expect(layer.view.children).toHaveLength(2)
    expect(layer.view.children[0]).toBe(first)
    expect(visible(layer)).toBe(2)
  })

  it('liga e desliga a camada inteira', () => {
    const layer = new DecorLayer(textures)
    layer.visible = false
    expect(layer.view.visible).toBe(false)
    layer.visible = true
    expect(layer.view.visible).toBe(true)
  })
})

describe('camada pelo estado da interface', () => {
  it('layers.decor do uiStore esconde e mostra a camada, e o host mostra o estado', () => {
    const ui = createUiStore()
    const layer = new DecorLayer(textures)
    layer.setDecor(decor([[0.1, 0.1, DECOR.tree], [0.5, 0.5, DECOR.peak]]))
    layer.update(WHOLE, 1)
    const host = document.createElement('main')
    const unbind = bindDecorLayer(ui, layer)
    writeDecorState(host, layer)
    expect(layer.view.visible).toBe(true)
    expect(host.dataset).toMatchObject({ decorLayer: 'on', decorDrawn: '2' })

    ui.getState().setLayer('decor', false)
    writeDecorState(host, layer)
    expect(layer.view.visible).toBe(false)
    expect(host.dataset).toMatchObject({ decorLayer: 'off', decorDrawn: '0' })

    ui.getState().setLayer('decor', true)
    writeDecorState(host, layer)
    expect(layer.view.visible).toBe(true)
    expect(host.dataset).toMatchObject({ decorLayer: 'on', decorDrawn: '2' })

    // Desfeita a ligação, o estado não mexe mais na camada.
    unbind()
    ui.getState().setLayer('decor', false)
    expect(layer.view.visible).toBe(true)
  })

  it('pan com a camada desligada: ao religar, o culling segue a vista nova', () => {
    const ui = createUiStore()
    const layer = new DecorLayer(textures)
    layer.setDecor(decor([[0.1, 0.1, DECOR.tree], [0.9, 0.9, DECOR.tree]]))
    bindDecorLayer(ui, layer)
    const topLeft = { x: 0, y: 0, width: 200, height: 200 }
    const bottomRight = { x: 824, y: 824, width: 200, height: 200 }
    layer.frame(topLeft, 4)
    expect(layer.view.children.map((c) => c.visible)).toEqual([true, false])

    // Desligada, os quadros do pan não recalculam nada.
    ui.getState().setLayer('decor', false)
    layer.frame(bottomRight, 4)
    expect(layer.view.children.map((c) => c.visible)).toEqual([true, false])

    // Religada, o primeiro quadro refaz o culling na vista onde a câmera parou.
    ui.getState().setLayer('decor', true)
    layer.frame(bottomRight, 4)
    expect(layer.view.children.map((c) => c.visible)).toEqual([false, true])
    expect(layer.drawn).toBe(1)
  })

  it('abre escondida se a camada já está desligada no estado', () => {
    const ui = createUiStore()
    ui.getState().setLayer('decor', false)
    const layer = new DecorLayer(textures)
    bindDecorLayer(ui, layer)
    expect(layer.view.visible).toBe(false)
  })
})
