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
  // 36 px à direita e 64 px abaixo na tela, no zoom 1,6×; o foco fica no Duplicar da cópia.
  const original = await screenOf(page, 0.45, 0.5)
  const copied = await screenOf(page, copy.pos.u, copy.pos.v)
  expect(Math.round(copied.x - original.x)).toBe(36)
  expect(Math.round(copied.y - original.y)).toBe(64)
  await expect(drawer(page).getByRole('button', { name: 'Duplicar' })).toBeFocused()
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

  // Backspace num botão do drawer não exclui o pin.
  await page.keyboard.press('Backspace')
  await expect(map(page)).toHaveAttribute('data-pins', '2')
  // Excluir pelo rodapé: o foco vai para o Desfazer da barra, e o Enter devolve o pin.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(drawer(page).getByRole('button', { name: 'Excluir' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(map(page)).toHaveAttribute('data-pins', '1')
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Desfazer')
  await page.keyboard.press('Enter')
  await expect(map(page)).toHaveAttribute('data-pins', '2')
})

test('celular 390: o drawer é o painel sobreposto, e a ficha inteira pode ser consultada, com o rodapé à vista (AC-F3-18)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoEditor(page, '/', twoPins())
  await waitFinalMap(page)
  await clickPin(page, 0.45, 0.5)
  const panel = page.getByTestId('drawer')
  await expect(panel).toHaveAttribute('data-open', 'true')
  // Depois de deslizar (200 ms), o painel tem a largura da sidebar (320 px), encostado à direita: não
  // cobre a tela inteira, e uma faixa do mapa fica à vista à esquerda, como com a sidebar (#258).
  await expect
    .poll(async () => {
      const box = await panel.boundingBox()
      return box && [Math.round(box.x), Math.round(box.width)]
    })
    .toEqual([70, 320])
  const sidebarWidth = await page.getByTestId('sidebar').evaluate((el) => el.getBoundingClientRect().width)
  expect(sidebarWidth).toBe(320)
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
  // Nos 320 px, os três botões do rodapé cabem inteiros, com o ícone (16 px) e o texto numa linha.
  const footer = await drawer(page)
    .locator('footer button')
    .evaluateAll((buttons) => buttons.map((b) => [b.querySelector('svg')!.getBoundingClientRect().width, b.scrollWidth <= b.clientWidth, b.getBoundingClientRect().height]))
  expect(footer).toEqual([
    [16, true, 40],
    [16, true, 40],
    [16, true, 40],
  ])
  await info.attach('drawer-390.png', { body: await page.screenshot(), contentType: 'image/png' })

  // Tocar na faixa do mapa à vista (no scrim) fecha o painel, como com a sidebar.
  await page.mouse.click(35, 422)
  await expect(panel).toHaveAttribute('data-open', 'false')
  await expect(page.getByTestId('scrim')).toHaveCount(0)
  await clickPin(page, 0.45, 0.5)
  await expect(panel).toHaveAttribute('data-open', 'true')

  // Centralizar fecha o painel para o mapa aparecer; o pin continua selecionado.
  await drawer(page).getByRole('button', { name: 'Centralizar no pin' }).click()
  await expect(panel).toHaveAttribute('data-open', 'false')
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-valdora')
  await expect(map(page)).toHaveAttribute('data-zoom', '1.600')

  // Excluir no painel sobreposto (onde a tecla Delete não vale): o pin sai, o painel fecha, e o toast
  // "Pin excluído" oferece Desfazer, que devolve o pin com a ficha.
  await page.getByRole('button', { name: 'Abrir detalhes' }).click()
  await expect(panel).toHaveAttribute('data-open', 'true')
  await drawer(page).getByRole('button', { name: 'Excluir' }).click()
  await expect(map(page)).toHaveAttribute('data-pins', '1')
  await expect(panel).toHaveAttribute('data-open', 'false')
  await expect(page.getByTestId('scrim')).toHaveCount(0)
  const toast = page.getByTestId('pin-deleted-toast')
  await expect(toast).toContainText('Pin excluído')
  expect((await savedPins(page)).map((p) => p.id)).toEqual(['p-brumado'])
  await toast.getByRole('button', { name: 'Desfazer' }).click()
  await expect(map(page)).toHaveAttribute('data-pins', '2')
  expect((await savedPins(page)).find((p) => p.id === 'p-valdora')).toMatchObject({ description: '<p>Capital do reino</p>', tags: ['capital'] })
})

