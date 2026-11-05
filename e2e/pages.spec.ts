/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

// O build de produção abre no caminho base do GitHub Pages, como em
// https://lorenasilvado.github.io/rpg-world/ (AC-M0-05).
test('o build abre em /rpg-world/ sem erro, com os assets no caminho base (AC-M0-05)', async ({ page }) => {
  const APP = 'http://localhost:5198'
  const isApp = (url: string) => new URL(url).origin === APP
  // Só contam os pedidos ao próprio app: as fontes vêm do Google Fonts, e uma falha lá não é
  // problema deste build.
  const sameOrigin: string[] = []
  const problems: string[] = []
  page.on('request', (r) => {
    if (isApp(r.url())) sameOrigin.push(new URL(r.url()).pathname)
  })
  page.on('response', (r) => {
    if (isApp(r.url()) && r.status() >= 400) problems.push(`${r.status()} ${r.url()}`)
  })
  page.on('requestfailed', (r) => {
    if (isApp(r.url())) problems.push(`falhou ${r.url()}`)
  })
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
