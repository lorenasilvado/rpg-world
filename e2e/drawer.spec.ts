/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, gotoEditor } from './editor.ts'

// Drawer do pin (#159): a ficha, a descrição, as tags e o rodapé (AC-F3-06 a AC-F3-09, AC-F3-18).

type SavedPin = { id: string; name: string; pos: { u: number; v: number }; description: string; tags: string[]; fields: Record<string, string> }

function pin(id: string, name: string, u: number, v: number, over: Partial<SavedPin> = {}) {
  return { id, type: 'cidade', name, pos: { u, v }, icon: { kind: 'builtin', key: 'cidade' }, description: '', tags: [], fields: {}, ...over }
}

/** Dois pins em terra na seed padrão: Valdora (com a ficha) e Brumado, com tags para sugerir. */
const twoPins = () =>
  defaultWorld({
    pins: [
      pin('p-valdora', 'Valdora', 0.45, 0.5, { description: '<p>Capital do reino</p>', tags: ['capital'], fields: { rei: 'Aldo' } }),
      pin('p-brumado', 'Brumado', 0.55, 0.5, { tags: ['porto', 'militar'] }),
    ],
  })

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

async function screenOf(page: Page, u: number, v: number) {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return { x: x + u * width, y: y + v * height }
}

async function clickPin(page: Page, u: number, v: number) {
  const p = await screenOf(page, u, v)
  await page.mouse.click(p.x, p.y - 10)
}

/** Os pins gravados no IndexedDB, depois de o indicador dizer "Salvo". */
async function savedPins(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-status', 'saved')
  return page.evaluate(
    () =>
      new Promise<SavedPin[]>((resolve) => {
        const open = indexedDB.open('rpg-world')
        open.onsuccess = () => {
          const get = open.result.transaction('worlds').objectStore('worlds').get('mundo-padrao')
          get.onsuccess = () => resolve(get.result.pins)
        }
      }),
  )
}

const map = (page: Page) => page.getByTestId('map')
const drawer = (page: Page) => page.getByTestId('pin-drawer')
const description = (page: Page) => page.getByRole('textbox', { name: 'Descrição' })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('o cabeçalho mostra ícone, nome, tipo, bioma e coordenadas; nome, descrição formatada e tags ficam salvos ao recarregar (AC-F3-06 a AC-F3-08)', async ({ page }, info) => {
  test.setTimeout(120_000)
  await gotoEditor(page, '/', twoPins())
  await waitFinalMap(page)
  await clickPin(page, 0.45, 0.5)
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-valdora')

  await expect(drawer(page).getByTestId('pin-drawer-icon').locator('svg')).toBeVisible()
  await expect(drawer(page).getByTestId('pin-drawer-type')).toHaveText('Cidade')
  // x 461 = round(0,45 × 1024); y 512 = 0,5 × 1024. O bioma vem do mapa: um nome antes do "·".
  await expect(drawer(page).getByTestId('pin-drawer-place')).toHaveText(/^[A-ZÁ-Ú][a-zá-ú ]+ · x 461, y 512$/)
  await expect(page.getByRole('tab', { name: 'Descrição' })).toHaveAttribute('aria-selected', 'true')
  await info.attach('drawer-1440.png', { body: await page.screenshot(), contentType: 'image/png' })

  // O nome.
  const name = page.getByRole('textbox', { name: 'Nome do pin' })
  await name.fill('Valdora Alta')
  await name.press('Enter')

  // A descrição: negrito, título H2, lista e link.
  await description(page).click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Título' }).click()
  await page.keyboard.type('História')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Control+B')
  await page.keyboard.type('Fundada')
  await page.keyboard.press('Control+B')
  await page.keyboard.type(' no ano 12.')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Lista', exact: true }).click()
  await page.keyboard.type('Mercado')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Itálico' }).click()
  await page.keyboard.type('Porto')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Link' }).click()
  await page.getByRole('textbox', { name: 'Endereço do link' }).fill('exemplo.com/valdora')
  await page.keyboard.press('Enter')

  // As tags: o campo, a sugestão e a remoção pelo chip.
  const tagInput = page.getByRole('textbox', { name: 'Nova tag' })
  await tagInput.fill('reino')
  await tagInput.press('Enter')
  await expect(page.getByTestId('pin-tag-suggestions')).toContainText('Usadas no mundo:')
  await page.getByRole('button', { name: 'Adicionar a tag porto' }).click()
  await page.getByRole('button', { name: 'Remover a tag capital' }).click()
  await expect(page.getByTestId('pin-tag')).toHaveText(['reino', 'porto'])
  await info.attach('drawer-ficha.png', { body: await drawer(page).screenshot(), contentType: 'image/png' })

  const [saved] = await savedPins(page)
  expect(saved).toMatchObject({ id: 'p-valdora', name: 'Valdora Alta', tags: ['reino', 'porto'], fields: { rei: 'Aldo' } })
  expect(saved.description).toContain('<p>Capital do reino</p>')
  expect(saved.description).toContain('<h2>História</h2>')
  expect(saved.description).toContain('<strong>Fundada</strong> no ano 12.')
  expect(saved.description).toMatch(/<ul><li><p>Mercado<\/p><\/li><li><p><em>Porto<\/em><\/p><\/li><\/ul>/)
  expect(saved.description).toContain('href="https://exemplo.com/valdora"')
  // O parágrafo vazio que o editor deixa no fim não é salvo.
  expect(saved.description).not.toMatch(/<p><\/p>$/)

  await page.reload()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await waitFinalMap(page)
  await clickPin(page, 0.45, 0.5)
  await expect(page.getByRole('textbox', { name: 'Nome do pin' })).toHaveValue('Valdora Alta')
  await expect(description(page).locator('h2')).toHaveText('História')
  await expect(description(page).locator('strong')).toHaveText('Fundada')
  await expect(description(page).locator('ul li')).toHaveText(['Mercado', 'Porto'])
  await expect(description(page).locator('a')).toHaveAttribute('href', 'https://exemplo.com/valdora')
  await expect(page.getByTestId('pin-tag')).toHaveText(['reino', 'porto'])
})

