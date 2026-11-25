/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, gotoEditor, putWorlds } from './editor.ts'

// Dicas de boas-vindas (#166, AC-F1-31). Os outros testes abrem o editor com a marca de dicas vistas
// (playwright.config.ts); aqui o navegador começa sem ela, como no primeiro acesso.

test.describe.configure({ timeout: 60_000 })
test.use({ storageState: { cookies: [], origins: [] } })

const tips = (page: Page) => page.getByRole('dialog', { name: /./ }).and(page.getByTestId('welcome-tips'))
const highlighted = (page: Page) => page.locator('[data-welcome-highlight="true"]')

/** Fecha o editor e o abre de novo pela lista (sem recarregar). */
async function reopen(page: Page) {
  await page.getByRole('button', { name: 'Voltar à lista de mundos' }).click()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await expect(page.getByTestId('editor')).toBeVisible()
}

test('no primeiro acesso, as dicas apresentam os sliders, a toolbar e o adicionar pin e não voltam depois de vistas (AC-F1-31)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoEditor(page)
  const card = tips(page)
  await expect(card).toBeVisible()
  await expect(card).toContainText('1 de 3')
  await expect(card.getByRole('heading')).toHaveText('Molde o mundo')
  await expect(highlighted(page)).toHaveCount(1)
  await expect(highlighted(page)).toHaveAttribute('data-testid', 'sidebar')

  await card.getByRole('button', { name: 'Próxima' }).click()
  await expect(card).toContainText('2 de 3')
  await expect(card.getByRole('heading')).toHaveText('Ferramentas do mapa')
  await expect(highlighted(page)).toHaveAttribute('role', 'toolbar')

  await card.getByRole('button', { name: 'Próxima' }).click()
  await expect(card).toContainText('3 de 3')
  await expect(card.getByRole('heading')).toHaveText('Marque lugares')
  await expect(highlighted(page)).toHaveAttribute('aria-label', 'Adicionar pin')

  await card.getByRole('button', { name: 'Começar' }).click()
  await expect(card).toHaveCount(0)
  await expect(highlighted(page)).toHaveCount(0)

  await page.reload()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await expect(page.getByTestId('editor')).toBeVisible()
  await expect(tips(page)).toHaveCount(0)
})

test('Pular fecha as dicas, e elas não voltam ao recarregar nem em outro mundo (AC-F1-31)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await putWorlds(page, [defaultWorld(), defaultWorld({ id: 'mundo-dois', name: 'Ilhas de Brumar', seed: 'brumar' })])
  await page.reload()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await expect(tips(page)).toBeVisible()
  await tips(page).getByRole('button', { name: 'Pular' }).click()
  await expect(tips(page)).toHaveCount(0)
  await reopen(page)
  await expect(tips(page)).toHaveCount(0)
  // Outro mundo: a marca é do navegador, não do mundo.
  await page.getByRole('button', { name: 'Voltar à lista de mundos' }).click()
  await page.getByRole('button', { name: /^Ilhas de Brumar/ }).click()
  await expect(page.getByTestId('editor')).toBeVisible()
  await expect(tips(page)).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await expect(page.getByTestId('editor')).toBeVisible()
  await expect(tips(page)).toHaveCount(0)
})

test('sair do editor sem ver nem pular as dicas: elas voltam no próximo acesso (AC-F1-31)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoEditor(page)
  await expect(tips(page)).toBeVisible()
  await reopen(page)
  await expect(tips(page)).toContainText('1 de 3')
})

for (const { name, width, height, mobile } of [
  { name: 'tablet', width: 1024, height: 768, mobile: false },
  { name: 'celular', width: 390, height: 844, mobile: true },
  { name: 'celular deitado', width: 844, height: 390, mobile: true },
]) {
  test(`${name}: o cartão cabe entre a barra de ações e a toolbar (AC-F1-31)`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await gotoEditor(page)
    const card = tips(page)
    await expect(card).toBeVisible()
    const box = (await card.boundingBox())!
    const actions = (await page.getByTestId('actions').boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(actions.y + actions.height)
    expect(box.x).toBeGreaterThanOrEqual(mobile ? 12 : 320)
    expect(box.x + box.width).toBeLessThanOrEqual(width - 12)
    const toolbar = (await page.getByRole('toolbar', { name: 'Ferramentas' }).boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(toolbar.y)
    // Abaixo de 768 px (ou na tela baixa), os sliders ficam atrás do Abrir painel: é ele que ganha o contorno.
    if (mobile) {
      await expect(highlighted(page)).toHaveAttribute('aria-label', 'Abrir painel')
      await expect(card).toContainText('Abra o painel')
    } else await expect(highlighted(page)).toHaveAttribute('data-testid', 'sidebar')
    await card.getByRole('button', { name: 'Fechar dicas' }).click()
    await expect(card).toHaveCount(0)
  })
}
