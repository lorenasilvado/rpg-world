/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { centerPin, defaultWorld, gotoEditor } from './editor.ts'

// Agrupamento e ocultar por tipo (#162): abaixo de 0,8×, os pins próximos viram um grupo com
// contador, e o clique dá zoom nele (AC-F3-14); Camadas mostra e esconde os pins de cada tipo
// (AC-F3-15).

function pin(id: string, type: string, u: number, v: number) {
  return { id, type, name: id, pos: { u, v }, icon: { kind: 'builtin', key: type }, description: '', tags: [], fields: {} }
}

/** 200 pins (cidades e vilas) numa área pequena, perto do centro, e três soltos, longe deles. */
const crowded = () =>
  defaultWorld({
    pins: [
      ...Array.from({ length: 200 }, (_, i) => pin(`p${i}`, i % 2 ? 'vila' : 'cidade', 0.4 + (i % 20) * 0.002, 0.45 + Math.floor(i / 20) * 0.002)),
      pin('solto-1', 'npc', 0.2, 0.2),
      pin('solto-2', 'masmorra', 0.8, 0.3),
      pin('solto-3', 'castelo', 0.75, 0.8),
    ],
  })

const map = (page: Page) => page.getByTestId('map')

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(map(page)).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

/** Os grupos do mapa: o centro do círculo na página e o número de pins. */
async function groups(page: Page) {
  const box = await map(page).boundingBox()
  const raw = (await map(page).getAttribute('data-pin-groups')) ?? ''
  if (!raw || !box) return []
  return raw.split(';').map((g) => {
    const [x, y, n] = g.split(',').map(Number)
    return { x: box.x + x, y: box.y + y, n }
  })
}

async function zoomOutTo512(page: Page) {
  for (let i = 0; i < 3; i++) await page.keyboard.press('-')
  await expect(map(page)).toHaveAttribute('data-zoom', '0.512')
}

for (const [name, width, height] of [
  ['web 1440', 1440, 900],
  ['tablet 1024', 1024, 768],
  ['celular 390', 390, 844],
] as const) {
  test(`${name}: no zoom 0,5×, os 200 pins próximos viram um grupo com contador, e clicar nele dá zoom (AC-F3-14)`, async ({ page }, info) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height })
    await gotoEditor(page, '/', crowded())
    await waitFinalMap(page)
    // No zoom 1×, nada se agrupa.
    await expect(map(page)).toHaveAttribute('data-pins', '203')
    await expect(map(page)).toHaveAttribute('data-pin-groups', '')
    await expect(map(page)).toHaveAttribute('data-pins-shown', '203')

    await zoomOutTo512(page)
    await expect.poll(async () => (await groups(page)).map((g) => g.n)).toEqual([200])
    await expect(map(page)).toHaveAttribute('data-pins-shown', '3')
    await info.attach(`grupo-${width}.png`, { body: await page.screenshot(), contentType: 'image/png' })

    const [group] = await groups(page)
    if (width >= 768) {
      await page.mouse.move(group.x, group.y)
      await expect(map(page)).toHaveClass(/cursor-zoom-in/)
    }
    await page.mouse.click(group.x, group.y)
    await expect(map(page)).toHaveAttribute('data-zoom', '1.300')
    await expect(map(page)).toHaveAttribute('data-pin-groups', '')
    await expect(map(page)).toHaveAttribute('data-pin-selected', '')
    await expect(map(page)).toHaveAttribute('data-pins', '203')
  })
}

test('Camadas esconde e mostra os pins de cada tipo, e o grupo acompanha (AC-F3-15)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoEditor(page, '/', crowded())
  await waitFinalMap(page)

  await page.getByRole('button', { name: 'Camadas' }).click()
  const popover = page.getByTestId('layers-popover')
  await expect(popover.getByRole('switch')).toHaveText(['Decoração', 'Cidade', 'Vila', 'Castelo', 'Masmorra', 'NPC', 'Ponto de interesse', 'Personalizado'])
  await info.attach('camadas-1440.png', { body: await page.screenshot(), contentType: 'image/png' })

  // Sem as cidades: as 100 cidades somem, e o resto continua.
  const city = popover.getByRole('switch', { name: 'Cidade' })
  await city.click()
  await expect(city).toHaveAttribute('aria-checked', 'false')
  await expect(map(page)).toHaveAttribute('data-pins-shown', '103')
  await page.keyboard.press('Escape')

  // No zoom baixo, o grupo conta só as vilas.
  await zoomOutTo512(page)
  await expect.poll(async () => (await groups(page)).map((g) => g.n)).toEqual([100])
  await info.attach('sem-cidades-grupo-1440.png', { body: await page.screenshot(), contentType: 'image/png' })

  // Sem as vilas também, não sobra grupo.
  await page.getByRole('button', { name: 'Camadas' }).click()
  await popover.getByRole('switch', { name: 'Vila' }).click()
  await expect(map(page)).toHaveAttribute('data-pin-groups', '')
  await expect(map(page)).toHaveAttribute('data-pins-shown', '3')

  // Ligar de novo traz todos.
  await popover.getByRole('switch', { name: 'Cidade' }).click()
  await popover.getByRole('switch', { name: 'Vila' }).click()
  await expect.poll(async () => (await groups(page)).map((g) => g.n)).toEqual([200])
})