test('Centralizar leva a câmera ao pin, aproximando até 1,6×; Duplicar cria a cópia ao lado; Excluir no rodapé mostra o toast (AC-F3-05, AC-F3-09)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', twoPins())
  await waitFinalMap(page)
  await clickPin(page, 0.45, 0.5)
  await expect(map(page)).toHaveAttribute('data-zoom', '1.000')

  await drawer(page).getByRole('button', { name: 'Centralizar no pin' }).click()
  await expect(map(page)).toHaveAttribute('data-zoom', '1.600')
  // A área livre fica entre a sidebar (320) e o drawer (400): o centro é (680, 450).
  await expect
    .poll(async () => {
      const s = await screenOf(page, 0.45, 0.5)
      return Math.round(Math.hypot(s.x - 680, s.y - 450))
    })
    .toBeLessThanOrEqual(1)

  await drawer(page).getByRole('button', { name: 'Duplicar' }).click()
  await expect(map(page)).toHaveAttribute('data-pins', '3')
  await expect(page.getByRole('textbox', { name: 'Nome do pin' })).toHaveValue('Valdora (cópia)')
  await expect(page.getByTestId('pin-tag')).toHaveText(['capital'])
  await expect(description(page)).toHaveText('Capital do reino')
  const copy = (await savedPins(page))[2]
  expect(copy).toMatchObject({ name: 'Valdora (cópia)', description: '<p>Capital do reino</p>', tags: ['capital'], fields: { rei: 'Aldo' } })
  // 36 px à direita na tela, no zoom 1,6×.
  const original = await screenOf(page, 0.45, 0.5)
  const copied = await screenOf(page, copy.pos.u, copy.pos.v)
  expect(Math.round(copied.x - original.x)).toBe(36)
  expect(Math.round(copied.y - original.y)).toBe(12)
  await expect(map(page)).toHaveAttribute('data-pin-selected', copy.id)
  // A cópia da cópia conta.
  await drawer(page).getByRole('button', { name: 'Duplicar' }).click()
  await expect(page.getByRole('textbox', { name: 'Nome do pin' })).toHaveValue('Valdora (cópia 2)')
  await page.keyboard.press('Control+Z')
  await expect(map(page)).toHaveAttribute('data-pins', '3')
  await clickPin(page, copy.pos.u, copy.pos.v)
  await expect(map(page)).toHaveAttribute('data-pin-selected', copy.id)
  await info.attach('duplicado.png', { body: await page.screenshot(), contentType: 'image/png' })

  await drawer(page).getByRole('button', { name: 'Excluir' }).click()
  await expect(map(page)).toHaveAttribute('data-pins', '2')
  await expect(page.getByTestId('pin-deleted-toast')).toContainText('Pin excluído')
  await expect(drawer(page)).toHaveCount(0)
  await page.getByTestId('pin-deleted-toast').getByRole('button', { name: 'Desfazer' }).click()
  await expect(map(page)).toHaveAttribute('data-pins', '3')
})

