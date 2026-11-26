/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { centerPin, defaultWorld, gotoEditor, textFieldFontSizes } from './editor.ts'

// Editor no iPhone (Safari): reproduz os bugs de viewport vistos no aparelho, no projeto `iphone`
// (device iPhone 15 do Playwright: WebKit, isMobile, hasTouch). O WebKit do Playwright não aplica o
// zoom automático do iOS ao focar um campo: a causa 3 é verificada pela fonte computada.

/** Retrato do iPhone 15 (a tela inteira, sem as barras do Safari). */
const PORTRAIT = { width: 393, height: 852 }
/**
 * Paisagem como o Safari a entrega no iPhone 17 Pro Max (medido no simulador): a tela tem 956×440,
 * mas as faixas da safe area e as barras do navegador deixam 832×376. Passa de 768 px de largura
 * (vale `md:`) e fica abaixo de 500 px de altura (não vale `desk:`). No iPhone 17, a paisagem tem
 * 750×289 e nem chega a 768 px.
 */
const LANDSCAPE = { width: 832, height: 376 }

/** O estado de rolagem e do viewport, para ver onde o deslocamento aparece. */
function viewportSnapshot(page: Page) {
  return page.evaluate(() => ({
    editorScrollLeft: document.querySelector<HTMLElement>('[data-testid=editor]')!.scrollLeft,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scale: window.visualViewport?.scale,
    offsetLeft: window.visualViewport?.offsetLeft,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }))
}

async function openEditor(page: Page) {
  await gotoEditor(page)
  test.skip(await page.getByTestId('no-webgl2').isVisible(), 'WebKit sem WebGL2 neste ambiente')
}

// Ao abrir, o foco vai para "Fechar detalhes" com o drawer ainda em translate-x-full: o navegador
// rola o editor (overflow-hidden ainda é um contêiner de rolagem) até o botão. No Chrome e no WebKit
// do Playwright, o scrollLeft volta a 0 sozinho quando o drawer termina de deslizar (o scrollWidth
// encolhe); no Safari do iPhone, o mapa fica deslocado (a gravação do bug). Por isso o teste guarda o
// maior scrollLeft visto, não só o do fim.
test('causa 1: abrir e fechar o drawer de detalhes não rola o editor para o lado', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PORTRAIT)
  await openEditor(page)
  await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('[data-testid=editor]')!
    const w = window as typeof window & { maxEditorScrollLeft: number }
    w.maxEditorScrollLeft = 0
    editor.addEventListener('scroll', () => (w.maxEditorScrollLeft = Math.max(w.maxEditorScrollLeft, editor.scrollLeft)))
  })

  const before = await viewportSnapshot(page)
  await page.getByRole('button', { name: 'Abrir detalhes' }).click()
  await expect(page.getByTestId('drawer')).toHaveAttribute('data-open', 'true')
  // A transição do drawer (200 ms) mais folga.
  await page.waitForTimeout(250)
  const opened = await viewportSnapshot(page)
  await page.getByRole('button', { name: 'Fechar detalhes' }).click()
  await expect(page.getByTestId('drawer')).toHaveAttribute('data-open', 'false')
  await page.waitForTimeout(250)
  const after = await viewportSnapshot(page)

  const maxEditorScrollLeft = await page.evaluate(() => (window as typeof window & { maxEditorScrollLeft: number }).maxEditorScrollLeft)

  const snapshots = { before, opened, after, maxEditorScrollLeft }
  console.log('causa 1:', JSON.stringify(snapshots, null, 2))
  await info.attach('causa-1-snapshot.json', { body: JSON.stringify(snapshots, null, 2), contentType: 'application/json' })
  expect(maxEditorScrollLeft).toBe(0)
  expect(after.editorScrollLeft).toBe(0)
})