/**
 * O popover de Camadas cabe entre a barra superior e a toolbar, em qualquer lugar da toolbar; sem
 * espaço para as 8 linhas, ele rola, e o último interruptor continua alcançável.
 */
async function checkLayersPopover(page: Page) {
  await page.getByRole('button', { name: 'Camadas' }).click()
  const popover = page.getByTestId('layers-popover')
  const pop = (await popover.boundingBox())!
  const toolbar = (await page.getByTestId('map-toolbar').boundingBox())!
  const actions = (await page.getByTestId('actions').boundingBox())!
  expect(pop.y).toBeGreaterThanOrEqual(actions.y + actions.height)
  expect(pop.y + pop.height).toBeLessThanOrEqual(toolbar.y)
  expect(pop.x).toBeGreaterThanOrEqual(0)
  expect(pop.x + pop.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  // As linhas não encolhem para caber: todas têm a mesma altura.
  const heights = await popover.getByRole('switch').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
  expect(new Set(heights).size).toBe(1)
  const custom = popover.getByRole('switch', { name: 'Personalizado' })
  await custom.scrollIntoViewIfNeeded()
  await custom.click()
  await expect(custom).toHaveAttribute('aria-checked', 'false')
  return { pop, scrolls: await popover.evaluate((el) => el.scrollHeight > el.clientHeight) }
}

test('celular 390 (toque, toolbar acima do minimapa): o popover de Camadas cabe abaixo da barra superior (AC-F3-15)', async ({ browser }, info) => {
  test.setTimeout(90_000)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await gotoEditor(page, '/', crowded())
  await waitFinalMap(page)
  await expect(page.getByTestId('toolbar-slot')).toHaveAttribute('data-place', 'above')
  await checkLayersPopover(page)
  await expect(map(page)).toHaveAttribute('data-pins-shown', '203')
  await info.attach('camadas-390.png', { body: await page.screenshot(), contentType: 'image/png' })
  await ctx.close()
})

test('tablet 1024 (toque) com a sidebar e o drawer: a toolbar em pé, e o popover de Camadas cabe acima dela, rolando (AC-F3-15)', async ({ browser }, info) => {
  test.setTimeout(90_000)
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true })
  const page = await ctx.newPage()
  await gotoEditor(page, '/', defaultWorld({ pins: [centerPin, pin('p-npc', 'npc', 0.3, 0.3), pin('p-poi', 'custom', 0.35, 0.6)] }))
  await waitFinalMap(page)
  const [x, y, width, height] = ((await map(page).getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  await page.mouse.click(x + width / 2, y + height / 2 - 10)
  await expect(map(page)).toHaveAttribute('data-pin-selected', centerPin.id)
  await expect(page.getByTestId('toolbar-slot')).toHaveAttribute('data-place', 'vertical')
  const { scrolls } = await checkLayersPopover(page)
  expect(scrolls).toBe(true)
  await expect(map(page)).toHaveAttribute('data-pins-shown', '2')
  await info.attach('camadas-1024.png', { body: await page.screenshot(), contentType: 'image/png' })
  await ctx.close()
})

test('tela baixa (375 × 600, toque): o popover de Camadas rola, e o último interruptor funciona (AC-F3-15)', async ({ browser }) => {
  test.setTimeout(90_000)
  const ctx = await browser.newContext({ viewport: { width: 375, height: 600 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await gotoEditor(page, '/', crowded())
  await waitFinalMap(page)
  const { scrolls } = await checkLayersPopover(page)
  expect(scrolls).toBe(true)
  await ctx.close()
})