test('o drawer é navegável só com o teclado: nome, abas, formatação, descrição, tags e rodapé', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', twoPins())
  await waitFinalMap(page)
  await clickPin(page, 0.45, 0.5)
  const name = page.getByRole('textbox', { name: 'Nome do pin' })
  await name.focus()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('tab', { name: 'Descrição' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Detalhes' })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Detalhes' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('tab', { name: 'Descrição' })).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Negrito' })).toBeFocused()
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab')
  await expect(description(page)).toBeFocused()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' Fim.')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Remover a tag capital' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: 'Nova tag' })).toBeFocused()
  await page.keyboard.type('ilha')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('pin-tag')).toHaveText(['capital', 'ilha'])
  // As sugestões e o rodapé: Centralizar pelo Enter.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Adicionar a tag porto' })).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(drawer(page).getByRole('button', { name: 'Centralizar no pin' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(map(page)).toHaveAttribute('data-zoom', '1.600')
  expect((await savedPins(page))[0].description).toBe('<p>Capital do reino Fim.</p>')
})

test('celular 390: o drawer é o painel sobreposto, e a ficha inteira pode ser consultada, com o rodapé à vista (AC-F3-18)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoEditor(page, '/', twoPins())
  await waitFinalMap(page)
  await clickPin(page, 0.45, 0.5)
  const panel = page.getByTestId('drawer')
  await expect(panel).toHaveAttribute('data-open', 'true')
  // Depois de deslizar (200 ms), o painel cobre a tela de ponta a ponta.
  await expect
    .poll(async () => {
      const box = await panel.boundingBox()
      return box && [Math.round(box.x), Math.round(box.width)]
    })
    .toEqual([0, 390])
  await expect(page.getByTestId('scrim')).toBeVisible()
  await expect(page.getByTestId('pin-drawer-place')).toBeVisible()
  await expect(description(page)).toHaveText('Capital do reino')
  await expect(page.getByTestId('pin-tag')).toHaveText(['capital'])
  // Brumado não tem descrição: o editor mostra o convite.
  await page.getByRole('button', { name: 'Fechar detalhes' }).click()
  await clickPin(page, 0.55, 0.5)
  await expect(description(page).locator('p.is-editor-empty')).toHaveAttribute('data-placeholder', 'Escreva sobre este lugar…')
  await page.getByRole('button', { name: 'Fechar detalhes' }).click()
  await clickPin(page, 0.45, 0.5)
  for (const label of ['Centralizar no pin', 'Duplicar', 'Excluir']) await expect(drawer(page).getByRole('button', { name: label })).toBeInViewport()
  await info.attach('drawer-390.png', { body: await page.screenshot(), contentType: 'image/png' })

  // Centralizar fecha o painel para o mapa aparecer; o pin continua selecionado.
  await drawer(page).getByRole('button', { name: 'Centralizar no pin' }).click()
  await expect(panel).toHaveAttribute('data-open', 'false')
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-valdora')
  await expect(map(page)).toHaveAttribute('data-zoom', '1.600')
})
