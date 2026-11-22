/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, gotoEditor } from './editor.ts'

// Pins no mapa (#157): adicionar com P, desenhar por tipo e selecionar (AC-F3-01 a AC-F3-03).

const TYPES = ['cidade', 'vila', 'castelo', 'masmorra', 'npc', 'poi', 'custom'] as const

/** Um pin salvo, como o app o grava. */
function pin(id: string, type: string, name: string, u: number, v: number) {
  return { id, type, name, pos: { u, v }, icon: { kind: 'builtin', key: type }, description: '', tags: [], fields: {} }
}

/** O mundo padrão com um pin de cada tipo, numa linha no meio do mapa (em terra, na seed padrão). */
const sevenPins = () =>
  defaultWorld({
    pins: TYPES.map((t, i) => pin(`p-${t}`, t, `Pin ${i + 1}`, 0.35 + i * 0.05, 0.5)),
  })

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

/** O retângulo do mapa na tela (`data-map-rect`). */
async function mapRect(page: Page) {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return { x, y, width, height }
}

/** O ponto da tela da posição (u, v), pelo retângulo do mapa. */
async function screenOf(page: Page, u: number, v: number) {
  const r = await mapRect(page)
  return { x: r.x + u * r.width, y: r.y + v * r.height }
}

/** Clica no desenho do pin (10 px acima da âncora, na base). */
async function clickPin(page: Page, u: number, v: number) {
  const p = await screenOf(page, u, v)
  await page.mouse.click(p.x, p.y - 10)
}

const map = (page: Page) => page.getByTestId('map')
const nameField = (page: Page) => page.getByRole('textbox', { name: 'Nome do pin' })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('com P, clicar no mapa cria um "Novo pin" Cidade ali e abre o drawer com o nome em edição; recarregar mantém (AC-F3-01)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page)
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '0')

  await page.keyboard.press('p')
  await expect(page.getByRole('button', { name: 'Adicionar pin' })).toHaveAttribute('aria-pressed', 'true')
  await expect(map(page)).toHaveAttribute('data-tool', 'pin')
  const at = await screenOf(page, 0.5, 0.5)
  await page.mouse.click(at.x, at.y)

  await expect(map(page)).toHaveAttribute('data-pins', '1')
  await expect(nameField(page)).toBeFocused()
  await expect(nameField(page)).toHaveValue('Novo pin')
  expect(await nameField(page).evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 8])
  await expect(page.getByTestId('pin-drawer-type')).toHaveText('Cidade')
  // Depois de criar, a ferramenta volta para Navegar.
  await expect(map(page)).toHaveAttribute('data-tool', 'nav')

  await page.keyboard.type('Valdora')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-status', 'saved')
  const saved = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open('rpg-world')
        open.onsuccess = () => {
          const get = open.result.transaction('worlds').objectStore('worlds').get('mundo-padrao')
          get.onsuccess = () => resolve(get.result.pins)
        }
      }),
  )
  expect(saved).toEqual([expect.objectContaining({ type: 'cidade', name: 'Valdora' })])
  const [{ pos }] = saved as { pos: { u: number; v: number } }[]
  expect(pos.u).toBeCloseTo(0.5, 2)
  expect(pos.v).toBeCloseTo(0.5, 2)

  await page.reload()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '1')
  await clickPin(page, pos.u, pos.v)
  await expect(nameField(page)).toHaveValue('Valdora')
})

test('os 7 tipos têm 32 px na tela em qualquer zoom; o rótulo aparece a partir de 1,5×, no hover e na seleção (AC-F3-02)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', sevenPins())
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '7')
  await expect(map(page)).toHaveAttribute('data-pin-size', '32.0')
  await expect(map(page)).toHaveAttribute('data-pin-labels', '0')
  await info.attach('pins-zoom-1.png', { body: await page.screenshot(), contentType: 'image/png' })

  // Hover num pin: só ele ganha o rótulo.
  const p = await screenOf(page, 0.35, 0.5)
  await page.mouse.move(p.x, p.y - 10)
  await expect(map(page)).toHaveAttribute('data-pin-labels', '1')
  await page.mouse.move(p.x, p.y + 80)
  await expect(map(page)).toHaveAttribute('data-pin-labels', '0')

  // + duas vezes: 1,5625×, todos os rótulos à vista, e os pins seguem com 32 px.
  await page.keyboard.press('=')
  await page.keyboard.press('=')
  await expect(map(page)).toHaveAttribute('data-zoom', '1.563')
  await expect(map(page)).toHaveAttribute('data-pin-labels', '7')
  await expect(map(page)).toHaveAttribute('data-pin-size', '32.0')
  for (let i = 0; i < 6; i++) await page.keyboard.press('=')
  await expect(map(page)).toHaveAttribute('data-zoom', '4.000')
  await expect(map(page)).toHaveAttribute('data-pin-size', '32.0')
  await page.keyboard.press('0')
  await expect(map(page)).toHaveAttribute('data-zoom', '1.000')
  await expect(map(page)).toHaveAttribute('data-pin-labels', '0')

  // A seleção também mostra o rótulo.
  await clickPin(page, 0.35, 0.5)
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-cidade')
  await page.mouse.move(p.x, p.y + 80)
  await expect(map(page)).toHaveAttribute('data-pin-labels', '1')
})

