/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, gotoEditor, putWorlds } from './editor.ts'

// Distribuição do mapa, "Gerando" e sem WebGL2 (#51).

/** Abre o editor e espera o mapa final 1024² desenhado. */
async function openEditor(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await gotoEditor(page)
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
  await expect(footer.getByRole('status')).toHaveText('')
  await expect(page.getByTestId('map')).toHaveAttribute('data-blurred', 'false')
  expect(await barWidth(page)).toBeCloseTo(1, 2)
  // Oceano 45%: a água oceânica (oceano + água rasa) é 45% ± 2% das células (AC-F1-02), mais o
  // arredondamento das duas porcentagens.
  const before = await shares(page)
  expect(Math.abs(before['Oceano'] + (before['Água rasa'] ?? 0) - 45)).toBeLessThanOrEqual(3)
  await expect(page.getByTestId('distribution-legend')).toContainText(`Oceano ${before['Oceano']}%`)
  const footerHeight = async () => (await footer.boundingBox())!.height
  const heightBefore = await footerHeight()

  // Arrasta o slider Oceano e segura: a prévia chega, o mapa fica borrado e a barra diz "Gerando".
  const thumb = page.getByRole('slider', { name: 'Oceano' })
  const box = (await thumb.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 })
  await expect(footer.getByRole('status')).toHaveText('Gerando')
  await expect(page.getByTestId('map')).toHaveAttribute('data-blurred', 'true')
  // O desfoque é do terreno e da decoração, dentro do canvas (o que ficar acima deles fica nítido):
  // o elemento do mapa não tem filtro CSS.
  await expect(page.getByTestId('map')).toHaveAttribute('data-map-blur', '3.0')
  await expect(page.getByTestId('map')).toHaveCSS('filter', 'none')
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '256', { timeout: 30_000 })
  // Os valores novos (da prévia) já aparecem durante a geração.
  await expect.poll(async () => (await shares(page))['Oceano']).toBeGreaterThan(before['Oceano'])
  await expect(footer.getByRole('status')).toHaveText('Gerando')
  // A legenda reserva 4 linhas: o rodapé não muda de altura com os biomas da prévia.
  expect(await footerHeight()).toBe(heightBefore)

  // Ao soltar, o mapa final chega e fica nítido.
  await page.mouse.up()
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
  await expect(page.getByTestId('map')).toHaveAttribute('data-blurred', 'false')
  await expect(footer.getByRole('status')).toHaveText('')
  await expect(page.getByTestId('map')).toHaveAttribute('data-map-blur', '0.0')
  expect(await footerHeight()).toBe(heightBefore)
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
  await expect(footer.getByRole('status')).toHaveText('')
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
  await expect(footer.getByRole('status')).toHaveText('')
  await expect(bar).toBeInViewport({ ratio: 1 })
  const ocean = Number(await thumb.getAttribute('aria-valuenow'))
  const after = await shares(page)
  expect(Math.abs(after['Oceano'] + (after['Água rasa'] ?? 0) - ocean)).toBeLessThanOrEqual(3)
})

test('AC-F1-18 com movimento reduzido: o ícone de "Gerando" não gira e o desfoque não anima', async ({ page }) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openEditor(page)
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-map-blur', '0.0')
  const thumb = page.getByRole('slider', { name: 'Oceano' })
  const box = (await thumb.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 })
  const status = page.getByTestId('map-distribution').getByRole('status')
  await expect(status).toHaveText('Gerando')
  expect(await status.locator('svg').evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  // Sem animação, o desfoque salta direto para 3 px e, no mapa final, para 0.
  await expect(map).toHaveAttribute('data-map-blur', '3.0')
  await page.mouse.up()
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
  expect(await map.getAttribute('data-map-blur')).toBe('0.0')
})

for (const [label, width, height] of [
  ['tela larga 1440', 1440, 900],
  ['celular 390', 390, 844],
] as const) {
  test(`AC-F1-20, AC-F4-12 (${label}): sem WebGL2, a lista funciona e abrir um mundo mostra o aviso no lugar do editor`, async ({ page }) => {
    // Desliga o WebGL2 antes de o app carregar: o canvas não dá o contexto `webgl2`.
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type === 'webgl2') return null
        return (getContext as (...a: unknown[]) => unknown).call(this, type, ...args)
      } as typeof getContext
    })
    await page.setViewportSize({ width, height })
    // Sem WebGL2, a Lista de mundos funciona; abrir o mundo mostra o aviso, e o editor não abre.
    await page.goto('/')
    await putWorlds(page, [defaultWorld()])
    await page.reload()
    await expect(page.getByTestId('world-card')).toHaveCount(1)
    await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
    const notice = page.getByTestId('no-webgl2').locator('section')
    await expect(page.getByRole('heading', { name: 'Este navegador não tem WebGL2' })).toBeVisible()
    const browsers = page.getByRole('list', { name: 'Navegadores suportados' }).getByRole('listitem')
    await expect(browsers).toHaveText(['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox', 'Safari'])
    // O aviso cabe inteiro na tela, sem rolagem horizontal.
    await expect(notice).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.getByTestId('editor')).toHaveCount(0)
    await expect(page.getByRole('main', { name: 'Mapa' })).toHaveCount(0)
    // O aviso volta à lista.
    await page.getByRole('button', { name: 'Voltar à lista' }).click()
    await expect(page.getByTestId('world-card')).toHaveCount(1)
  })
}
