/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

// Sidebar: seções e sliders (#49). A direção de cada slider é conferida no núcleo
// (src/core/world/sliders.test.ts); aqui fica o caminho real: o slider na tela muda o mapa desenhado.

const SLIDERS = [
  'Oceano',
  'Praias',
  'Desertos',
  'Florestas',
  'Montanhas',
  'Neve',
  'Tamanho do continente',
  'Rugosidade da costa',
  'Temperatura global',
]

/** Abre o editor e espera o mapa final 1024² desenhado. */
async function openEditor(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
}

/** Print do mapa na área livre (o retângulo do mapa na tela). */
async function mapShot(page: Page) {
  const [x, y, w, h] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return page.screenshot({ clip: { x, y, width: w, height: h } })
}

/** Espera o mapa final de novo, depois de mudar um slider. */
async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024')
}

test('cada um dos 9 sliders muda o mapa desenhado (AC-F1-05)', async ({ page }) => {
  test.setTimeout(120_000)
  await openEditor(page)
  await page.getByRole('button', { name: 'Avançado' }).click()
  for (const name of SLIDERS) {
    const before = await mapShot(page)
    const slider = page.getByRole('slider', { name })
    const value = Number(await slider.getAttribute('aria-valuenow'))
    // 30 pontos para o lado com mais espaço; depois volta ao valor de antes, para o próximo slider
    // partir do mapa padrão.
    const [go, back] = value <= 50 ? ['Shift+ArrowRight', 'Shift+ArrowLeft'] : ['Shift+ArrowLeft', 'Shift+ArrowRight']
    await slider.focus()
    for (let i = 0; i < 3; i++) await page.keyboard.press(go)
    await waitFinalMap(page)
    await expect.poll(async () => (await mapShot(page)).equals(before), { message: name }).toBe(false)
    for (let i = 0; i < 3; i++) await page.keyboard.press(back)
    await expect(slider).toHaveAttribute('aria-valuenow', String(value))
    await waitFinalMap(page)
  }
})

test('só com o teclado: Tab chega aos sliders, que têm rótulo, e as setas mudam o valor (AC-F1-13)', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Recolher painel' }).focus()
  // Antes de Terreno: a seção Seed (cabeçalho, campo, sortear e copiar) e o cabeçalho de Presets.
  for (const name of ['Seed', 'Seed', 'Seed aleatória', 'Copiar seed', 'Presets']) {
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAccessibleName(name)
  }
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Terreno' })).toBeFocused()
  await page.keyboard.press('Tab')
  const ocean = page.getByRole('slider', { name: 'Oceano' })
  await expect(ocean).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(ocean).toHaveAttribute('aria-valuenow', '46')
  await page.keyboard.press('Shift+ArrowLeft')
  await expect(ocean).toHaveAttribute('aria-valuenow', '36')
  await expect(page.getByTestId('slider-ocean')).toContainText('36%')
  // As setas no slider não movem a câmera.
  await expect(page.getByTestId('map')).toHaveAttribute('data-zoom', '1.000')
  await waitFinalMap(page)

  await page.getByRole('button', { name: 'Avançado' }).press('Enter')
  for (const name of SLIDERS) await expect(page.getByRole('slider', { name })).toBeVisible()
})

test('segurar a seta mostra a prévia; soltar a tecla gera o mapa final', async ({ page }) => {
  await openEditor(page)
  const ocean = page.getByRole('slider', { name: 'Oceano' })
  await ocean.focus()
  // Tecla pressionada e repetida: só prévias.
  for (let i = 0; i < 6; i++) await page.keyboard.down('ArrowRight')
  await expect(ocean).toHaveAttribute('aria-valuenow', '51')
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '256')
  await page.keyboard.up('ArrowRight')
  await waitFinalMap(page)
})

