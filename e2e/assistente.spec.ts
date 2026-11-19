/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { gotoEditor, mapShot, stableMapShot } from './editor.ts'

// Assistente de novo mundo (#52, AC-F1-19): até a Lista de mundos (M2), ele abre sobre o editor ao
// carregar o app, com o mundo padrão por trás.

const ARCHIPELAGO: Record<string, number> = {
  Oceano: 66,
  Praias: 55,
  Desertos: 8,
  Florestas: 45,
  Montanhas: 22,
  Neve: 15,
  'Tamanho do continente': 8,
  'Rugosidade da costa': 72,
  'Temperatura global': 64,
}

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

const wizard = (page: Page) => page.getByRole('dialog', { name: 'Novo mundo' })

test('cria o mundo com o nome, o preset e a seed escolhidos e mostra o mapa dele (AC-F1-19)', async ({ page, browser }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const dialog = wizard(page)
  await expect(dialog).toBeVisible()
  // 800 px, centrado.
  const box = (await dialog.boundingBox())!
  expect(Math.round(box.width)).toBe(800)
  expect(Math.round(box.x)).toBe(320)
  // O foco começa no nome, e as 4 miniaturas chegam do worker.
  await expect(dialog.getByRole('textbox', { name: 'Nome do mundo' })).toBeFocused()
  await expect(dialog.locator('canvas[data-ready="true"]')).toHaveCount(4, { timeout: 30_000 })

  const create = dialog.getByRole('button', { name: 'Criar mundo' })
  await expect(create).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Nome do mundo' }).fill('Ilhas do Corvo')
  await dialog.getByRole('button', { name: /Arquipélago/ }).click()
  await expect(dialog.getByRole('button', { name: /Arquipélago/ })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('textbox', { name: /^Seed/ }).fill('corvo-1a2b')
  await create.click()

  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('world-name')).toHaveText('Ilhas do Corvo')
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('corvo-1a2b')
  for (const [name, value] of Object.entries(ARCHIPELAGO)) {
    await expect(page.getByRole('slider', { name, includeHidden: true }), name).toHaveAttribute('aria-valuenow', String(value))
  }
  await waitFinalMap(page)

  // O mapa é o mesmo do mundo feito pela sidebar com a mesma seed e o mesmo preset.
  const other = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await gotoEditor(other)
  await waitFinalMap(other)
  const seed = other.getByRole('textbox', { name: 'Seed' })
  await seed.fill('corvo-1a2b')
  await seed.press('Enter')
  await other.getByRole('button', { name: 'Presets' }).click()
  await other.getByRole('group', { name: 'Presets' }).getByRole('button', { name: /Arquipélago/ }).click()
  await waitFinalMap(other)
  const expected = await stableMapShot(other)
  await other.close()
  await expect.poll(async () => (await mapShot(page)).equals(expected), { timeout: 10_000 }).toBe(true)
})

test('Cancelar fecha o assistente e mantém o mundo padrão', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await wizard(page).getByRole('textbox', { name: 'Nome do mundo' }).fill('Não vale')
  await wizard(page).getByRole('button', { name: /Terras geladas/ }).click()
  await wizard(page).getByRole('button', { name: 'Cancelar' }).click()
  await expect(wizard(page)).toBeHidden()
  await expect(page.getByTestId('world-name')).toHaveText('Terras de Valdora')
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('rpg-world')
  await expect(page.getByRole('slider', { name: 'Oceano' })).toHaveAttribute('aria-valuenow', '45')
  await waitFinalMap(page)
})

test('Esc também fecha o assistente sem mudar o mundo', async ({ page }) => {
  await page.goto('/')
  await expect(wizard(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(wizard(page)).toBeHidden()
  await expect(page.getByTestId('world-name')).toHaveText('Terras de Valdora')
})

test('celular 390: o assistente cabe na tela, rola e cria o mundo (AC-F1-19)', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const dialog = wizard(page)
  await expect(dialog).toBeVisible()
  const box = (await dialog.boundingBox())!
  expect([Math.round(box.x), Math.round(box.width)]).toEqual([16, 390 - 32])
  expect(box.height).toBeLessThanOrEqual(844 - 32)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

  await dialog.getByRole('textbox', { name: 'Nome do mundo' }).fill('Mar de Brumas')
  await dialog.getByRole('button', { name: /Deserto árido/ }).click()
  await dialog.getByRole('textbox', { name: /^Seed/ }).fill('brumas-0042')
  await dialog.getByRole('button', { name: 'Criar mundo' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Abrir painel' }).click()
  await expect(page.getByTestId('world-name')).toHaveText('Mar de Brumas')
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('brumas-0042')
  await expect(page.getByRole('slider', { name: 'Desertos' })).toHaveAttribute('aria-valuenow', '62')
})
