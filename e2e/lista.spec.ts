/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, putWorlds } from './editor.ts'

// Lista de mundos (#155, AC-F4-04 a AC-F4-06): a tela inicial. Cada teste tem um contexto novo do
// navegador, então o banco começa vazio.

const list = (page: Page) => page.getByTestId('world-list')
const cards = (page: Page) => page.getByTestId('world-card')

test('lista vazia → criar → voltar → o cartão aparece → abrir (AC-F4-04, AC-F4-05, AC-F4-06)', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  // 02 · Lista vazia.
  await expect(list(page)).toHaveAttribute('data-state', 'empty')
  await expect(page.getByRole('heading', { name: 'Seus mundos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nenhum mundo ainda' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'importe um arquivo .json' })).toBeVisible()
  await expect(page.getByTestId('world-count')).toHaveCount(0)

  // Criar salva e abre o mundo no editor.
  await page.getByRole('button', { name: 'Criar meu primeiro mundo' }).click()
  const wizard = page.getByRole('dialog', { name: 'Novo mundo' })
  await wizard.getByRole('textbox', { name: 'Nome do mundo' }).fill('Ilhas do Corvo')
  await wizard.getByRole('textbox', { name: /^Seed/ }).fill('corvo-1a2b')
  await wizard.getByRole('button', { name: 'Criar mundo' }).click()
  await expect(page.getByTestId('world-name')).toHaveText('Ilhas do Corvo')
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-status', 'saved')

  // Voltar pelo cabeçalho da sidebar: o cartão do mundo novo, com a miniatura do worker.
  await page.getByRole('button', { name: 'Voltar à lista de mundos' }).click()
  await expect(list(page)).toHaveAttribute('data-state', 'ready')
  await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).getByTestId('world-card-name')).toHaveText('Ilhas do Corvo')
  await expect(cards(page).getByTestId('world-card-caption')).toHaveText('Editado agora · sem pins')
  await expect(cards(page).locator('canvas[data-ready="true"]')).toHaveCount(1, { timeout: 30_000 })
  const thumb = (await cards(page).locator('canvas').boundingBox())!
  expect(thumb.width / thumb.height).toBeCloseTo(16 / 10, 1)

  // Recarregar continua na lista; o cartão abre o mundo.
  await page.reload()
  await page.getByRole('button', { name: /^Ilhas do Corvo/ }).click()
  await expect(page.getByTestId('world-name')).toHaveText('Ilhas do Corvo')
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('corvo-1a2b')
})

test('alterna entre dois mundos, cada um com a sua seed (AC-F4-06)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await putWorlds(page, [
    defaultWorld({ id: 'a', name: 'Terras de Valdora', seed: 'valdora-7f3a', updatedAt: '2026-11-21T10:00:00.000Z' }),
    defaultWorld({ id: 'b', name: 'Vale Sombrio', seed: 'sombrio-0001', updatedAt: '2026-11-20T10:00:00.000Z' }),
  ])
  await page.reload()
  await expect(page.getByTestId('world-count')).toHaveText('2 mundos')
  await expect(cards(page).getByTestId('world-card-name')).toHaveText(['Terras de Valdora', 'Vale Sombrio'])

  await page.getByRole('button', { name: /^Vale Sombrio/ }).click()
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('sombrio-0001')
  await page.getByRole('button', { name: 'Voltar à lista de mundos' }).click()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await expect(page.getByTestId('world-name')).toHaveText('Terras de Valdora')
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('valdora-7f3a')
})

for (const [width, height, columns] of [
  [1440, 900, 4],
  [1024, 768, 3],
  [390, 844, 1],
] as const) {
  test(`${width} px: a grade tem ${columns} coluna(s) e nada passa da largura da tela (AC-F4-04)`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await putWorlds(
      page,
      Array.from({ length: 5 }, (_, i) => defaultWorld({ id: `m${i}`, name: `Mundo ${i + 1}`, seed: `seed-${i}` })),
    )
    await page.reload()
    await expect(cards(page)).toHaveCount(5)
    const tops = await cards(page).evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
    expect(tops.filter((t) => t === tops[0])).toHaveLength(columns)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    const header = (await page.locator('header').first().boundingBox())!
    expect(Math.round(header.height)).toBe(72)
  })
}
