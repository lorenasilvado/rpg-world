/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { BIOME_TONES, CANVAS_BACKGROUND, COAST_STROKE } from '../src/render/style/palette.ts'
import { gotoEditor, mapShot, stableMapShot } from './editor.ts'

// Terreno em textura (#46, AC-F1-22): o editor desenha o mapa gerado. A comparação com o mockup
// aprovado é por print no PR; aqui fica que o mapa aparece, no lugar certo, com as cores da paleta.

const LAND = ['beach', 'grassland', 'forest', 'desert', 'hill', 'rockyMountain', 'snow'] as const
const WATER = ['deepOcean', 'shallowWater', 'lake'] as const

/** Abre o editor e espera o mapa final 1024² desenhado. */
async function openMap(page: Page, width: number, height: number) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width, height })
  await gotoEditor(page)
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
  await stableMapShot(page)
  const [x, y, w, h] = ((await map.getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return { rect: { x, y, width: w, height: h }, errors }
}

/**
 * Cores (#RRGGBB) de uma grade de `n × n` pontos no retângulo do mapa, lidas do print só do mapa
 * (`mapShot`, sem os controles por cima: com a toolbar na segunda linha, ela fica sobre o mapa).
 */
async function sampleColors(page: Page, n = 24) {
  const png = (await mapShot(page)).toString('base64')
  return page.evaluate(
    async ([data, n]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${data}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const out: string[] = []
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = Math.floor(((i + 0.5) / n) * img.width)
          const y = Math.floor(((j + 0.5) / n) * img.height)
          const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
          out.push('#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase())
        }
      }
      return out
    },
    [png, n] as const,
  )
}

test('desktop 1440×900: o mapa gerado aparece entre a sidebar e a borda direita, com a paleta (AC-F1-22)', async ({ page }) => {
  const { rect, errors } = await openMap(page, 1440, 900)
  // Sem pin, o drawer fica fora da tela (AC-F3-19): a área livre é 1440 − 320 = 1120 × 900, e o mapa
  // quadrado (900²) cabe nela, centrado na largura.
  expect(rect).toEqual({ x: 430, y: 0, width: 900, height: 900 })
  await expect(page.getByTestId('map-canvas')).toBeVisible()

  const colors = await sampleColors(page)
  const land = new Set<string>(LAND.flatMap((b) => BIOME_TONES[b]))
  const water = new Set<string>(WATER.flatMap((b) => BIOME_TONES[b]))
  const onLand = colors.filter((c) => land.has(c)).length
  const onWater = colors.filter((c) => water.has(c)).length
  // Os pontos que caem num ícone da decoração (ou no traço da costa) não têm a cor da paleta: a
  // proporção conta só os que caem no terreno. Com Oceano em 45, perto de metade do mapa é terra.
  expect(onLand + onWater).toBeGreaterThan(colors.length / 2)
  expect(onLand / (onLand + onWater)).toBeGreaterThan(0.3)
  expect(colors).toContain(BIOME_TONES.deepOcean[0])
  expect(errors).toEqual([])
})

test('a costa tem o traço #163A5C entre a terra e a água (AC-F1-22)', async ({ page }) => {
  await openMap(page, 1440, 900)
  // Com o mapa reduzido para caber na tela, a textura é filtrada: o traço chega perto da cor, não igual.
  const colors = await sampleColors(page, 160)
  const near = (a: string, b: string) => {
    const [x, y] = [a, b].map((c) => [1, 3, 5].map((k) => Number.parseInt(c.slice(k, k + 2), 16)))
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 20
  }
  expect(colors.filter((c) => near(c, COAST_STROKE.color)).length).toBeGreaterThan(20)
})

// O retângulo exato em cada largura (#91): a partir de 768 px o mapa cabe entre a sidebar (320) e
// a borda direita (sem pin, o drawer fica fora da tela, AC-F3-19); abaixo disso os painéis são sobrepostos e o mapa usa a largura toda. Um erro em
// `panelInsets` que aplicasse os recuos no celular deixaria a área livre negativa e falharia aqui.
for (const [label, width, height, expected] of [
  // Área livre 1024 − 320 = 704 px de largura: o mapa 704², centrado na altura (768 − 704) / 2.
  ['tablet 1024', 1024, 768, { x: 320, y: 32, width: 704, height: 704 }],
  // Sem recuos: o mapa 390², centrado na altura (844 − 390) / 2.
  ['celular 390', 390, 844, { x: 0, y: 227, width: 390, height: 390 }],
  // Dos dois lados do limite de 768 px (#105): se o breakpoint de `panelInsets` mudar, um deles falha.
  // 767: ainda sem recuos, o mapa 767², centrado na altura (867 − 767) / 2.
  ['limite 767', 767, 867, { x: 0, y: 50, width: 767, height: 767 }],
  // 768: já com o recuo da sidebar, a área livre é 768 − 320 = 448 px: o mapa 448², centrado em (900 − 448) / 2.
  ['limite 768', 768, 900, { x: 320, y: 226, width: 448, height: 448 }],
] as const) {
  test(`${label}: o mapa ocupa o retângulo exato da área livre (AC-F1-22)`, async ({ page }) => {
    const { rect, errors } = await openMap(page, width, height)
    expect(rect).toEqual(expected)
    const colors = await sampleColors(page, 12)
    expect(colors.some((c) => c !== CANVAS_BACKGROUND)).toBe(true)
    expect(errors).toEqual([])
  })
}