test('clicar num pin o seleciona, abre o drawer e centraliza a câmera na área livre; Esc fecha (AC-F3-03)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', sevenPins())
  await waitFinalMap(page)
  // Zoom 2,44×: a câmera tem por onde andar.
  for (let i = 0; i < 4; i++) await page.keyboard.press('=')
  await expect(map(page)).toHaveAttribute('data-zoom', '2.441')

  // A Cidade fica à esquerda do centro do mapa: com o zoom, longe do centro da tela.
  const u = 0.35
  const before = await screenOf(page, u, 0.5)
  expect(before.x).toBeLessThan(560)
  await clickPin(page, u, 0.5)
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-cidade')
  await expect(page.getByTestId('pin-drawer')).toBeVisible()
  await expect(nameField(page)).toHaveValue('Pin 1')
  await expect(page.getByTestId('pin-drawer-type')).toHaveText('Cidade')
  // O nome não fica em edição: só no pin novo.
  await expect(nameField(page)).not.toBeFocused()

  // A área livre fica entre a sidebar (320) e o drawer (400): o centro é (680, 450).
  await expect
    .poll(async () => {
      const s = await screenOf(page, u, 0.5)
      return Math.round(Math.hypot(s.x - 680, s.y - 450))
    })
    .toBeLessThanOrEqual(1)

  await page.keyboard.press('Escape')
  await expect(map(page)).toHaveAttribute('data-pin-selected', '')
  await expect(page.getByTestId('pin-drawer')).toHaveCount(0)
})

test('com movimento reduzido, o pin selecionado não pulsa (sem quique nem pulsação)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', sevenPins())
  await waitFinalMap(page)
  const p = await screenOf(page, 0.35, 0.5)
  const clip = { x: p.x - 40, y: p.y - 50, width: 80, height: 70 }
  const differs = async () => {
    const a = await page.screenshot({ clip })
    await page.waitForTimeout(400)
    return !a.equals(await page.screenshot({ clip }))
  }
  await clickPin(page, 0.35, 0.5)
  await page.mouse.move(10, 450)
  await page.waitForTimeout(500)
  expect(await differs(), 'sem movimento reduzido, a pulsação anima').toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(100)
  expect(await differs(), 'com movimento reduzido, nada muda').toBe(false)

  // O pin novo aparece sem quique: já no lugar no primeiro quadro.
  await page.keyboard.press('Escape')
  await page.keyboard.press('p')
  const at = await screenOf(page, 0.5, 0.62)
  const near = { x: at.x - 40, y: at.y - 50, width: 80, height: 70 }
  await page.mouse.click(at.x, at.y)
  await page.mouse.move(10, 450)
  await expect(map(page)).toHaveAttribute('data-pins', '8')
  const first = await page.screenshot({ clip: near })
  await page.waitForTimeout(600)
  expect(first.equals(await page.screenshot({ clip: near })), 'o pin novo não quica').toBe(true)
})

test('celular 390: tocar num pin abre o drawer sobreposto, e fechá-lo tira a seleção', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoEditor(page, '/', sevenPins())
  await waitFinalMap(page)
  await clickPin(page, 0.35, 0.5)
  const drawer = page.getByTestId('drawer')
  await expect(drawer).toHaveAttribute('data-open', 'true')
  await expect(nameField(page)).toHaveValue('Pin 1')
  await page.getByRole('button', { name: 'Fechar detalhes' }).click()
  await expect(drawer).toHaveAttribute('data-open', 'false')
  await expect(map(page)).toHaveAttribute('data-pin-selected', '')
})

