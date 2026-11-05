/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

// Spike visual (#7): a página /mockup.html desenha o mapa estático sem erro.
test('o mockup desenha o terreno, a costa e os ícones (AC-M0-06, AC-M0-07)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/mockup.html')
  const canvas = page.getByTestId('mockup')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  expect(Number(await canvas.getAttribute('data-decor'))).toBeGreaterThan(100)

  // Cores presentes no canvas: o fundo, a costa e tons de água rasa, praia e floresta.
  const colors = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!
    const { data } = ctx.getImageData(0, 0, el.width, el.height)
    const seen = new Set<string>()
    for (let i = 0; i < data.length; i += 4) {
      seen.add('#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''))
    }
    return [...seen]
  })
  for (const c of ['#1f4e79', '#163a5c', '#6bb8dd', '#ebd9a6', '#3f8a4b']) expect(colors).toContain(c)
  expect(errors).toEqual([])
})
