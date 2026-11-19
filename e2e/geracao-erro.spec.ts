/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { gotoEditor } from './editor.ts'

// Falha do worker de geração (#34, AC-F1-12): o editor gera o mapa ao abrir; se o script do worker
// não carregar, o pedido é rejeitado (em vez de ficar esperando) e aparece o toast de erro. Com o
// script de volta, "Tentar de novo" cria um worker novo e o toast some.
const WORKER = '**/generator.worker*'

test('o worker não carrega: aparece o toast de erro, e "Tentar de novo" gera o mapa (AC-F1-12)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route(WORKER, (route) => route.abort())
  await gotoEditor(page)

  const toast = page.getByRole('alert')
  await expect(toast).toHaveText(/Não foi possível gerar o mapa/)
  await expect(toast).toHaveCSS('background-color', 'rgb(179, 58, 46)')
  // À esquerda do drawer (400 px) com 12 px de folga (alinhado com o zoom), acima do controle de zoom (16 px da base,
  // 56 px de altura e 12 px de folga: 84 px).
  // (Espera a animação de entrada, que sobe o toast 8 px em 200 ms.)
  await expect
    .poll(async () => {
      const box = await toast.boundingBox()
      return box && [Math.round(box.x + box.width), Math.round(box.y + box.height)]
    })
    .toEqual([1440 - 400 - 12, 900 - 84])

  await page.unroute(WORKER)
  const loaded = page.waitForRequest(/generator\.worker/)
  await toast.getByRole('button', { name: 'Tentar de novo' }).click()
  await loaded
  await expect(toast).toBeHidden()
  // O mapa final termina sem falhar de novo.
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 20_000 })
  await expect(toast).toBeHidden()
})

test('celular 390×844: o toast ocupa a largura (16 px à esquerda; à direita, 12 px antes da toolbar em pé), acima do minimapa (sem cobri-lo), e "Tentar de novo" funciona (AC-F1-12)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(WORKER, (route) => route.abort())
  await gotoEditor(page)

  const toast = page.getByRole('alert')
  await expect(toast).toHaveText(/Não foi possível gerar o mapa/)
  // (Espera a animação de entrada, que sobe o toast 8 px em 200 ms.)
  await expect
    .poll(async () => {
      const box = await toast.boundingBox()
      return box && [Math.round(box.x), Math.round(box.x + box.width), Math.round(box.y + box.height)]
    })
    .toEqual([16, 390 - 80, 844 - 168])
  // A toolbar em pé fica à direita do toast, sem ser coberta por ele.
  const toolbar = await page.getByRole('toolbar', { name: 'Ferramentas' }).boundingBox()
  expect(Math.round(toolbar!.x)).toBe(390 - 12 - 56)
  // O minimapa aberto (140 px, 16 px da base) fica inteiro abaixo do toast, com 12 px de folga.
  const minimap = await page.getByTestId('minimap').boundingBox()
  expect(Math.round(minimap!.y)).toBe(844 - 16 - 140)
  // Com o minimapa recolhido, o toast desce para acima do controle de zoom.
  await page.getByRole('button', { name: 'Minimapa' }).click()
  await expect
    .poll(async () => {
      const b = await toast.boundingBox()
      return b && Math.round(b.y + b.height)
    })
    .toBe(844 - 84)

  await page.unroute(WORKER)
  const loaded = page.waitForRequest(/generator\.worker/)
  await toast.getByRole('button', { name: 'Tentar de novo' }).click()
  await loaded
  await expect(toast).toBeHidden()
})

test('celular estreito 320×640: o minimapa fica acima do zoom, e o toast acima dos dois (AC-F1-12)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.route(WORKER, (route) => route.abort())
  await gotoEditor(page)
  const toast = page.getByRole('alert')
  await expect(toast).toHaveText(/Não foi possível gerar o mapa/)
  const bottom = async (testId: string) => {
    const b = await page.getByTestId(testId).boundingBox()
    return { top: Math.round(b!.y), bottom: Math.round(b!.y + b!.height) }
  }
  // Minimapa empilhado 12 px acima do zoom; toast 12 px acima do minimapa.
  await expect.poll(async () => (await bottom('zoom-controls')).top - (await bottom('minimap')).bottom).toBe(12)
  await expect.poll(async () => (await bottom('minimap')).top - (await bottom('generation-error-toast')).bottom).toBe(12)
  // Recolhido, o toast desce para 12 px acima do cabeçalho do minimapa.
  await page.getByRole('button', { name: 'Minimapa' }).click()
  await expect.poll(async () => (await bottom('minimap')).top - (await bottom('generation-error-toast')).bottom).toBe(12)
})

// O toast nunca cobre o minimapa, o controle de zoom nem a toolbar (deitada ou em pé) e fica dentro da área livre (entre a
// sidebar e o drawer), em larguras de área livre dos dois lados dos limites de 568 e 360 px.
for (const { name, width, height, collapse, left } of [
  { name: '1440 com a sidebar aberta (720 px)', width: 1440, height: 900, collapse: false, left: 320 },
  { name: '1024 com a sidebar recolhida (576 px)', width: 1024, height: 768, collapse: true, left: 48 },
  { name: '820 com a sidebar recolhida (372 px)', width: 820, height: 1180, collapse: true, left: 48 },
  { name: '1024 com a sidebar aberta (304 px, minimapa empilhado)', width: 1024, height: 768, collapse: false, left: 320 },
]) {
  test(`${name}: o toast não cobre o minimapa, o zoom nem a toolbar (AC-F1-12)`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.route(WORKER, (route) => route.abort())
    await gotoEditor(page)
    await expect(page.getByRole('alert')).toHaveText(/Não foi possível gerar o mapa/)
    if (collapse) await page.getByRole('button', { name: 'Recolher painel' }).click()
    const rect = async (testId: string) => {
      const b = (await page.getByTestId(testId).boundingBox())!
      return { left: Math.round(b.x), right: Math.round(b.x + b.width), top: Math.round(b.y), bottom: Math.round(b.y + b.height) }
    }
    type R = Awaited<ReturnType<typeof rect>>
    const apart = (a: R, b: R) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
    // Espera a animação de entrada e a transição da sidebar.
    await expect
      .poll(async () => {
        const toast = await rect('generation-error-toast')
        return (
          apart(toast, await rect('minimap')) &&
          apart(toast, await rect('zoom-controls')) &&
          apart(toast, await rect('map-toolbar')) &&
          toast.left >= left &&
          toast.right <= width - 400
        )
      })
      .toBe(true)
  })
}

test('com o worker funcionando, o toast não aparece', async ({ page }) => {
  await gotoEditor(page)
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 20_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('no /bench.html, o worker que não carrega encerra a medição com erro, em vez de deixá-la em "running"', async ({ page }) => {
  await page.route(WORKER, (route) => route.abort())
  await page.goto('/bench.html?rapido')
  await page.getByRole('button', { name: 'Medir' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error')
  await expect(page.getByRole('button', { name: 'Medir' })).toBeEnabled()
})