test('celular 390: com P, tocar no mapa cria o pin e abre o drawer sobreposto com o nome em edição; Esc fecha e tira a seleção (AC-F3-01)', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoEditor(page)
  await waitFinalMap(page)
  await page.keyboard.press('p')
  const at = await screenOf(page, 0.5, 0.5)
  await page.mouse.click(at.x, at.y)

  const drawer = page.getByTestId('drawer')
  await expect(map(page)).toHaveAttribute('data-pins', '1')
  await expect(drawer).toHaveAttribute('data-open', 'true')
  await expect(nameField(page)).toBeFocused()
  await expect(nameField(page)).toHaveValue('Novo pin')
  expect(await nameField(page).evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 8])

  await page.keyboard.press('Escape')
  await expect(drawer).toHaveAttribute('data-open', 'false')
  await expect(map(page)).toHaveAttribute('data-pin-selected', '')
  await expect(page.getByTestId('pin-drawer')).toHaveCount(0)
})

// Arrastar, excluir e desfazer (#158): AC-F3-04, AC-F3-05 e AC-F4-08.

/** Os pins gravados no IndexedDB, depois de o indicador dizer "Salvo". */
async function savedPins(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-status', 'saved')
  return page.evaluate(
    () =>
      new Promise<{ id: string; name: string; pos: { u: number; v: number }; description: string; tags: string[] }[]>((resolve) => {
        const open = indexedDB.open('rpg-world')
        open.onsuccess = () => {
          const get = open.result.transaction('worlds').objectStore('worlds').get('mundo-padrao')
          get.onsuccess = () => resolve(get.result.pins)
        }
      }),
  )
}

/** Um pin com a ficha preenchida, para conferir que Desfazer o devolve inteiro. */
const fullPin = () => ({ ...pin('p-cheio', 'castelo', 'Forte Alto', 0.45, 0.5), description: '<p>Muralhas</p>', tags: ['capital'], fields: { rei: 'Aldo' } })

test('arrastar um pin muda a posição, com o estado Arrastando, e a posição fica de 0 a 1 (AC-F3-04)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', defaultWorld({ pins: [fullPin()] }))
  await waitFinalMap(page)
  const from = await screenOf(page, 0.45, 0.5)
  const to = await screenOf(page, 0.55, 0.4)
  const rectBefore = await map(page).getAttribute('data-map-rect')

  await page.mouse.move(from.x, from.y - 10)
  await page.mouse.down()
  await page.mouse.move(from.x + 20, from.y - 30, { steps: 4 })
  await page.mouse.move(to.x, to.y - 10, { steps: 8 })
  await expect(map(page)).toHaveAttribute('data-pin-dragging', 'p-cheio')
  await expect(map(page)).toHaveClass(/cursor-grabbing/)
  await page.mouse.up()
  await expect(map(page)).toHaveAttribute('data-pin-dragging', '')
  // A câmera não fez pan.
  expect(await map(page).getAttribute('data-map-rect')).toBe(rectBefore)

  const [moved] = await savedPins(page)
  expect(moved.pos.u).toBeCloseTo(0.55, 2)
  expect(moved.pos.v).toBeCloseTo(0.4, 2)

  // Para além da borda do mapa: fica na borda.
  await page.mouse.move(to.x, to.y - 10)
  await page.mouse.down()
  await page.mouse.move(to.x + 40, to.y, { steps: 4 })
  await page.mouse.move(1430, 890, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await savedPins(page))[0].pos).toEqual({ u: 1, v: 1 })
})

test('Delete exclui o pin na hora, com o toast "Pin excluído"; Desfazer e Ctrl+Z o devolvem com a ficha, e Ctrl+Shift+Z refaz (AC-F3-05, AC-F4-08)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', defaultWorld({ pins: [fullPin()] }))
  await waitFinalMap(page)
  const redo = page.getByRole('button', { name: 'Refazer' })
  await expect(page.getByTestId('actions').getByRole('button', { name: 'Desfazer' })).toBeDisabled()
  await expect(redo).toBeDisabled()

  await clickPin(page, 0.45, 0.5)
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-cheio')
  await page.mouse.move(10, 450)
  await page.keyboard.press('Delete')
  await expect(map(page)).toHaveAttribute('data-pins', '0')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const toast = page.getByTestId('pin-deleted-toast')
  await expect(toast).toContainText('Pin excluído')
  await info.attach('pin-excluido.png', { body: await page.screenshot(), contentType: 'image/png' })
  expect(await savedPins(page)).toEqual([])

  // Desfazer pelo toast: o pin volta com a ficha inteira.
  await toast.getByRole('button', { name: 'Desfazer' }).click()
  await expect(toast).toHaveCount(0)
  await expect(map(page)).toHaveAttribute('data-pins', '1')
  expect(await savedPins(page)).toEqual([expect.objectContaining({ id: 'p-cheio', name: 'Forte Alto', description: '<p>Muralhas</p>', tags: ['capital'] })])

  // Refazer (Ctrl+Shift+Z) exclui de novo; Ctrl+Z desfaz; os botões da barra também.
  await page.keyboard.press('Control+Shift+Z')
  await expect(map(page)).toHaveAttribute('data-pins', '0')
  await page.keyboard.press('Control+Z')
  await expect(map(page)).toHaveAttribute('data-pins', '1')
  await expect(redo).toBeEnabled()
  await redo.click()
  await expect(map(page)).toHaveAttribute('data-pins', '0')
  await page.getByTestId('actions').getByRole('button', { name: 'Desfazer' }).click()
  await expect(map(page)).toHaveAttribute('data-pins', '1')
})

