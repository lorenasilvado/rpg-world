/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

// O build de produção abre no caminho base do GitHub Pages, como em
// https://lorenasilvado.github.io/rpg-world/ (AC-M0-05).
test('o build abre em /rpg-world/ sem erro, com os assets no caminho base (AC-M0-05)', async ({ page }) => {
  const sameOrigin: string[] = []
  const problems: string[] = []
  page.on('request', (r) => {
    // Só os pedidos ao próprio app (as fontes vêm do Google Fonts, fora dele).
    if (new URL(r.url()).origin === 'http://localhost:5198') sameOrigin.push(new URL(r.url()).pathname)
  })
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`)
  })
  page.on('requestfailed', (r) => problems.push(`falhou ${r.url()}`))
  page.on('pageerror', (e) => problems.push(`erro ${e.message}`))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('./')
  await expect(page.getByTestId('sidebar')).toBeVisible()
  await expect(page.getByTestId('map')).toBeVisible()

  const assets = sameOrigin.filter((p) => p.includes('/assets/'))
  expect(assets.length).toBeGreaterThan(0)
  for (const p of sameOrigin) expect(p.startsWith('/rpg-world/')).toBe(true)
  expect(problems).toEqual([])
})
