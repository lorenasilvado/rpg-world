/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { stableMapShot } from './editor.ts'

// Salvamento automático no IndexedDB e reabrir ao recarregar (#154, AC-F4-01 e AC-F4-02). Cada teste
// tem um contexto novo do navegador, então o banco começa vazio e o app abre com o assistente.

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

async function createWorld(page: Page, name: string, seed: string) {
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: 'Novo mundo' })
  await dialog.getByRole('textbox', { name: 'Nome do mundo' }).fill(name)
  await dialog.getByRole('textbox', { name: /^Seed/ }).fill(seed)
  await dialog.getByRole('button', { name: 'Criar mundo' }).click()
  await expect(dialog).toBeHidden()
}

const indicator = (page: Page) => page.getByTestId('save-indicator')

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('mexer no mundo salva sozinho, e recarregar reabre o mundo igual (AC-F4-01, AC-F4-02)', async ({ page }) => {
  test.setTimeout(90_000)
  await createWorld(page, 'Mar de Brumas', 'brumas-0042')
  await expect(indicator(page)).toHaveAttribute('data-status', 'saved')
  await waitFinalMap(page)

  const ocean = page.getByRole('slider', { name: 'Oceano' })
  await ocean.focus()
  await ocean.press('ArrowRight')
  await ocean.press('ArrowRight')
  await expect(indicator(page)).toHaveAttribute('data-status', 'saving')
  await expect(indicator(page)).toContainText('Salvando…')
  await expect(indicator(page)).toHaveAttribute('data-status', 'saved')
  await expect(indicator(page)).toContainText('Salvo')
  await waitFinalMap(page)
  const before = await stableMapShot(page)

  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Novo mundo' })).toHaveCount(0)
  await expect(page.getByTestId('world-name')).toHaveText('Mar de Brumas')
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('brumas-0042')
  await expect(page.getByRole('slider', { name: 'Oceano' })).toHaveAttribute('aria-valuenow', '47')
  await expect(indicator(page)).toHaveAttribute('data-status', 'saved')
  await waitFinalMap(page)
  expect((await stableMapShot(page)).equals(before), 'mesmo terreno depois de recarregar').toBe(true)
})

test('se a gravação falha, o indicador mostra "Erro ao salvar" e oferece "Tentar de novo" (AC-F4-02)', async ({ page }) => {
  test.setTimeout(90_000)
  await createWorld(page, 'Ilhas de Cinza', 'cinza-0001')
  await expect(indicator(page)).toHaveAttribute('data-status', 'saved')
  await waitFinalMap(page)

  // Toda escrita no IndexedDB falha, como com a cota cheia.
  await page.evaluate(() => {
    const w = window as unknown as { __put?: typeof IDBObjectStore.prototype.put }
    w.__put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Cota cheia', 'QuotaExceededError')
    }
  })
  const ocean = page.getByRole('slider', { name: 'Oceano' })
  await ocean.focus()
  await ocean.press('ArrowLeft')
  const error = page.getByRole('button', { name: 'Erro ao salvar' })
  await expect(error).toBeVisible()

  // A próxima mudança tenta de novo (e falha de novo).
  await ocean.press('ArrowLeft')
  await expect(indicator(page)).toHaveAttribute('data-status', 'saving')
  await expect(error).toBeVisible()

  await error.click()
  const menu = page.getByRole('menu', { name: 'Erro ao salvar' })
  await expect(menu.getByRole('menuitem', { name: 'Exportar .json' })).toBeDisabled()
  await page.evaluate(() => {
    const w = window as unknown as { __put: typeof IDBObjectStore.prototype.put }
    IDBObjectStore.prototype.put = w.__put
  })
  await menu.getByRole('menuitem', { name: 'Tentar de novo' }).click()
  await expect(indicator(page)).toHaveAttribute('data-status', 'saved')

  await page.reload()
  await expect(page.getByTestId('world-name')).toHaveText('Ilhas de Cinza')
  await expect(page.getByRole('slider', { name: 'Oceano' })).toHaveAttribute('aria-valuenow', '43')
})