test('Ctrl+Z desfaz o arrasto de um pin e a mudança de um slider, num histórico só; desfazer o slider pede só o mapa final (AC-F4-08)', async ({ page }) => {
  test.setTimeout(120_000)
  await gotoEditor(page, '/', defaultWorld({ pins: [fullPin()] }))
  await waitFinalMap(page)

  // 1. Arrasta o pin.
  const from = await screenOf(page, 0.45, 0.5)
  await page.mouse.move(from.x, from.y - 10)
  await page.mouse.down()
  await page.mouse.move(from.x + 60, from.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await savedPins(page))[0].pos.u).not.toBeCloseTo(0.45, 2)

  // 2. Muda o Oceano pelo teclado.
  const ocean = page.getByRole('slider', { name: 'Oceano' })
  const start = Number(await ocean.getAttribute('aria-valuenow'))
  await ocean.focus()
  await page.keyboard.press('ArrowRight')
  await expect(ocean).toHaveAttribute('aria-valuenow', String(start + 1))
  await waitFinalMap(page)

  // Desfazer (com o foco no slider): o Oceano volta, e o mapa final é pedido direto, sem prévia
  // (o tamanho do terreno desenhado nunca passa pela prévia 256²).
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="map"]')!
    const w = window as unknown as { terrainSizes: string[] }
    w.terrainSizes = []
    new MutationObserver(() => w.terrainSizes.push(el.getAttribute('data-terrain-size') ?? '')).observe(el, {
      attributes: true,
      attributeFilter: ['data-terrain-size'],
    })
  })
  const fieldsBefore = await page.evaluate(() => document.querySelector('[data-testid="editor"]')?.getAttribute('data-generation-status'))
  expect(fieldsBefore).toBe('idle')
  await page.keyboard.press('Control+Z')
  await expect(ocean).toHaveAttribute('aria-valuenow', String(start))
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'generating')
  await waitFinalMap(page)
  expect(await page.evaluate(() => (window as unknown as { terrainSizes: string[] }).terrainSizes)).not.toContain('256')

  // Desfazer de novo: o pin volta ao lugar.
  await page.keyboard.press('Control+Z')
  await expect.poll(async () => (await savedPins(page))[0].pos).toEqual({ u: 0.45, v: 0.5 })

  // Refazer duas vezes: o pin e o Oceano voltam ao que eram.
  await page.keyboard.press('Control+Shift+Z')
  await page.keyboard.press('Control+Shift+Z')
  await expect(ocean).toHaveAttribute('aria-valuenow', String(start + 1))
  await expect.poll(async () => (await savedPins(page))[0].pos.u).not.toBeCloseTo(0.45, 2)
})

test('celular 390×844 com toque: arrastar um pin o move sem pan; Desfazer da barra o devolve, e Refazer fica habilitado (AC-F3-04, AC-F4-08)', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'o toque é simulado pelo CDP do Chrome')
  test.setTimeout(90_000)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  try {
    await gotoEditor(page, '/', defaultWorld({ pins: [fullPin()] }))
    await waitFinalMap(page)
    const rectBefore = await map(page).getAttribute('data-map-rect')
    const from = await screenOf(page, 0.45, 0.5)
    const to = await screenOf(page, 0.55, 0.4)
    const cdp = await ctx.newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })

    await touch('touchStart', from.x, from.y - 10)
    for (let i = 1; i <= 10; i++) await touch('touchMove', from.x + ((to.x - from.x) * i) / 10, from.y - 10 + ((to.y - from.y) * i) / 10)
    await expect(map(page)).toHaveAttribute('data-pin-dragging', 'p-cheio')
    await touch('touchEnd')
    await expect(map(page)).toHaveAttribute('data-pin-dragging', '')
    // A câmera não fez pan, e o arrasto não selecionou o pin (o drawer sobreposto continua fechado).
    expect(await map(page).getAttribute('data-map-rect')).toBe(rectBefore)
    await expect(page.getByTestId('drawer')).toHaveAttribute('data-open', 'false')
    const [moved] = await savedPins(page)
    expect(moved.pos.u).toBeCloseTo(0.55, 2)
    expect(moved.pos.v).toBeCloseTo(0.4, 2)

    // A barra de ações do celular: Desfazer devolve o pin, e Refazer fica habilitado.
    const actions = page.getByTestId('actions')
    const redo = actions.getByRole('button', { name: 'Refazer' })
    await expect(redo).toBeDisabled()
    await actions.getByRole('button', { name: 'Desfazer' }).click()
    await expect.poll(async () => (await savedPins(page))[0].pos).toEqual({ u: 0.45, v: 0.5 })
    await expect(actions.getByRole('button', { name: 'Desfazer' })).toBeDisabled()
    await expect(redo).toBeEnabled()
    await redo.click()
    await expect.poll(async () => (await savedPins(page))[0].pos.u).toBeCloseTo(0.55, 2)
  } finally {
    await ctx.close()
  }
})

