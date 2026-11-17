/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

// Distribuição do mapa, "Gerando" e sem WebGL2 (#51).

/** Abre o editor e espera o mapa final 1024² desenhado. */
async function openEditor(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
}

/** Porcentagens da barra, pelo rótulo dela ("Distribuição do mapa: Oceano 38%, …"). */
async function shares(page: Page) {
  const label = (await page.getByRole('img', { name: /^Distribuição do mapa:/ }).getAttribute('aria-label')) ?? ''
  return Object.fromEntries(
    label
      .replace('Distribuição do mapa: ', '')
      .split(', ')
      .map((part) => {
        // "<1%": o bioma existe, mas arredonda para 0%.
        const m = /^(.*) <?(\d+)%$/.exec(part)!
        return [m[1], Number(m[2])]
      }),
  ) as Record<string, number>
}

/** Soma das larguras dos segmentos da barra, em % da barra. */
function barWidth(page: Page) {
  return page.getByTestId('map-distribution').evaluate((el) => {
    const bar = el.querySelector('[role="img"]')!
    const total = bar.getBoundingClientRect().width
    return [...bar.children].reduce((sum, seg) => sum + seg.getBoundingClientRect().width, 0) / total
  })
}

test('AC-F1-18: a barra mostra a porcentagem real de cada bioma, e "Gerando" com o mapa borrado', async ({ page }) => {
  test.setTimeout(90_000)
  await openEditor(page)
  const footer = page.getByTestId('map-distribution')
  await expect(footer.getByRole('status')).toHaveCount(0)
  await expect(page.getByTestId('map')).toHaveAttribute('data-blurred', 'false')
  expect(await barWidth(page)).toBeCloseTo(1, 2)
  // Oceano 45%: a água oceânica (oceano + água rasa) é 45% ± 2% das células (AC-F1-02), mais o
  // arredondamento das duas porcentagens.
  const before = await shares(page)
  expect(Math.abs(before['Oceano'] + (before['Água rasa'] ?? 0) - 45)).toBeLessThanOrEqual(3)
  await expect(page.getByTestId('distribution-legend')).toContainText(`Oceano ${before['Oceano']}%`)

  // Arrasta o slider Oceano e segura: a prévia chega, o mapa fica borrado e a barra diz "Gerando".
  const thumb = page.getByRole('slider', { name: 'Oceano' })
  const box = (await thumb.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 })
  await expect(footer.getByRole('status')).toHaveText('Gerando')
  await expect(page.getByTestId('map')).toHaveAttribute('data-blurred', 'true')
  await expect(page.getByTestId('map')).toHaveCSS('filter', /blur\(3px\)/)
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '256', { timeout: 30_000 })
  // Os valores novos (da prévia) já aparecem durante a geração.
  await expect.poll(async () => (await shares(page))['Oceano']).toBeGreaterThan(before['Oceano'])
  await expect(footer.getByRole('status')).toHaveText('Gerando')

  // Ao soltar, o mapa final chega e fica nítido.
  await page.mouse.up()
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
  await expect(page.getByTestId('map')).toHaveAttribute('data-blurred', 'false')
  await expect(footer.getByRole('status')).toHaveCount(0)
  await expect(page.getByTestId('map')).toHaveCSS('filter', 'none')
  const ocean = Number(await thumb.getAttribute('aria-valuenow'))
  const after = await shares(page)
  expect(Math.abs(after['Oceano'] + (after['Água rasa'] ?? 0) - ocean)).toBeLessThanOrEqual(3)
})

test('AC-F1-18 no celular 390: no painel sobreposto, a barra cabe na tela e mostra "Gerando" durante a geração', async ({ page }) => {
  test.setTimeout(90_000)
  await openEditor(page, 390, 844)
  await page.getByRole('button', { name: 'Abrir painel' }).click()
  const footer = page.getByTestId('map-distribution')
  const bar = page.getByRole('img', { name: /^Distribuição do mapa:/ })
  await expect(bar).toBeInViewport({ ratio: 1 })
  const box = (await bar.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByTestId('distribution-legend')).toBeInViewport()
  const before = await shares(page)
  expect(Math.abs(before['Oceano'] + (before['Água rasa'] ?? 0) - 45)).toBeLessThanOrEqual(3)
  await expect(footer.getByRole('status')).toHaveCount(0)
  await expect(page.getByTestId('map')).toHaveAttribute('data-blurred', 'false')

  // Arrasta o slider Oceano no painel e segura: a prévia chega, borrada, e a barra diz "Gerando".
  const thumb = page.getByRole('slider', { name: 'Oceano' })
  const t = (await thumb.boundingBox())!
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2)
  await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2 + 60, t.y + t.height / 2, { steps: 6 })
  await expect(footer.getByRole('status')).toHaveText('Gerando')
  await expect(page.getByTestId('map')).toHaveAttribute('data-blurred', 'true')
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '256', { timeout: 30_000 })
  await expect.poll(async () => (await shares(page))['Oceano']).toBeGreaterThan(before['Oceano'])
  await expect(footer.getByRole('status')).toHaveText('Gerando')

  // Ao soltar, o mapa final chega: some o "Gerando" e o mapa fica nítido.
  await page.mouse.up()
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
  await expect(page.getByTestId('map')).toHaveAttribute('data-blurred', 'false')
  await expect(footer.getByRole('status')).toHaveCount(0)
  await expect(bar).toBeInViewport({ ratio: 1 })
  const ocean = Number(await thumb.getAttribute('aria-valuenow'))
  const after = await shares(page)
  expect(Math.abs(after['Oceano'] + (after['Água rasa'] ?? 0) - ocean)).toBeLessThanOrEqual(3)
})

test('AC-F1-20: sem WebGL2, um aviso com os navegadores suportados aparece no lugar do editor', async ({ page }) => {
  // Desliga o WebGL2 antes de o app carregar: o canvas não dá o contexto `webgl2`.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return (getContext as (...a: unknown[]) => unknown).call(this, type, ...args)
    } as typeof getContext
  })
  const workers: string[] = []
  page.on('worker', (w) => workers.push(w.url()))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Este navegador não tem WebGL2' })).toBeVisible()
  const browsers = page.getByRole('list', { name: 'Navegadores suportados' }).getByRole('listitem')
  await expect(browsers).toHaveText(['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox', 'Safari'])
  await expect(page.getByTestId('editor')).toHaveCount(0)
  await expect(page.getByRole('main', { name: 'Mapa' })).toHaveCount(0)
  // Nada é gerado: o worker de geração nem é criado.
  expect(workers).toEqual([])
})
