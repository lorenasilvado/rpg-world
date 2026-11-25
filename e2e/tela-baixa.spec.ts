/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { centerPin, defaultWorld, gotoEditor } from './editor.ts'

// Celular deitado (#231): em tela baixa (menos de 500 px de altura), sidebar e drawer são painéis
// sobrepostos (AC-F2-14), e a toolbar fica na linha inferior, sem cobrir o meio do mapa (AC-F2-15).

const map = (page: Page) => page.getByTestId('map')

async function openEditor(page: Page) {
  await gotoEditor(page, '/', defaultWorld({ pins: [centerPin] }))
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(map(page)).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

/** O ponto da tela de (u, v) do mapa. */
async function screenOf(page: Page, u: number, v: number) {
  const [x, y, w, h] = ((await map(page).getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  const box = (await map(page).boundingBox())!
  return { x: box.x + x + u * w, y: box.y + y + v * h }
}

/** A toolbar fica na linha inferior (16 px da base) e não cobre o meio da tela. */
async function expectToolbarAtBottom(page: Page, height: number) {
  const bar = page.getByRole('toolbar', { name: 'Ferramentas' })
  // Depois de girar, a toolbar desliza até a linha (200 ms): espera a posição final.
  await expect.poll(async () => Math.round((await bar.boundingBox())!.y + (await bar.boundingBox())!.height)).toBe(height - 16)
  const toolbar = (await bar.boundingBox())!
  expect(toolbar.y).toBeGreaterThan(height / 2 + 40)
  return toolbar
}

test.describe('844×390 (celular deitado, 768 px ou mais de largura)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })

  test('AC-F2-14: a sidebar é um painel sobreposto, e todas as seções, até Avançado, são alcançáveis', async ({ page }) => {
    test.setTimeout(90_000)
    await openEditor(page)
    const sidebar = page.getByTestId('sidebar')
    // Fechada, fora da tela: o mapa usa a largura toda.
    await expect(sidebar).toHaveAttribute('data-open', 'false')
    expect((await sidebar.boundingBox())!.x).toBeLessThan(0)
    await page.getByRole('button', { name: 'Abrir painel' }).click()
    await expect(sidebar).toHaveAttribute('data-open', 'true')
    await expect(page.getByTestId('scrim')).toBeVisible()

    // A última seção rola até a vista e abre; o slider dela fica à vista.
    const advanced = sidebar.getByRole('button', { name: 'Avançado' })
    await advanced.scrollIntoViewIfNeeded()
    await advanced.click()
    const last = sidebar.getByRole('slider').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport({ ratio: 1 })
    // O rodapé ("Restaurar padrão") também é alcançável.
    const restore = sidebar.getByRole('button', { name: 'Restaurar padrão' })
    await restore.scrollIntoViewIfNeeded()
    await expect(restore).toBeInViewport({ ratio: 1 })
  })

  test('AC-F2-15: a toolbar fica na linha inferior, o minimapa começa recolhido nela, e o toque no pin do centro o seleciona; o drawer é sobreposto', async ({ page }) => {
    test.setTimeout(90_000)
    await openEditor(page)
    const toolbar = await expectToolbarAtBottom(page, 390)
    const minimap = page.getByTestId('minimap')
    await expect(minimap).toHaveAttribute('data-open', 'false')
    await expect(page.getByTestId('minimap-top')).toHaveCount(0)
    // Minimapa, toolbar e zoom não se cobrem.
    const mini = (await minimap.boundingBox())!
    const zoom = (await page.getByRole('button', { name: 'Afastar' }).locator('xpath=..').boundingBox())!
    expect(mini.x + mini.width).toBeLessThanOrEqual(toolbar.x)
    expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(zoom.x)

    const p = await screenOf(page, 0.5, 0.5)
    await page.touchscreen.tap(p.x, p.y - 16)
    await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-centro')
    const drawer = page.getByTestId('drawer')
    await expect(drawer).toHaveAttribute('data-open', 'true')
    await expect(page.getByTestId('scrim')).toBeVisible()
  })
})

test.describe('667×375 (celular deitado estreito)', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true })

  test('AC-F2-15: o minimapa vai para o canto superior esquerdo, recolhido, e abre ali; a toolbar fica na linha com o zoom', async ({ page }) => {
    test.setTimeout(90_000)
    await openEditor(page)
    const toolbar = await expectToolbarAtBottom(page, 375)
    const top = page.getByTestId('minimap-top')
    await expect(top).toBeVisible()
    const minimap = top.getByTestId('minimap')
    await expect(minimap).toHaveAttribute('data-open', 'false')
    const box = (await minimap.boundingBox())!
    expect([Math.round(box.x), Math.round(box.y)]).toEqual([16, 12])
    // Não cobre a barra de ações.
    const actions = (await page.getByTestId('actions').boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(actions.x)

    await minimap.getByRole('button', { name: /Minimapa/ }).tap()
    await expect(minimap).toHaveAttribute('data-open', 'true')
    // A toolbar não sai do lugar.
    expect(await page.getByRole('toolbar', { name: 'Ferramentas' }).boundingBox()).toEqual(toolbar)
  })
})

test('girar o celular: o minimapa recolhido da tela baixa não muda a preferência das telas altas (AC-F2-15)', async ({ browser }) => {
  test.setTimeout(90_000)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  try {
    const page = await ctx.newPage()
    await openEditor(page)
    const minimap = page.getByTestId('minimap')
    await expect(minimap).toHaveAttribute('data-open', 'true')
    // Deitado: recolhido; em pé de novo: aberto, como estava.
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(minimap).toHaveAttribute('data-open', 'false')
    await expectToolbarAtBottom(page, 390)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(minimap).toHaveAttribute('data-open', 'true')
  } finally {
    await ctx.close()
  }
})

// O scrim só fecha o clique que começou nele (AC-F2-15): o toque nele, que manda pointerdown,
// pointerup, pointerleave e click, fecha o painel, em pé e deitado.
for (const [width, height] of [[390, 844], [844, 390]] as const) {
  test(`${width}×${height}: tocar no scrim fecha a sidebar e o drawer`, async ({ browser }) => {
    test.setTimeout(90_000)
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true })
    try {
      const page = await ctx.newPage()
      await openEditor(page)
      const sidebar = page.getByTestId('sidebar')
      await page.getByRole('button', { name: 'Abrir painel' }).tap()
      await expect(sidebar).toHaveAttribute('data-open', 'true')
      await page.touchscreen.tap(width - 20, height / 2)
      await expect(sidebar).toHaveAttribute('data-open', 'false')

      // O drawer, aberto pelo toque no pin (o clique gerado depois desse toque não o fecha).
      const p = await screenOf(page, 0.5, 0.5)
      await page.touchscreen.tap(p.x, p.y - 16)
      const drawer = page.getByTestId('drawer')
      await expect(drawer).toHaveAttribute('data-open', 'true')
      await page.waitForTimeout(300)
      await expect(drawer).toHaveAttribute('data-open', 'true')
      // Deitado, o drawer não cobre a tela toda: o toque à esquerda dele cai no scrim e o fecha.
      if (width > 400) {
        await page.touchscreen.tap(20, height / 2)
        await expect(drawer).toHaveAttribute('data-open', 'false')
        await expect(map(page)).toHaveAttribute('data-pin-selected', '')
      }
    } finally {
      await ctx.close()
    }
  })
}
