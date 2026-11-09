/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { SpriteReport } from '../src/sprites/report.ts'

// Spike de 5.000 sprites (#10). O fps não é conferido aqui (AC-M0-16 é medição manual, numa
// máquina com GPU): o Chrome do teste desenha por software. Ficam a cena, a câmera e o relatório.
type Camera = { scale: number; x: number; y: number }

const camera = (page: Page) =>
  page.getByTestId('stage').evaluate((el: HTMLElement): Camera => ({
    scale: Number(el.dataset.scale),
    x: Number(el.dataset.x),
    y: Number(el.dataset.y),
  }))

async function open(page: Page, errors: string[], url = '/sprites.html?rapido') {
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(url)
  await expect(page.locator('body')).toHaveAttribute('data-state', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('stage')).toHaveAttribute('data-scale', /\d/)
}

/** Espera a câmera mudar em relação a `before` e parar. */
async function settled(page: Page, before: Camera): Promise<Camera> {
  let last = before
  await expect
    .poll(async () => {
      const now = await camera(page)
      const stopped = now.x === last.x && now.y === last.y && now.scale === last.scale
      const moved = now.x !== before.x || now.y !== before.y || now.scale !== before.scale
      last = now
      return moved && stopped
    }, { intervals: [500], timeout: 15_000 })
    .toBe(true)
  return last
}

test('5.000 sprites, medição concluída e relatório com a máquina (AC-M0-17)', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  await open(page, errors)
  await expect(page.getByTestId('stage')).toHaveAttribute('data-sprites', '5000')

  const before = await camera(page)
  await page.getByRole('button', { name: 'Medir automático' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
  expect((await camera(page)).scale).not.toBe(before.scale)

  const report = JSON.parse((await page.getByTestId('report').textContent()) ?? '') as SpriteReport
  test.info().annotations.push(
    { type: 'máquina', description: `${report.machine.userAgent} · ${report.machine.gpu}` },
    { type: 'fps (sem GPU, não vale para a meta)', description: `mínimo ${report.stats.minFps}` },
  )
  expect(report.sprites).toBe(5000)
  expect(report.mode).toBe('auto')
  expect(report.stats.frames).toBeGreaterThan(0)
  expect(report.machine.userAgent).not.toBe('')
  expect(report.machine.renderer).toBe('webgl')
  expect(report.screen.cssWidth).toBe(1440)
  expect(errors).toEqual([])
})

test('a medição manual sem pan e zoom não vale', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  await open(page, errors)

  await page.getByRole('button', { name: 'Medir manual' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
  await expect(page.getByTestId('verdict')).toContainText('faltou fazer pan e zoom')
  const idle = JSON.parse((await page.getByTestId('report').textContent()) ?? '') as SpriteReport
  expect(idle.gestures).toEqual({ panned: false, zoomed: false })
  expect(idle.pass).toBe(false)
  expect(errors).toEqual([])
})

test('a medição manual com pan e zoom registra os gestos', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  // Os 30 s completos: no CI, os gestos podem levar mais que os 2 s do modo rápido.
  await open(page, errors, '/sprites.html')

  await page.getByRole('button', { name: 'Medir manual' }).click()
  await page.mouse.move(900, 500)
  await page.mouse.wheel(0, -300)
  await page.mouse.down()
  await page.mouse.move(700, 420, { steps: 5 })
  await page.mouse.up()
  await expect(page.locator('body')).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
  await expect(page.getByTestId('verdict')).not.toContainText('Não vale')
  const moved = JSON.parse((await page.getByTestId('report').textContent()) ?? '') as SpriteReport
  expect(moved.gestures).toEqual({ panned: true, zoomed: true })
  expect(errors).toEqual([])
})

test('a roda dá zoom no cursor, a pinça dá zoom e o arrasto faz pan', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  await open(page, errors)
  const mouse = { x: 900, y: 500 }
  await page.mouse.move(mouse.x, mouse.y)

  // Roda: o ponto do mundo sob o cursor continua sob o cursor.
  const start = await camera(page)
  await page.mouse.wheel(0, -200)
  const zoomed = await settled(page, start)
  expect(zoomed.scale).toBeGreaterThan(start.scale)
  const worldBefore = (mouse.x - start.x) / start.scale
  const worldAfter = (mouse.x - zoomed.x) / zoomed.scale
  expect(Math.abs(worldAfter - worldBefore)).toBeLessThan(2)

  // Pinça do touchpad: o navegador a entrega como wheel com ctrlKey.
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -40)
  await page.keyboard.up('Control')
  const pinched = await settled(page, zoomed)
  expect(pinched.scale).toBeGreaterThan(zoomed.scale)

  // Arrasto: o mapa acompanha o ponteiro.
  await page.mouse.down()
  await page.mouse.move(mouse.x - 150, mouse.y - 60, { steps: 8 })
  await page.mouse.up()
  const panned = await settled(page, pinched)
  expect(panned.x).toBeLessThan(pinched.x)
  expect(panned.y).toBeLessThan(pinched.y)
  expect(errors).toEqual([])
})
