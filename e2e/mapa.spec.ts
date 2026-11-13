/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { BIOME_TONES, CANVAS_BACKGROUND, COAST_STROKE } from '../src/render/style/palette.ts'

// Terreno em textura (#46, AC-F1-22): o editor desenha o mapa gerado. A comparação com o mockup
// aprovado é por print no PR; aqui fica que o mapa aparece, no lugar certo, com as cores da paleta.

const LAND = ['beach', 'grassland', 'forest', 'desert', 'hill', 'rockyMountain', 'snow'] as const

/** Abre o editor e espera o mapa final 1024² desenhado. */
async function openMap(page: Page, width: number, height: number) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width, height })
  await page.goto('/')
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
  const [x, y, w, h] = ((await map.getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return { rect: { x, y, width: w, height: h }, errors }
}

/** Cores (#RRGGBB) de uma grade de `n × n` pontos dentro do retângulo, lidas de um print da página. */
async function sampleColors(page: Page, rect: { x: number; y: number; width: number; height: number }, n = 24) {
  const png = (await page.screenshot({ clip: rect })).toString('base64')
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

test('desktop 1440×900: o mapa gerado aparece entre a sidebar e o drawer, com a paleta (AC-F1-22)', async ({ page }) => {
  const { rect, errors } = await openMap(page, 1440, 900)
  // A área livre é 1440 − 320 − 400 = 720 px: o mapa quadrado cabe nela, centrado na altura.
  expect(rect).toEqual({ x: 320, y: 90, width: 720, height: 720 })
  await expect(page.getByTestId('map-canvas')).toBeVisible()

  const colors = await sampleColors(page, rect)
  const land = new Set<string>(LAND.flatMap((b) => BIOME_TONES[b]))
  const landShare = colors.filter((c) => land.has(c)).length / colors.length
  // Com Oceano em 45, perto de metade do mapa é terra.
  expect(landShare).toBeGreaterThan(0.3)
  expect(colors).toContain(BIOME_TONES.deepOcean[0])
  expect(errors).toEqual([])
})

test('a costa tem o traço #163A5C entre a terra e a água (AC-F1-22)', async ({ page }) => {
  const { rect } = await openMap(page, 1440, 900)
  // Com o mapa reduzido para caber na tela, a textura é filtrada: o traço chega perto da cor, não igual.
  const colors = await sampleColors(page, rect, 160)
  const near = (a: string, b: string) => {
    const [x, y] = [a, b].map((c) => [1, 3, 5].map((k) => Number.parseInt(c.slice(k, k + 2), 16)))
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 20
  }
  expect(colors.filter((c) => near(c, COAST_STROKE.color)).length).toBeGreaterThan(20)
})

// O retângulo exato em cada largura (#91): a partir de 768 px o mapa cabe entre a sidebar (320) e
// o drawer (400); abaixo disso os painéis são sobrepostos e o mapa usa a largura toda. Um erro em
// `panelInsets` que aplicasse os recuos no celular deixaria a área livre negativa e falharia aqui.
for (const [label, width, height, expected] of [
  // Área livre 1024 − 320 − 400 = 304 px de largura: o mapa 304², centrado na altura (768 − 304) / 2.
  ['tablet 1024', 1024, 768, { x: 320, y: 232, width: 304, height: 304 }],
  // Sem recuos: o mapa 390², centrado na altura (844 − 390) / 2.
  ['celular 390', 390, 844, { x: 0, y: 227, width: 390, height: 390 }],
] as const) {
  test(`${label}: o mapa aparece inteiro na área livre (AC-F1-22)`, async ({ page }) => {
    const { rect, errors } = await openMap(page, width, height)
    expect(rect).toEqual(expected)
    const colors = await sampleColors(page, rect, 12)
    expect(colors.some((c) => c !== CANVAS_BACKGROUND)).toBe(true)
    expect(errors).toEqual([])
  })
}
