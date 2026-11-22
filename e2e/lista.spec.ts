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
  // O mapa quadrado aparece inteiro (sem cortar o alto e o pé do continente), com o mar dos lados.
  expect(await cards(page).locator('canvas').evaluate((el) => getComputedStyle(el).objectFit)).toBe('contain')

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

test('celular 390: o editor volta à lista pelo logo do painel sobreposto, também com "Erro ao salvar" (AC-F4-06)', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await putWorlds(page, [defaultWorld({ seed: 'valdora-7f3a' })])
  await page.reload()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await expect(page.getByTestId('editor')).toBeVisible()

  // Abaixo de 768 px, o logo fica no cabeçalho do painel sobreposto: abre o painel e clica nele.
  const sidebar = page.getByTestId('sidebar')
  const back = sidebar.getByRole('button', { name: 'Voltar à lista de mundos' })
  await expect(back).toBeHidden()
  await page.getByRole('button', { name: 'Abrir painel' }).click()
  await expect(sidebar).toHaveAttribute('data-open', 'true')
  await back.click()
  await expect(list(page)).toHaveAttribute('data-state', 'ready')
  await expect(cards(page)).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

  // Com a gravação falhando, voltar pergunta antes; o modal cabe na tela e "Voltar sem salvar" volta.
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Cota cheia', 'QuotaExceededError')
    }
  })
  await page.getByRole('button', { name: 'Abrir painel' }).click()
  const seed = page.getByRole('textbox', { name: 'Seed' })
  await seed.fill('valdora-novo')
  await seed.press('Enter')
  await expect(sidebar.getByRole('button', { name: 'Erro ao salvar' })).toBeVisible()
  await back.click()
  const dialog = page.getByRole('dialog', { name: 'Mudanças não salvas' })
  await expect(dialog).toBeInViewport({ ratio: 1 })
  await dialog.getByRole('button', { name: 'Voltar sem salvar' }).click()
  await expect(list(page)).toHaveAttribute('data-state', 'ready')
  await expect(cards(page).getByTestId('world-card-name')).toHaveText('Terras de Valdora')
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

test('menu "⋯": renomear, duplicar (a contagem sobe) e excluir com confirmação (AC-F4-07)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await putWorlds(page, [
    defaultWorld({ id: 'a', name: 'Terras de Valdora', seed: 'valdora-7f3a', updatedAt: '2026-11-21T10:00:00.000Z' }),
    defaultWorld({ id: 'b', name: 'Vale Sombrio', seed: 'sombrio-0001', updatedAt: '2026-11-20T10:00:00.000Z' }),
  ])
  await page.reload()
  const names = cards(page).getByTestId('world-card-name')
  await expect(names).toHaveText(['Terras de Valdora', 'Vale Sombrio'])

  // O menu: o cartão ganha o contorno âmbar; Exportar fica desabilitado.
  await page.getByRole('button', { name: 'Mais ações de Vale Sombrio' }).click()
  const menu = page.getByRole('menu', { name: 'Ações de Vale Sombrio' })
  await expect(menu.getByRole('menuitem')).toHaveText(['Renomear', 'Duplicar', 'Exportar', 'Excluir'])
  await expect(menu.getByRole('menuitem', { name: 'Exportar' })).toBeDisabled()
  await expect(cards(page).nth(1)).toHaveAttribute('data-menu-open', 'true')
  await expect(menu).toBeInViewport({ ratio: 1 })

  // Renomear: o mundo sobe para o topo, editado agora.
  await menu.getByRole('menuitem', { name: 'Renomear' }).click()
  const rename = page.getByRole('dialog', { name: 'Renomear mundo' })
  await rename.getByLabel('Nome do mundo').fill('Vale das Brumas')
  await rename.getByRole('button', { name: 'Renomear' }).click()
  await expect(rename).toBeHidden()
  await expect(names).toHaveText(['Vale das Brumas', 'Terras de Valdora'])
  await expect(cards(page).first().getByTestId('world-card-caption')).toHaveText('Editado agora · sem pins')

  // Duplicar: a cópia vai para o topo e a contagem sobe.
  await page.getByRole('button', { name: 'Mais ações de Terras de Valdora' }).click()
  await page.getByRole('menuitem', { name: 'Duplicar' }).click()
  await expect(page.getByTestId('world-count')).toHaveText('3 mundos')
  await expect(names).toHaveText(['Terras de Valdora (cópia)', 'Vale das Brumas', 'Terras de Valdora'])

  // Excluir: Cancelar mantém; confirmar tira da lista, e recarregar confirma.
  await page.getByRole('button', { name: 'Mais ações de Terras de Valdora (cópia)' }).click()
  await page.getByRole('menuitem', { name: 'Excluir' }).click()
  const remove = page.getByRole('dialog', { name: 'Excluir “Terras de Valdora (cópia)”?' })
  await expect(remove).toContainText('Isso não pode ser desfeito.')
  await remove.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByTestId('world-count')).toHaveText('3 mundos')
  await page.getByRole('button', { name: 'Mais ações de Terras de Valdora (cópia)' }).click()
  await page.getByRole('menuitem', { name: 'Excluir' }).click()
  await remove.getByRole('button', { name: 'Excluir mundo' }).click()
  await expect(page.getByTestId('world-count')).toHaveText('2 mundos')
  await page.reload()
  await expect(names).toHaveText(['Vale das Brumas', 'Terras de Valdora'])
})

test('menu "⋯" só com teclado: abrir, andar, renomear e excluir (AC-F4-07)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await putWorlds(page, [defaultWorld({ seed: 'valdora-7f3a' })])
  await page.reload()
  const more = page.getByRole('button', { name: 'Mais ações de Terras de Valdora' })
  await more.focus()

  // Enter abre com o foco em Renomear; as setas pulam o Exportar desabilitado; Esc devolve ao "⋯".
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Renomear' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Excluir' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(more).toBeFocused()

  // Renomear pelo teclado: o nome vem selecionado, digitar substitui, Enter grava.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Ilhas do Corvo')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('world-card-name')).toHaveText('Ilhas do Corvo')
  const renamed = page.getByRole('button', { name: 'Mais ações de Ilhas do Corvo' })
  await expect(renamed).toBeFocused()

  // Excluir: o foco começa em Cancelar; Tab vai a "Excluir mundo".
  await page.keyboard.press('Enter')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Excluir “Ilhas do Corvo”?' })
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Excluir mundo' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Nenhum mundo ainda' })).toBeVisible()
  // O cartão saiu: o foco vai ao "Novo mundo".
  await expect(page.getByRole('button', { name: 'Novo mundo' })).toBeFocused()
})

for (const [width, height] of [
  [1024, 768],
  [390, 844],
] as const) {
  test(`${width} px: o menu "⋯" e os modais cabem na tela (AC-F4-07)`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await putWorlds(
      page,
      Array.from({ length: 3 }, (_, i) => defaultWorld({ id: `m${i}`, name: `Mundo ${i + 1}`, seed: `seed-${i}` })),
    )
    await page.reload()
    await page.getByRole('button', { name: 'Mais ações de Mundo 3' }).click()
    await expect(page.getByRole('menu')).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.getByRole('menuitem', { name: 'Excluir' }).click()
    await expect(page.getByRole('dialog')).toBeInViewport({ ratio: 1 })
  })
}
