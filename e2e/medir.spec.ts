/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { gotoEditor } from './editor.ts'

// Medir distância (#56, AC-F2-13): a ferramenta da toolbar (ou a tecla M), dois cliques no mapa e a
// distância em km no meio da linha; Esc apaga a medida e, de novo, volta para Navegar.

test.describe.configure({ timeout: 60_000 })

// Desktop 1440×900, no zoom 1×: o mapa (800 km) ocupa os 720 px da área livre, de 320 a 1040.
const KM_PER_PX = 800 / 720

async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoEditor(page)
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
  await expect(map).toHaveAttribute('data-map-rect', '320,90,720,720')
}

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Ferramentas' })

test('a ferramenta da toolbar mede a distância em km entre dois cliques (AC-F2-13)', async ({ page }) => {
  await open(page)
  await toolbar(page).getByRole('button', { name: 'Medir distância' }).click()
  await expect(toolbar(page).getByRole('button', { name: 'Medir distância' })).toHaveAttribute('aria-pressed', 'true')
  await expect(toolbar(page).getByRole('button', { name: 'Navegar' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('map')).toHaveCSS('cursor', 'crosshair')
  const hint = page.getByTestId('measure-hint')
  await expect(hint).toHaveText('Clique em dois pontos para medir')
  // A dica fica no topo, centrada na área livre (centro em 680).
  const box = (await hint.boundingBox())!
  expect(Math.abs(box.x + box.width / 2 - 680)).toBeLessThanOrEqual(1)

  await page.mouse.click(500, 450)
  await expect(hint).toHaveText('Clique no ponto final')
  // A linha segue o mouse até o segundo clique.
  await page.mouse.move(680, 450)
  await expect(page.getByTestId('measure-distance')).toHaveText(`${Math.round(180 * KM_PER_PX)} km`)
  // Sobre a toolbar, a linha fica no último ponto do mapa.
  await toolbar(page).getByRole('button', { name: 'Camadas' }).hover()
  await expect(page.getByTestId('measure-distance')).toHaveText(`${Math.round(180 * KM_PER_PX)} km`)
  await page.mouse.click(860, 450)
  // 360 px de 720: metade do mundo de 800 km.
  await expect(page.getByTestId('measure-distance')).toHaveText('400 km')
  await expect(page.getByTestId('measure-distance')).toHaveAttribute('data-final', 'true')
  // O clique não mexeu na câmera.
  await expect(page.getByTestId('map')).toHaveAttribute('data-map-rect', '320,90,720,720')
})

test('a tecla M liga a ferramenta, e 32 px medem o mesmo que a barra de escala (AC-F2-13)', async ({ page }) => {
  await open(page)
  await page.mouse.move(700, 300)
  await page.keyboard.press('m')
  await expect(toolbar(page).getByRole('button', { name: 'Medir distância' })).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.click(600, 400)
  await page.mouse.click(632, 400)
  // A barra de escala (32 px) diria 32 × 800 / 720 = 35,6 → "36 km" (com 720 px de área livre, ela
  // fica escondida: o controle de zoom é o compacto).
  await expect(page.getByTestId('measure-distance')).toHaveText(`${Math.round(32 * KM_PER_PX)} km`)
  // Com a sidebar recolhida, a área livre passa de 860 px e a escala aparece: a mesma medida dela.
  await page.keyboard.press('Escape')
  await page.keyboard.press('[')
  const scale = page.getByTestId('map-scale')
  await expect(scale).toBeVisible()
  await page.mouse.click(600, 400)
  await page.mouse.click(632, 400)
  await expect(page.getByTestId('measure-distance')).toHaveText((await scale.textContent())!)
})

test('arrastar continua fazendo pan, e a medida acompanha o mapa (AC-F2-13)', async ({ page }) => {
  await open(page)
  await page.keyboard.press('+')
  await expect(page.getByTestId('map')).toHaveAttribute('data-zoom', '1.250')
  await page.keyboard.press('m')
  await page.mouse.click(600, 450)
  await page.mouse.click(700, 450)
  const label = page.getByTestId('measure-distance')
  const before = (await label.boundingBox())!
  const km = await label.textContent()
  await page.mouse.move(800, 600)
  await page.mouse.down()
  await page.mouse.move(760, 560, { steps: 5 })
  await page.mouse.up()
  // O arrasto não marcou ponto: a mesma medida, que andou com o mapa.
  await expect(page.getByTestId('measure-layer')).toHaveAttribute('data-points', '2')
  await expect(label).toHaveText(km!)
  await expect.poll(async () => (await label.boundingBox())!.x).toBeLessThan(before.x - 20)
})

test('Esc apaga a medida e, de novo, volta para Navegar (AC-F2-13)', async ({ page }) => {
  await open(page)
  await page.keyboard.press('m')
  await page.mouse.click(500, 450)
  await page.mouse.click(860, 450)
  await expect(page.getByTestId('measure-distance')).toHaveText('400 km')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('measure-distance')).toHaveCount(0)
  await expect(page.getByTestId('measure-hint')).toHaveText('Clique em dois pontos para medir')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('measure-hint')).toHaveCount(0)
  await expect(toolbar(page).getByRole('button', { name: 'Navegar' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('map')).not.toHaveCSS('cursor', 'crosshair')
})

test('com Camadas aberto, Esc fecha só o popover e a medida fica (AC-F2-13)', async ({ page }) => {
  await open(page)
  await page.keyboard.press('m')
  await page.mouse.click(500, 450)
  await page.mouse.click(860, 450)
  await toolbar(page).getByRole('button', { name: 'Camadas' }).click()
  await expect(page.getByTestId('layers-popover')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('layers-popover')).toHaveCount(0)
  await expect(page.getByTestId('measure-distance')).toHaveText('400 km')
  await expect(toolbar(page).getByRole('button', { name: 'Medir distância' })).toHaveAttribute('aria-pressed', 'true')
})

test.describe('celular 390 com toque', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('tocar em dois pontos mede a distância, e a dica fica centrada (AC-F2-13)', async ({ page }) => {
    await gotoEditor(page)
    const map = page.getByTestId('map')
    await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
    // Abaixo de 768 px, o mapa usa a tela toda: 390 px de largura = 800 km.
    const [, , width] = ((await map.getAttribute('data-map-rect')) ?? '').split(',').map(Number)
    expect(width).toBe(390)
    await toolbar(page).getByRole('button', { name: 'Medir distância' }).tap()
    const hint = page.getByTestId('measure-hint')
    await expect(hint).toHaveText('Clique em dois pontos para medir')
    const box = (await hint.boundingBox())!
    expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThanOrEqual(1)
    await page.touchscreen.tap(50, 400)
    await expect(hint).toHaveText('Clique no ponto final')
    await page.touchscreen.tap(245, 400)
    // 195 px de 390: metade do mundo.
    await expect(page.getByTestId('measure-distance')).toHaveText('400 km')
  })

  test('com o painel sobreposto aberto, a tecla M não liga a ferramenta (AC-F2-13)', async ({ page }) => {
    await gotoEditor(page)
    await page.getByRole('button', { name: 'Abrir painel' }).tap()
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-open', 'true')
    await page.keyboard.press('m')
    await expect(page.getByTestId('map')).toHaveAttribute('data-tool', 'nav')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-open', 'false')
    await page.keyboard.press('m')
    await expect(page.getByTestId('map')).toHaveAttribute('data-tool', 'measure')
  })
})

test('o leitor de tela ouve a distância, e a tecla V volta para Navegar (AC-F2-13)', async ({ page }) => {
  await open(page)
  await page.keyboard.press('m')
  await page.mouse.click(500, 450)
  await page.mouse.click(860, 450)
  await expect(page.getByRole('status').filter({ hasText: 'Distância' })).toHaveText('Clique em dois pontos para medir. Distância: 400 km')
  await page.keyboard.press('v')
  await expect(toolbar(page).getByRole('button', { name: 'Navegar' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('measure-layer')).toHaveCount(0)
})
