/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

// Camada de decoração (#48): os ícones aparecem, o culling tira os que ficam fora da tela e o nível
// de detalhe tira parte deles no zoom baixo. O renderer expõe no mapa os ícones com quadro no
// spritesheet (`data-decor-total`) e os desenhados (`data-decor-drawn`). O fps (AC-F2-07) é medido à
// mão, em /sprites.html: o Chrome do teste não usa a GPU.

test.describe.configure({ timeout: 60_000 })

const map = (page: Page) => page.getByTestId('map')
const attr = async (page: Page, name: string) => Number(await map(page).getAttribute(name))

async function open(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await expect(map(page)).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
  await expect(map(page)).toHaveAttribute('data-decor-drawn', /\d/)
}

/**
 * Em 4×, a janela de culling depende do zoom intermediário em que foi calculada (ela só encolhe
 * depois de aproximar 1,5×, então pode vir de até 4/1,5 ≈ 2,7×, com o dobro da largura da vista
 * mais a folga). Cinco passos de pan para a direita (uma área livre inteira) tiram a vista de
 * qualquer uma dessas janelas, e ela é refeita já em 4×: a contagem não depende da velocidade dos
 * quadros.
 */
async function panOutOfWindow(page: Page) {
  const before = await map(page).getAttribute('data-map-rect')
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  await expect.poll(() => map(page).getAttribute('data-map-rect')).not.toBe(before)
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
  // janela de culling, ficam bem menos da metade dos ícones.
  await zoomTo(page, 'Equal', 8, (z) => z > 3.9)
  await panOutOfWindow(page)
  await expect.poll(() => attr(page, 'data-decor-drawn')).toBeLessThan(total / 2)
  expect(await attr(page, 'data-decor-drawn')).toBeGreaterThan(0)
  // Centralizar volta ao mapa inteiro, com todos os ícones.
  await zoomTo(page, 'Digit0', 1, (z) => Math.abs(z - 1) < 0.01)
  await expect.poll(() => attr(page, 'data-decor-drawn')).toBe(total)
})

test('afastado, o nível de detalhe tira ícones em dois degraus', async ({ page }) => {
  await open(page)
  const total = await attr(page, 'data-decor-total')
  // 1/1,25² = 0,64: entre 0,55× e 0,8×, fica metade dos ícones (mais as montanhas).
  await zoomTo(page, 'Minus', 2, (z) => z > 0.55 && z < 0.8)
  await expect.poll(() => attr(page, 'data-decor-drawn')).toBeLessThan(total)
  const half = await attr(page, 'data-decor-drawn')
  // 1/1,25³ ≈ 0,51: abaixo de 0,55×, fica um quarto (mais as montanhas), menos que no degrau anterior.
  await zoomTo(page, 'Minus', 1, (z) => z < 0.55)
  await expect.poll(() => attr(page, 'data-decor-drawn')).toBeLessThan(half)
  expect(await attr(page, 'data-decor-drawn')).toBeGreaterThan(0)
})

// Abaixo de 768 px, a sidebar e o drawer são painéis sobrepostos, e a área livre é a tela toda
// (`panelInsets`): o culling usa esse retângulo.
test('celular 390×844: os ícones aparecem em 1× e o culling tira os de fora em 4×', async ({ page }) => {
  await open(page, 390, 844)
  const total = await attr(page, 'data-decor-total')
  expect(total).toBeGreaterThan(200)
  expect(await attr(page, 'data-decor-drawn')).toBe(total)
  await zoomTo(page, 'Equal', 8, (z) => z > 3.9)
  await panOutOfWindow(page)
  // Em retrato, a janela em 4× cobre 81% da altura do mapa (e 37% da largura): depois do pan,
  // sobre a cordilheira e a floresta do leste, ficam perto de 60% dos ícones, não menos da metade.
  await expect.poll(() => attr(page, 'data-decor-drawn')).toBeLessThan(total * 0.75)
  expect(await attr(page, 'data-decor-drawn')).toBeGreaterThan(0)
})