test('arrastar Desertos mostra a prévia, e Florestas recua e pisca durante o arrasto; soltar gera o mapa final (AC-F1-14)', async ({ page }) => {
  await openEditor(page)
  const desert = page.getByRole('slider', { name: 'Desertos' })
  const forest = page.getByRole('slider', { name: 'Florestas' })
  const track = (await page.getByTestId('slider-desert').locator('span[data-orientation]').first().boundingBox())!
  const thumb = (await desert.boundingBox())!
  // O flash dura 700 ms desde o primeiro recuo (perto de 66%): numa máquina lenta ele já pode ter
  // acabado ao fim do arrasto. Um observador anota se ele apareceu em algum momento.
  await page.getByTestId('slider-forest').evaluate((row) => {
    const w = window as unknown as { flashSeen: boolean }
    w.flashSeen = false
    new MutationObserver(() => {
      if (row.dataset.flash === 'true') w.flashSeen = true
    }).observe(row, { attributes: true, attributeFilter: ['data-flash'] })
  })
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2)
  await page.mouse.down()
  // Até 70% do trilho, em passos, como um arrasto de verdade.
  await page.mouse.move(track.x + track.width * 0.7, track.y + track.height / 2, { steps: 12 })
  await expect(desert).toHaveAttribute('aria-valuenow', /^(69|70|71)$/)
  const desertValue = Number(await desert.getAttribute('aria-valuenow'))
  await expect(forest).toHaveAttribute('aria-valuenow', String(100 - desertValue))
  expect(await page.evaluate(() => (window as unknown as { flashSeen: boolean }).flashSeen)).toBe(true)
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '256')
  await page.mouse.up()
  await waitFinalMap(page)
  await expect(page.getByTestId('slider-forest')).toHaveAttribute('data-flash', 'false')
})

test('arrastar e soltar de volta no valor inicial também gera o mapa final (AC-F1-11)', async ({ page }) => {
  await openEditor(page)
  const desert = page.getByRole('slider', { name: 'Desertos' })
  const forest = page.getByRole('slider', { name: 'Florestas' })
  const track = (await page.getByTestId('slider-desert').locator('span[data-orientation]').first().boundingBox())!
  const thumb = (await desert.boundingBox())!
  const start = { x: thumb.x + thumb.width / 2, y: thumb.y + thumb.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(track.x + track.width * 0.7, start.y, { steps: 10 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '256')
  await expect(forest).toHaveAttribute('aria-valuenow', /^(29|30|31)$/)
  // De volta ao valor de partida: Desertos volta a 15 (Florestas fica onde recuou). O ponteiro
  // vai à posição de 15% do trilho (o Radix desenha o thumb um pouco para dentro nas pontas).
  await page.mouse.move(track.x + track.width * 0.15, start.y, { steps: 10 })
  await expect(desert).toHaveAttribute('aria-valuenow', '15')
  await page.mouse.up()
  await waitFinalMap(page)
})

test('as seções recolhem e abrem, e o painel recolhe a 48 px e abre pela tecla [ (AC-F1-21)', async ({ page }) => {
  await openEditor(page)
  const terreno = page.getByRole('button', { name: 'Terreno' })
  await terreno.click()
  await expect(terreno).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('slider', { name: 'Oceano' })).toBeHidden()
  await terreno.click()
  await expect(page.getByRole('slider', { name: 'Oceano' })).toBeVisible()

  const sidebar = page.getByTestId('sidebar')
  const map = page.getByTestId('map')
  const rectBefore = await map.getAttribute('data-map-rect')
  await page.locator('body').press('[')
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(48)
  // O mapa passa a caber na área livre maior (de 48 a 1040 px).
  await expect.poll(async () => Number((await map.getAttribute('data-map-rect'))?.split(',')[0])).toBeLessThan(320)
  expect(await map.getAttribute('data-map-rect')).not.toBe(rectBefore)
  await expect(page.getByRole('slider', { name: 'Oceano' })).toHaveCount(0)

  await page.keyboard.press('[')
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(320)
  await expect(map).toHaveAttribute('data-map-rect', rectBefore!)

  await page.getByRole('button', { name: 'Recolher painel' }).click()
  await expect(page.getByRole('button', { name: 'Expandir painel' })).toBeFocused()
  await page.getByRole('button', { name: 'Relevo' }).click()
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(320)
  await expect(page.getByRole('slider', { name: 'Montanhas' })).toBeVisible()
})

for (const [label, width, height] of [
  ['tablet 1024', 1024, 768],
  ['celular 390', 390, 844],
] as const) {
  test(`${label}: os sliders aparecem na sidebar e mudam o valor`, async ({ page }) => {
    await openEditor(page, width, height)
    if (width < 768) {
      await page.getByRole('button', { name: 'Abrir painel' }).click()
      await expect(page.getByRole('button', { name: 'Recolher painel' })).toHaveCount(0)
    }
    const ocean = page.getByRole('slider', { name: 'Oceano' })
    await expect(ocean).toBeVisible()
    await ocean.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(ocean).toHaveAttribute('aria-valuenow', '44')
    await waitFinalMap(page)
  })
}
