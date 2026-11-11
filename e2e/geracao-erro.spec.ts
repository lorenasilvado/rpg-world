/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

// Falha do worker de geração (#34, AC-F1-12): o editor gera o mapa ao abrir; se o script do worker
// não carregar, o pedido é rejeitado (em vez de ficar esperando) e aparece o toast de erro. Com o
// script de volta, "Tentar de novo" cria um worker novo e o toast some.
const WORKER = '**/generator.worker*'

test('o worker não carrega: aparece o toast de erro, e "Tentar de novo" gera o mapa (AC-F1-12)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route(WORKER, (route) => route.abort())
  await page.goto('/')

  const toast = page.getByRole('alert')
  await expect(toast).toHaveText(/Não foi possível gerar o mapa/)
  await expect(toast).toHaveCSS('background-color', 'rgb(179, 58, 46)')
  // Acima da linha inferior, à esquerda do drawer (400 px) com 16 px de folga.
  // (Espera a animação de entrada, que sobe o toast 8 px em 200 ms.)
  await expect
    .poll(async () => {
      const box = await toast.boundingBox()
      return box && [Math.round(box.x + box.width), Math.round(box.y + box.height)]
    })
    .toEqual([1440 - 400 - 16, 900 - 16])

  await page.unroute(WORKER)
  const loaded = page.waitForRequest(/generator\.worker/)
  await toast.getByRole('button', { name: 'Tentar de novo' }).click()
  await loaded
  await expect(toast).toBeHidden()
  // O mapa final termina sem falhar de novo.
  await page.waitForTimeout(3000)
  await expect(toast).toBeHidden()
})

test('celular 390×844: o toast ocupa a largura com 16 px de folga e "Tentar de novo" funciona (AC-F1-12)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(WORKER, (route) => route.abort())
  await page.goto('/')

  const toast = page.getByRole('alert')
  await expect(toast).toHaveText(/Não foi possível gerar o mapa/)
  // (Espera a animação de entrada, que sobe o toast 8 px em 200 ms.)
  await expect
    .poll(async () => {
      const box = await toast.boundingBox()
      return box && [Math.round(box.x), Math.round(box.x + box.width), Math.round(box.y + box.height)]
    })
    .toEqual([16, 390 - 16, 844 - 16])

  await page.unroute(WORKER)
  const loaded = page.waitForRequest(/generator\.worker/)
  await toast.getByRole('button', { name: 'Tentar de novo' }).click()
  await loaded
  await expect(toast).toBeHidden()
})

test('com o worker funcionando, o toast não aparece', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(3000)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('no /bench.html, o worker que não carrega encerra a medição com erro, em vez de deixá-la em "running"', async ({ page }) => {
  await page.route(WORKER, (route) => route.abort())
  await page.goto('/bench.html?rapido')
  await page.getByRole('button', { name: 'Medir' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error')
  await expect(page.getByRole('button', { name: 'Medir' })).toBeEnabled()
})