test('1280×800 com a sidebar e o drawer: o toast "Pin excluído" ocupa a largura da área livre (16 px à esquerda, 12 à direita), acima da toolbar na segunda linha (AC-F3-05)', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await gotoEditor(page, '/', defaultWorld({ pins: [fullPin()] }))
  await waitFinalMap(page)
  await clickPin(page, 0.45, 0.5)
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-cheio')
  await page.mouse.move(10, 400)
  await page.keyboard.press('Delete')

  const toast = page.getByTestId('pin-deleted-toast')
  await expect(toast).toContainText('Pin excluído')
  // Área livre de 560 px (entre a sidebar de 320 e o drawer de 400): o toast não cabe ao lado do
  // zoom. Fica de 320 + 16 até 1280 − 400 − 12, 12 px acima da toolbar, que está numa segunda linha
  // 12 px acima do minimapa aberto (cartão de 140 px, 16 px da base).
  // (Espera a animação de entrada, que sobe o toast 8 px em 200 ms.)
  await expect
    .poll(async () => {
      const box = await toast.boundingBox()
      return box && [Math.round(box.x), Math.round(box.x + box.width), Math.round(box.y + box.height)]
    })
    .toEqual([320 + 16, 1280 - 400 - 12, 800 - 16 - 220])
  const toolbar = (await page.getByRole('toolbar', { name: 'Ferramentas' }).boundingBox())!
  const box = (await toast.boundingBox())!
  expect(Math.round(toolbar.y - (box.y + box.height))).toBe(12)
})

test('com o popover de Camadas aberto, apertar num pin o fecha (clique fora), e arrastar o pin continua sem pan (AC-F3-04)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', defaultWorld({ pins: [fullPin()] }))
  await waitFinalMap(page)
  const rectBefore = await map(page).getAttribute('data-map-rect')
  const popover = page.getByTestId('layers-popover')

  // Clique num pin: o popover fecha, e o pin é selecionado.
  await page.getByRole('toolbar', { name: 'Ferramentas' }).getByRole('button', { name: 'Camadas' }).click()
  await expect(popover).toBeVisible()
  await clickPin(page, 0.45, 0.5)
  await expect(popover).toBeHidden()
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-cheio')
  await page.keyboard.press('Escape')

  // Arrasto de um pin: o popover fecha, e a câmera não faz pan.
  await page.getByRole('toolbar', { name: 'Ferramentas' }).getByRole('button', { name: 'Camadas' }).click()
  await expect(popover).toBeVisible()
  const from = await screenOf(page, 0.45, 0.5)
  await page.mouse.move(from.x, from.y - 10)
  await page.mouse.down()
  await expect(popover).toBeHidden()
  await page.mouse.move(from.x + 60, from.y + 30, { steps: 8 })
  await expect(map(page)).toHaveAttribute('data-pin-dragging', 'p-cheio')
  await page.mouse.up()
  expect(await map(page).getAttribute('data-map-rect')).toBe(rectBefore)
  await expect.poll(async () => (await savedPins(page))[0].pos.u).not.toBeCloseTo(0.45, 2)

  // Fora dos pins, o arrasto ainda faz pan (o pan solto ao largar o pin).
  await page.keyboard.press('=')
  await page.keyboard.press('=')
  await expect(map(page)).toHaveAttribute('data-zoom', '1.563')
  const zoomed = await map(page).getAttribute('data-map-rect')
  const empty = await screenOf(page, 0.2, 0.8)
  await page.mouse.move(empty.x, empty.y)
  await page.mouse.down()
  await page.mouse.move(empty.x + 80, empty.y - 40, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => map(page).getAttribute('data-map-rect')).not.toBe(zoomed)
})
