/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

// Camada de decoração (#48): os ícones aparecem, o culling tira os que ficam fora da tela e o nível
// de detalhe tira parte deles no zoom baixo. O renderer expõe no mapa os ícones com quadro no
// spritesheet (`data-decor-total`) e os desenhados (`data-decor-drawn`). O fps (AC-F2-07) é medido à
// mão, em /sprites.html: o Chrome do teste não usa a GPU.

test.describe.configure({ timeout: 60_000 })

const map = (page: Page) => page.getByTestId('map')
const attr = async (page: Page, name: string) => Number(await map(page).getAttribute(name))

async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(map(page)).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
  await expect(map(page)).toHaveAttribute('data-decor-drawn', /\d/)
}

/** Aperta a tecla `n` vezes e espera o zoom chegar ao esperado. */
async function zoomTo(page: Page, key: string, n: number, check: (z: number) => boolean) {
  for (let i = 0; i < n; i++) await page.keyboard.press(key)
  await expect.poll(() => attr(page, 'data-zoom').then(check), { timeout: 15_000 }).toBe(true)
}

test('os ícones decorativos aparecem no mapa, com a camada ligada', async ({ page }) => {
  await open(page)
  await expect(map(page)).toHaveAttribute('data-decor-layer', 'on')
  const total = await attr(page, 'data-decor-total')
  // Com os parâmetros padrão, o núcleo põe perto de 900 ícones; parte deles tem quadro no spritesheet.
  expect(total).toBeGreaterThan(200)
  // No zoom 1×, o mapa inteiro está à vista: todos são desenhados.
  expect(await attr(page, 'data-decor-drawn')).toBe(total)
})

test('aproximado, o culling desenha só os ícones perto da tela', async ({ page }) => {
  await open(page)
  const total = await attr(page, 'data-decor-total')
  // 1,25⁸ ≈ 6: o zoom para no limite de 4×. A área livre mostra 1/16 do mapa; com a folga da
  // janela de culling, que só encolhe depois de aproximar 1,5×, ficam bem menos da metade dos ícones.
  await zoomTo(page, 'Equal', 8, (z) => z > 3.9)
  await expect.poll(() => attr(page, 'data-decor-drawn')).toBeLessThan(total / 2)
  expect(await attr(page, 'data-decor-drawn')).toBeGreaterThan(0)
  // Centralizar volta ao mapa inteiro, com todos os ícones.
  await zoomTo(page, 'Digit0', 1, (z) => Math.abs(z - 1) < 0.01)
  await expect.poll(() => attr(page, 'data-decor-drawn')).toBe(total)
})

test('afastado, o nível de detalhe desenha menos ícones', async ({ page }) => {
  await open(page)
  const total = await attr(page, 'data-decor-total')
  // 1/1,25⁴ ≈ 0,41: abaixo de 0,55×, fica um quarto dos ícones (mais as montanhas).
  await zoomTo(page, 'Minus', 4, (z) => z < 0.55)
  await expect.poll(() => attr(page, 'data-decor-drawn')).toBeLessThan(total * 0.8)
  expect(await attr(page, 'data-decor-drawn')).toBeGreaterThan(0)
})
