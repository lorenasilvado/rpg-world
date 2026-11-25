/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, gotoEditor } from './editor.ts'

// Hierarquia de pins e aba Conexões (#161): o pin pai na aba Detalhes, excluir o pai e desfazer, e
// abrir os pins pela aba Conexões (AC-F3-12, AC-F3-13).

type SavedPin = { id: string; name: string; parentId?: string }

function pin(id: string, name: string, type: string, u: number, v: number, parentId?: string) {
  return { id, type, name, pos: { u, v }, icon: { kind: 'builtin', key: type }, description: '', tags: [], fields: {}, ...(parentId ? { parentId } : {}) }
}

/** O reino e a cidade, ainda soltos, e a vila, que já pertence à cidade. */
const kingdom = () =>
  defaultWorld({
    pins: [
      pin('p-reino', 'Reino de Asterra', 'castelo', 0.45, 0.5),
      pin('p-cidade', 'Valdora', 'cidade', 0.55, 0.5),
      pin('p-vila', 'Brejo Fundo', 'vila', 0.5, 0.62, 'p-cidade'),
    ],
  })

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

async function clickPin(page: Page, u: number, v: number) {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  await page.mouse.click(x + u * width, y + v * height - 10)
}

/** O pai de cada pin gravado no IndexedDB, depois de o indicador dizer "Salvo". */
async function savedParents(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-status', 'saved')
  const pins = await page.evaluate(
    () =>
      new Promise<SavedPin[]>((resolve) => {
        const open = indexedDB.open('rpg-world')
        open.onsuccess = () => {
          const get = open.result.transaction('worlds').objectStore('worlds').get('mundo-padrao')
          get.onsuccess = () => resolve(get.result.pins)
        }
      }),
  )
  return Object.fromEntries(pins.map((p) => [p.id, p.parentId ?? null]))
}

const map = (page: Page) => page.getByTestId('map')
const drawer = (page: Page) => page.getByTestId('pin-drawer')

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('escolher o pai na aba Detalhes, abrir os pins pela aba Conexões, e excluir o pai com Desfazer (AC-F3-12, AC-F3-13)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', kingdom())
  await waitFinalMap(page)

  // A cidade: o pai sai dos outros pins, sem ela nem a vila (a filha dela).
  await clickPin(page, 0.55, 0.5)
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-cidade')
  await drawer(page).getByRole('tab', { name: 'Detalhes' }).click()
  const parent = drawer(page).getByRole('combobox', { name: 'Pin pai' })
  await expect(parent).toHaveValue('')
  await expect(parent.locator('option')).toHaveText(['Nenhum', 'Reino de Asterra (Castelo)'])
  await parent.selectOption('p-reino')
  await expect.poll(() => savedParents(page)).toEqual({ 'p-reino': null, 'p-cidade': 'p-reino', 'p-vila': 'p-cidade' })

  // Conexões: o reino é o pai, e a vila, a filha; clicar no reino o abre, na mesma aba.
  await drawer(page).getByRole('tab', { name: 'Conexões' }).click()
  const panel = drawer(page).getByRole('tabpanel', { name: 'Conexões' })
  await expect(panel.getByRole('region', { name: 'Pin pai' }).getByRole('button')).toHaveText(['Reino de AsterraCastelo'])
  await expect(panel.getByRole('region', { name: 'Pins filhos (1)' }).getByRole('button')).toHaveText(['Brejo FundoVila'])
  await info.attach('conexoes-cidade.png', { body: await page.screenshot(), contentType: 'image/png' })
  await panel.getByRole('button', { name: /^Reino de Asterra/ }).click()
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-reino')
  await expect(drawer(page).getByRole('tab', { name: 'Conexões' })).toBeFocused()
  await expect(drawer(page).getByRole('region', { name: 'Pins filhos (1)' }).getByRole('button')).toHaveText(['ValdoraCidade'])
  // O reino não pode ter como pai a cidade nem a vila (descendentes dele).
  await drawer(page).getByRole('tab', { name: 'Detalhes' }).click()
  await expect(drawer(page).getByRole('combobox', { name: 'Pin pai' }).locator('option')).toHaveText(['Nenhum'])
  await drawer(page).getByRole('tab', { name: 'Conexões' }).click()
  await drawer(page).getByRole('button', { name: /^Valdora/ }).click()
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-cidade')

  // Excluir a cidade: a vila fica sem pai; Desfazer devolve a cidade e os dois vínculos.
  await drawer(page).getByRole('button', { name: 'Excluir' }).click()
  await expect(map(page)).toHaveAttribute('data-pins', '2')
  await expect.poll(() => savedParents(page)).toEqual({ 'p-reino': null, 'p-vila': null })
  await page.getByTestId('pin-deleted-toast').getByRole('button', { name: 'Desfazer' }).click()
  await expect(map(page)).toHaveAttribute('data-pins', '3')
  await expect.poll(() => savedParents(page)).toEqual({ 'p-reino': null, 'p-cidade': 'p-reino', 'p-vila': 'p-cidade' })
})
