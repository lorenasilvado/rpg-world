/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test'
import { gotoEditor } from './editor.ts'

// Minimapa, escala e controles de zoom (#53, AC-F2-08 e AC-F2-09). O renderer expõe no mapa o
// retângulo dele na tela (`data-map-rect`) e o zoom relativo (`data-zoom`); o minimapa expõe em
// `data-drawn` o tamanho do campo que desenhou.

test.describe.configure({ timeout: 60_000 })

type Rect = { x: number; y: number; width: number; height: number }

async function open(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await gotoEditor(page)
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
  await expect(map).toHaveAttribute('data-map-rect', /.+/)
}

async function mapRect(page: Page): Promise<Rect> {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return { x, y, width, height }
}

const zoom = async (page: Page) => Number(await page.getByTestId('map').getAttribute('data-zoom'))

/** Espera a câmera parar: o retângulo do mapa igual por 400 ms (mais que os 350 ms do deslizamento). */
async function settled(page: Page): Promise<Rect> {
  let last = ''
  let since = 0
  await expect
    .poll(async () => {
      const now = (await page.getByTestId('map').getAttribute('data-map-rect')) ?? ''
      if (now !== last) {
        last = now
        since = Date.now()
      }
      return Date.now() - since >= 400
    }, { intervals: [100], timeout: 15_000 })
    .toBe(true)
  return mapRect(page)
}

/**
 * Espera o zoom chegar a `expected` e a câmera parar. Logo depois do mapa final, a thread principal
 * fica ocupada (textura, decoração, minimapa) e o primeiro quadro do deslizamento pode demorar mais
 * que os 400 ms do `settled`: sem esperar o zoom, ele pode terminar antes de a câmera sair do lugar.
 */
async function zoomed(page: Page, expected: number): Promise<Rect> {
  await expect.poll(() => zoom(page), { intervals: [100], timeout: 15_000 }).toBeCloseTo(expected, 2)
  return settled(page)
}

async function box(locator: Locator): Promise<Rect> {
  const b = await locator.boundingBox()
  if (!b) throw new Error('elemento sem caixa')
  return b
}

/** O elemento no centro de `locator` é ele mesmo (ou está dentro dele): nada o cobre. */
async function onTop(locator: Locator) {
  const b = await box(locator)
  return locator.evaluate((el, [x, y]) => {
    const hit = document.elementFromPoint(x, y)
    return !!hit && (hit === el || el.contains(hit))
  }, [b.x + b.width / 2, b.y + b.height / 2])
}