test('causa 2: em paisagem (832×376), a sidebar é painel sobreposto, não fixa', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(LANDSCAPE)
  await openEditor(page)

  const sidebar = page.getByTestId('sidebar')
  const opener = page.getByRole('button', { name: 'Abrir painel' })
  const state = {
    openerVisible: await opener.isVisible(),
    sidebarClass: (await sidebar.getAttribute('class')) ?? '',
    sidebarX: (await sidebar.boundingBox())?.x,
  }
  console.log('causa 2:', JSON.stringify(state))
  expect(state.openerVisible).toBe(true)
  expect(state.sidebarClass).toContain('-translate-x-full')
})

test('causa 3: em paisagem (832×376), o campo Seed tem fonte de 16 px ou mais', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(LANDSCAPE)
  await openEditor(page)
  // Abaixo do corte `desk:`, a sidebar fechada fica invisível: o campo só existe com ela aberta.
  await page.getByRole('button', { name: 'Abrir painel' }).click()
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-open', 'true')

  const seed = page.getByRole('textbox', { name: 'Seed' })
  const fontSize = await seed.evaluate((el) => getComputedStyle(el).fontSize)
  console.log('causa 3: font-size do Seed =', fontSize)
  expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16)
})

test('causa 4: ao girar de retrato para paisagem, o canvas do mapa acompanha a largura da janela', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PORTRAIT)
  await openEditor(page)
  const canvas = page.getByTestId('map-canvas')
  await expect(canvas).toBeVisible()

  await page.setViewportSize(LANDSCAPE)
  // Sem esperar o resize do Pixi: a primeira leitura depois do layout é o que o iOS mostraria.
  const first = await canvas.evaluate((el) => ({ canvas: el.clientWidth, window: window.innerWidth }))
  await page.waitForTimeout(300)
  const settled = await canvas.evaluate((el) => ({ canvas: el.clientWidth, window: window.innerWidth }))
  console.log('causa 4:', JSON.stringify({ first, settled }))
  expect(settled.canvas).toBe(settled.window)
})

// A regra de toque (src/index.css) sobe para 16 px os campos menores; os maiores, como o nome do pin
// (21 px, com `!`), não podem cair para a fonte do pai.
test('em tela de toque, os campos do drawer têm 16 px ou mais, e o nome do pin continua com 21 px', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PORTRAIT)
  await gotoEditor(page, '/', defaultWorld({ pins: [centerPin] }))
  test.skip(await page.getByTestId('no-webgl2').isVisible(), 'WebKit sem WebGL2 neste ambiente')
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  const [x, y, w, h] = ((await map.getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  await page.touchscreen.tap(x + w / 2, y + h / 2 - 16)
  await expect(map).toHaveAttribute('data-pin-selected', centerPin.id)
  await expect(page.getByTestId('drawer')).toHaveAttribute('data-open', 'true')

  const sizes = await textFieldFontSizes(page.getByTestId('drawer'))
  console.log('fontes do drawer:', JSON.stringify(sizes))
  expect(sizes['Nome do pin']).toBe(21)
  for (const size of Object.values(sizes)) expect(size).toBeGreaterThanOrEqual(16)
})

// O mesmo para o drawer da estrada: o nome (21 px, com `!`) não cai para a fonte do pai.
test('em tela de toque, os campos do drawer da estrada têm 16 px ou mais, e o nome da estrada continua com 21 px', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PORTRAIT)
  const road = { id: 'r-centro', name: 'Estrada do Centro', kind: 'road', points: [{ u: 0.3, v: 0.5 }, { u: 0.5, v: 0.5 }, { u: 0.7, v: 0.5 }] }
  await gotoEditor(page, '/', defaultWorld({ roads: [road] }))
  test.skip(await page.getByTestId('no-webgl2').isVisible(), 'WebKit sem WebGL2 neste ambiente')
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  const [x, y, w, h] = ((await map.getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  await page.touchscreen.tap(x + w / 2, y + h / 2)
  await expect(map).toHaveAttribute('data-road-selected', road.id)
  await expect(page.getByTestId('drawer')).toHaveAttribute('data-open', 'true')

  const sizes = await textFieldFontSizes(page.getByTestId('road-drawer'))
  expect(sizes['Nome da estrada']).toBe(21)
  for (const size of Object.values(sizes)) expect(size).toBeGreaterThanOrEqual(16)
})