/** O tamanho da fonte (px) de cada campo de texto (e seletor) à vista no drawer, pelo rótulo acessível. */
async function fieldFontSizes(page: Page) {
  return drawer(page).evaluate((root) =>
    Object.fromEntries(
      [...root.querySelectorAll<HTMLElement>('input:not([type=radio]):not([type=file]), select, textarea, [contenteditable=true]')].map((el) => [
        el.getAttribute('aria-label') ??
          root.querySelector(`[id="${el.getAttribute('aria-labelledby')}"]`)?.textContent?.trim() ??
          root.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ??
          el.id,
        parseFloat(getComputedStyle(el).fontSize),
      ]),
    ),
  )
}

test('celular 390: todo campo de texto do drawer tem fonte de 16 px ou mais, para o iOS não aproximar a página ao focar; no desktop os tamanhos não mudam (AC-F3-18)', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoEditor(page, '/', twoPins())
  await waitFinalMap(page)
  await clickPin(page, 0.45, 0.5)
  await expect(page.getByTestId('drawer')).toHaveAttribute('data-open', 'true')

  // Aba Descrição (com o nome no cabeçalho): nome, descrição, "+ tag" e, com o popover aberto, o endereço do link.
  await description(page).click()
  await page.getByRole('button', { name: 'Link' }).click()
  await expect(page.getByRole('textbox', { name: 'Endereço do link' })).toBeVisible()
  const ficha = await fieldFontSizes(page)
  expect(Object.keys(ficha).sort()).toEqual(['Descrição', 'Endereço do link', 'Nome do pin', 'Nova tag'])
  for (const [name, size] of Object.entries(ficha)) expect(size, name).toBeGreaterThanOrEqual(16)
  await page.keyboard.press('Escape')

  // Detalhes: o seletor do pin pai e a chave e o valor do campo livre.
  await page.getByRole('tab', { name: 'Detalhes' }).click()
  const detalhes = await fieldFontSizes(page)
  expect(Object.keys(detalhes).sort()).toEqual(['Nome do campo 1', 'Nome do pin', 'Pin pai', 'Valor de rei'])
  for (const [name, size] of Object.entries(detalhes)) expect(size, name).toBeGreaterThanOrEqual(16)

  // No desktop, os campos voltam aos tamanhos do design.
  await page.setViewportSize({ width: 1440, height: 900 })
  expect(await fieldFontSizes(page)).toMatchObject({ 'Nome do campo 1': 13, 'Pin pai': 14, 'Valor de rei': 14 })
  await page.getByRole('tab', { name: 'Descrição' }).click()
  expect(await fieldFontSizes(page)).toMatchObject({ Descrição: 14, 'Nova tag': 13 })
})

// AC-F3-19 (#212): a partir de 768 px, sem pin selecionado, o drawer fica fora da tela, e a área livre
// vai até a borda direita; com um pin, ele entra deslizando, e os controles se alinham à borda dele.
for (const size of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`${size.width}: sem pin, o drawer fica fora da tela e o zoom a 12 px da borda; com um pin, o drawer entra e os controles se alinham a ele (AC-F3-19)`, async ({ page }, info) => {
    test.setTimeout(90_000)
    await page.setViewportSize(size)
    await gotoEditor(page, '/', twoPins())
    await waitFinalMap(page)
    const aside = page.getByTestId('drawer')
    const zoomRight = async () => (await page.getByTestId('zoom-controls').boundingBox())!
    const actionsBox = async () => (await page.getByTestId('actions').boundingBox())!

    // Sem pin: o drawer está fora da tela (e invisível), o mapa usa a largura até a borda direita.
    await expect(aside).toBeHidden()
    const free = size.width - 320
    const side = Math.min(free, size.height)
    await expect(map(page)).toHaveAttribute('data-map-rect', `${320 + (free - side) / 2},${(size.height - side) / 2},${side},${side}`)
    await expect.poll(async () => { const z = await zoomRight(); return size.width - (z.x + z.width) }).toBe(12)
    await expect.poll(async () => { const a = await actionsBox(); return size.width - (a.x + a.width) }).toBe(12)
    await info.attach(`sem-pin-${size.width}.png`, { body: await page.screenshot(), contentType: 'image/png' })

    // Com um pin: o drawer entra (400 px à direita), e o zoom e a barra superior ficam a 12 px dele.
    const zoomBefore = await map(page).getAttribute('data-zoom')
    await clickPin(page, 0.45, 0.5)
    await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-valdora')
    await expect(aside).toBeVisible()
    // A largura e a posição do design (400 px, encostado à direita) não mudam com o celular (#258).
    await expect
      .poll(async () => {
        const box = await aside.boundingBox()
        return box && [box.x, box.width, box.y, box.height]
      })
      .toEqual([size.width - 400, 400, 0, size.height])
    // O rodapé do design: três botões que dividem a largura (flex: 1), com ícone e texto numa linha. O
    // Excluir não tem borda, daí até 2 px de diferença entre as larguras.
    const footer = await drawer(page)
      .locator('footer button')
      .evaluateAll((buttons) =>
        buttons.map((b) => ({ flex: getComputedStyle(b).flex, width: b.getBoundingClientRect().width, icon: b.querySelector('svg')!.getBoundingClientRect().width, fits: b.scrollWidth <= b.clientWidth })),
      )
    expect(footer.map((b) => [b.flex, b.icon, b.fits])).toEqual([
      ['1 1 0%', 16, true],
      ['1 1 0%', 16, true],
      ['1 1 0%', 16, true],
    ])
    const widths = footer.map((b) => b.width)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2)
    await expect.poll(async () => { const z = await zoomRight(); return size.width - 400 - (z.x + z.width) }).toBe(12)
    await expect.poll(async () => { const a = await actionsBox(); return size.width - 400 - (a.x + a.width) }).toBe(12)
    // Abrir o drawer não muda a porcentagem do zoom.
    expect(await map(page).getAttribute('data-zoom')).toBe(zoomBefore)
    await info.attach(`com-pin-${size.width}.png`, { body: await page.screenshot(), contentType: 'image/png' })

    // Esc fecha: o drawer sai, e os controles voltam à borda direita.
    await page.keyboard.press('Escape')
    await expect(map(page)).toHaveAttribute('data-pin-selected', '')
    await expect(aside).toBeHidden()
    await expect.poll(async () => { const z = await zoomRight(); return size.width - (z.x + z.width) }).toBe(12)

    // O botão fechar do drawer faz o mesmo.
    await clickPin(page, 0.45, 0.5)
    await expect(aside).toBeVisible()
    await drawer(page).getByRole('button', { name: 'Fechar', exact: true }).click()
    await expect(aside).toBeHidden()
    await expect.poll(async () => { const a = await actionsBox(); return size.width - (a.x + a.width) }).toBe(12)
  })
}

