/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { gotoEditor, mapShot } from './editor.ts'

// Sidebar: seed, presets e restaurar (#50). A fração de deserto do "Deserto árido" é conferida no
// núcleo (src/state/presets.test.ts); aqui fica o caminho real na tela.

const DEFAULTS: Record<string, number> = {
  Oceano: 45,
  Praias: 30,
  Desertos: 15,
  Florestas: 35,
  Montanhas: 30,
  Neve: 40,
  'Tamanho do continente': 50,
  'Rugosidade da costa': 50,
  'Temperatura global': 50,
}
const ARID: Record<string, number> = {
  Oceano: 32,
  Praias: 25,
  Desertos: 62,
  Florestas: 10,
  Montanhas: 34,
  Neve: 12,
  'Tamanho do continente': 74,
  'Rugosidade da costa': 45,
  'Temperatura global': 85,
}

async function openEditor(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await gotoEditor(page)
  await waitFinalMap(page)
}

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

/** Confere o valor dos 9 sliders (abre Avançado antes, se precisar). */
async function expectSliders(page: Page, values: Record<string, number>) {
  for (const [name, value] of Object.entries(values)) {
    await expect(page.getByRole('slider', { name, includeHidden: true }), name).toHaveAttribute('aria-valuenow', String(value))
  }
}

test('editar e sortear a seed regenera o mapa, e copiar copia a seed (AC-F1-15)', async ({ page, context }) => {
  test.setTimeout(90_000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openEditor(page)
  const seed = page.getByRole('textbox', { name: 'Seed' })
  await expect(seed).toHaveValue('rpg-world')

  let before = await mapShot(page)
  await seed.fill('valdora')
  await seed.press('Enter')
  await waitFinalMap(page)
  await expect.poll(async () => (await mapShot(page)).equals(before)).toBe(false)

  before = await mapShot(page)
  await page.getByRole('button', { name: 'Seed aleatória' }).click()
  await expect(seed).not.toHaveValue('valdora')
  await waitFinalMap(page)
  await expect.poll(async () => (await mapShot(page)).equals(before)).toBe(false)

  const rolled = await seed.inputValue()
  await page.getByRole('button', { name: 'Copiar seed' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Seed copiada' })).toHaveCount(1)
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(rolled)
})

test('escolher um preset aplica os valores dele, e "Restaurar padrão" volta ao padrão (AC-F1-16, AC-F1-17)', async ({ page }) => {
  test.setTimeout(90_000)
  await openEditor(page)
  await page.getByRole('button', { name: 'Presets' }).click()
  const presets = page.getByRole('group', { name: 'Presets' })
  await expect(presets.getByRole('button', { name: /Continente temperado/ })).toHaveAttribute('aria-pressed', 'true')

  const before = await mapShot(page)
  await presets.getByRole('button', { name: /Deserto árido/ }).click()
  await expect(presets.getByRole('button', { name: /Deserto árido/ })).toHaveAttribute('aria-pressed', 'true')
  await expectSliders(page, ARID)
  await waitFinalMap(page)
  await expect.poll(async () => (await mapShot(page)).equals(before)).toBe(false)

  await page.getByRole('button', { name: 'Restaurar padrão' }).click()
  await expectSliders(page, DEFAULTS)
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('rpg-world')
  await expect(presets.getByRole('button', { name: /Continente temperado/ })).toHaveAttribute('aria-pressed', 'true')
  await waitFinalMap(page)
  await expect.poll(async () => (await mapShot(page)).equals(before)).toBe(true)
})

test('celular 390: no painel sobreposto, seed, preset e "Restaurar padrão" funcionam (AC-F1-15, AC-F1-16, AC-F1-17)', async ({ page }) => {
  test.setTimeout(90_000)
  await openEditor(page, 390, 844)
  await page.getByRole('button', { name: 'Abrir painel' }).click()
  const seed = page.getByRole('textbox', { name: 'Seed' })
  await expect(seed).toBeVisible()

  // Com o painel aberto, o mapa fica atrás dele: o mapa novo é conferido pelo pedido gerado.
  await page.getByRole('button', { name: 'Seed aleatória' }).click()
  await expect(seed).toHaveValue(/^[a-z]+-[0-9a-f]{4}$/)
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'generating')
  await waitFinalMap(page)
  const rolled = await seed.inputValue()

  await page.getByRole('button', { name: 'Presets' }).click()
  const presets = page.getByRole('group', { name: 'Presets' })
  await presets.getByRole('button', { name: /Deserto árido/ }).click()
  await expect(presets.getByRole('button', { name: /Deserto árido/ })).toHaveAttribute('aria-pressed', 'true')
  await expectSliders(page, ARID)
  await waitFinalMap(page)

  const restore = page.getByRole('button', { name: 'Restaurar padrão' })
  await expect(restore).toBeInViewport()
  await restore.click()
  await expectSliders(page, DEFAULTS)
  await expect(seed).toHaveValue(rolled)
  await waitFinalMap(page)
})
