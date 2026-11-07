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

// A medição do spike de desempenho (#9) abre no caminho base, com o worker do build gerando.
test('a medição abre em /rpg-world/bench.html e o worker do build gera (AC-M0-05)', async ({ page }) => {
  const problems: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`)
  })
  page.on('pageerror', (e) => problems.push(`erro ${e.message}`))
  const workers: string[] = []
  page.on('worker', (w) => workers.push(new URL(w.url()).pathname))
  await page.goto('./bench.html?rapido')
  await page.getByRole('button', { name: 'Medir' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
  expect(workers.some((p) => p.startsWith('/rpg-world/assets/'))).toBe(true)
  expect(problems).toEqual([])
})

// O mockup do spike visual (#7) também abre no caminho base, com o spritesheet carregando.
test('o mockup abre em /rpg-world/mockup.html com o spritesheet (AC-M0-05, AC-M0-08)', async ({ page }) => {
  const problems: string[] = []
  const images: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`)
    if (r.request().resourceType() === 'image') images.push(new URL(r.url()).pathname)
  })
  page.on('pageerror', (e) => problems.push(`erro ${e.message}`))
  await page.goto('./mockup.html')
  await expect(page.getByTestId('mockup')).toHaveAttribute('data-ready', 'true')
  expect(images.some((p) => p.startsWith('/rpg-world/assets/decor'))).toBe(true)
  expect(problems).toEqual([])
})