test('1440: ao abrir o drawer, a toolbar vai para a segunda linha logo no começo do deslize, pela largura final (AC-F3-19)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', twoPins())
  await waitFinalMap(page)
  const slot = page.getByTestId('toolbar-slot')
  await expect(slot).toHaveAttribute('data-place', 'row')
  // Registra a largura da linha inferior no momento em que a toolbar troca de lugar.
  await page.evaluate(() => {
    const w = window as unknown as { placeChanges: { place: string; barWidth: number }[] }
    w.placeChanges = []
    const el = document.querySelector('[data-testid="toolbar-slot"]')!
    new MutationObserver(() => {
      const bar = document.querySelector('[data-testid="bottom-bar"]')!.getBoundingClientRect()
      w.placeChanges.push({ place: el.getAttribute('data-place')!, barWidth: Math.round(bar.width) })
    }).observe(el, { attributes: true, attributeFilter: ['data-place'] })
  })
  await clickPin(page, 0.45, 0.5)
  await expect(slot).toHaveAttribute('data-place', 'above')
  await expect.poll(async () => (await page.getByTestId('bottom-bar').boundingBox())?.width).toBe(720)
  const changes = await page.evaluate(() => (window as unknown as { placeChanges: { place: string; barWidth: number }[] }).placeChanges)
  // Uma troca só, com a linha ainda larga (1120 px, antes de encolher): não no meio, ao cruzar 829 px.
  expect(changes.map((c) => c.place)).toEqual(['above'])
  expect(changes[0].barWidth).toBeGreaterThan(829)
})

test('1440, zoom 1×: um pin perto da borda direita sai de baixo do drawer ao ser selecionado; ao fechar, o mapa volta aos limites sem ele (AC-F3-03, AC-F3-19)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', defaultWorld({ pins: [pin('p-leste', 'Porto Leste', 0.8, 0.45)] }))
  await waitFinalMap(page)
  // No 1×, o mapa (900 px) vai de 430 a 1330: o pin (u 0,8) fica em 1150, onde o drawer vai abrir (de 1040 em diante).
  await expect(map(page)).toHaveAttribute('data-map-rect', '430,0,900,900')
  await clickPin(page, 0.8, 0.45)
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-leste')
  // A borda direita do mapa para na do drawer (1040): o mapa vai a 140, e o pin, a 860, à vista.
  await expect(map(page)).toHaveAttribute('data-map-rect', '140,0,900,900')
  expect((await screenOf(page, 0.8, 0.45)).x).toBeLessThan(1040)
  expect(await map(page).getAttribute('data-zoom')).toBe('1.000')

  // Fechar: sem o drawer, o mapa menor que a área livre volta para dentro dela (a esquerda em 320).
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('drawer')).toBeHidden()
  await expect(map(page)).toHaveAttribute('data-map-rect', '320,0,900,900')
})