test('AC-F2-08: o minimapa mostra o mapa, e o retângulo acompanha a câmera', async ({ page }) => {
  await open(page)
  const minimap = page.getByTestId('minimap-surface')
  await expect(minimap).toHaveAttribute('data-drawn', '1024')
  // 160 × 100, no canto inferior esquerdo da área livre, 16 px da base.
  const mm = await box(minimap)
  expect(mm.width).toBe(160)
  expect(mm.height).toBe(100)
  const card = await box(page.getByTestId('minimap'))
  expect(card.x).toBe(320 + 16)
  expect(Math.round(900 - (card.y + card.height))).toBe(16)
  // O minimapa tem o terreno desenhado (não é só o fundo do oceano).
  const colors = await minimap.locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    const set = new Set<string>()
    for (let i = 0; i < d.length; i += 4 * 97) set.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`)
    return set.size
  })
  expect(colors).toBeGreaterThan(5)

  // No zoom 1×, o mapa inteiro está à vista: o retângulo cobre o mapa do minimapa (100 × 100).
  const view = page.getByTestId('minimap-view')
  await settled(page)
  let r = await box(view)
  expect(Math.round(r.width)).toBe(100)
  expect(Math.round(r.height)).toBe(100)

  // Aproximando, o retângulo encolhe.
  await page.getByRole('button', { name: 'Aproximar' }).click()
  await page.getByRole('button', { name: 'Aproximar' }).click()
  await zoomed(page, 1.5625)
  r = await box(view)
  // Área livre 720 × 900 no zoom 1,5625: 720 px mostram 1024 / 1,5625 = 655 unidades → 64 px.
  expect(r.width).toBeCloseTo(64, 0)
  expect(r.height).toBeCloseTo(80, 0)
})

test('AC-F2-08: arrastar o retângulo move a área visível', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Aproximar' }).click()
  await page.getByRole('button', { name: 'Aproximar' }).click()
  const before = await zoomed(page, 1.5625)
  const view = page.getByTestId('minimap-view')
  const r = await box(view)
  const from = { x: r.x + r.width / 2 + 5, y: r.y + r.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 5, from.y + 4, { steps: 3 })
  await page.mouse.move(from.x + 10, from.y + 8, { steps: 3 })
  await page.mouse.up()
  const after = await settled(page)
  // 10 px no minimapa são 102,4 unidades do mundo; o mapa anda o mesmo na tela, na escala dele.
  const scale = before.width / 1024
  expect(after.x - before.x).toBeCloseTo(-102.4 * scale, -1)
  expect(after.y - before.y).toBeCloseTo(-81.92 * scale, -1)
  expect(after.width).toBe(before.width)
  // O retângulo foi junto com o arrasto.
  const moved = await box(view)
  expect(moved.x - r.x).toBeCloseTo(10, 0)
  expect(moved.y - r.y).toBeCloseTo(8, 0)
})

test('AC-F2-08: tocar fora do retângulo centra a câmera ali', async ({ page }) => {
  await open(page)
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Aproximar' }).click()
  await zoomed(page, 1.25 ** 4)
  const mm = await box(page.getByTestId('minimap-surface'))
  // O canto noroeste do mapa no minimapa (x 30..130): o mapa encosta no canto da área livre.
  await page.mouse.click(mm.x + 32, mm.y + 2)
  const after = await settled(page)
  expect(after.x).toBe(320)
  expect(after.y).toBe(0)
})

test('AC-F2-08: o minimapa recolhe e abre', async ({ page }) => {
  await open(page)
  const toggle = page.getByRole('button', { name: 'Minimapa' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('minimap-surface')).toBeHidden()
  // Recolhido, fica só o cabeçalho, ainda na base.
  const card = await box(page.getByTestId('minimap'))
  expect(card.height).toBeLessThan(40)
  expect(Math.round(900 - (card.y + card.height))).toBe(16)
  await toggle.click()
  await expect(page.getByTestId('minimap-surface')).toBeVisible()
})

test('AC-F2-09: com área livre de 860 px ou mais, mostra a escala e a porcentagem; os botões fazem zoom e centralizam', async ({ page }) => {
  await open(page)
  // Sidebar recolhida: 1440 − 48 − 400 = 992 px de área livre.
  await page.getByRole('button', { name: 'Recolher painel' }).click()
  const controls = page.getByTestId('zoom-controls')
  await expect(page.getByTestId('zoom-percent')).toHaveText('100%')
  // Mapa inteiro em 900 px de altura: 32 px = 800 × 32 / 900 ≈ 28 km.
  await expect(page.getByTestId('map-scale')).toHaveText('28 km')
  // No canto inferior direito da área livre: 12 px do drawer e 16 px da base.
  const c = await box(controls)
  expect(Math.round(1440 - 400 - (c.x + c.width))).toBe(12)
  expect(Math.round(900 - (c.y + c.height))).toBe(16)

  await page.getByRole('button', { name: 'Aproximar' }).click()
  await zoomed(page, 1.25)
  await expect(page.getByTestId('zoom-percent')).toHaveText('125%')
  await expect(page.getByTestId('map-scale')).toHaveText('23 km')
  await page.getByRole('button', { name: 'Afastar' }).click()
  await page.getByRole('button', { name: 'Afastar' }).click()
  await zoomed(page, 0.8)
  await expect(page.getByTestId('zoom-percent')).toHaveText('80%')
  await page.getByRole('button', { name: 'Centralizar' }).click()
  const fit = await zoomed(page, 1)
  await expect(page.getByTestId('zoom-percent')).toHaveText('100%')
  expect(fit).toEqual({ x: 48 + (992 - 900) / 2, y: 0, width: 900, height: 900 })
})

test('AC-F2-09: com menos de 860 px de área livre, esconde a escala e a porcentagem', async ({ page }) => {
  // Sidebar aberta: 1440 − 320 − 400 = 720 px.
  await open(page)
  await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'true')
  await expect(page.getByTestId('map-scale')).toHaveCount(0)
  await expect(page.getByTestId('zoom-percent')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Centralizar' })).toBeVisible()
  // Recolhendo a sidebar, a área passa de 860 px e elas voltam; abrindo de novo, somem.
  await page.getByRole('button', { name: 'Recolher painel' }).click()
  await expect(page.getByTestId('zoom-percent')).toBeVisible()
  await page.getByRole('button', { name: 'Expandir painel' }).click()
  await expect(page.getByTestId('zoom-percent')).toHaveCount(0)
})

for (const { name, width, height } of [
  { name: 'tablet 1024', width: 1024, height: 768 },
  { name: 'celular 390', width: 390, height: 844 },
]) {
  test(`${name}: o minimapa e os botões de zoom ficam à vista e clicáveis (AC-F2-08, AC-F2-09)`, async ({ page }) => {
    await open(page, width, height)
    await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'true')
    await expect(page.getByTestId('zoom-percent')).toHaveCount(0)
    for (const label of ['Afastar', 'Aproximar', 'Centralizar']) {
      const button = page.getByRole('button', { name: label })
      await expect(button).toBeVisible()
      expect(await onTop(button)).toBe(true)
    }
    await expect(page.getByTestId('minimap-surface')).toBeVisible()
    await page.getByRole('button', { name: 'Aproximar' }).click()
    await zoomed(page, 1.25)
  })
}
