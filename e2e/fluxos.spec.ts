/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { mapShot, stableMapShot } from './editor.ts'

// Fluxos principais do M1, de ponta a ponta (#55; critério de saída de docs/milestones/m1.md): criar
// um mundo pelo assistente, mexer nos 9 sliders só com o teclado, aplicar um preset e navegar no
// mapa. Cada parte tem o seu E2E detalhado (assistente, sidebar, seed-presets e camera); aqui elas
// rodam em sequência, no mesmo mundo, no Chrome (projeto app), no Firefox e no WebKit.

// No Firefox e no WebKit do Playwright, sem GPU, cada mapa final leva alguns segundos.
test.describe.configure({ timeout: 240_000 })

const SLIDERS = [
  'Oceano',
  'Praias',
  'Desertos',
  'Florestas',
  'Montanhas',
  'Neve',
  'Tamanho do continente',
  'Rugosidade da costa',
  'Temperatura global',
]

const FROZEN: Record<string, number> = {
  Oceano: 48,
  Praias: 12,
  Desertos: 4,
  Florestas: 42,
  Montanhas: 52,
  Neve: 85,
  'Tamanho do continente': 58,
  'Rugosidade da costa': 62,
  'Temperatura global': 15,
}

const ARID: Record<string, number> = {
  Oceano: 32,
  Praias: 25,
  Desertos: 62,
  Florestas: 10,
  Montanhas: 34,
  Neve: 12,
  'Tamanho do continente': 74,
  'Rugosidade da costa': 45,
  'Temperatura global': 85,
}

const map = (page: Page) => page.getByTestId('map')

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 60_000 })
  await expect(map(page)).toHaveAttribute('data-terrain-size', '1024', { timeout: 60_000 })
}

async function expectSliders(page: Page, values: Record<string, number>) {
  for (const [name, value] of Object.entries(values)) {
    await expect(page.getByRole('slider', { name, includeHidden: true }), name).toHaveAttribute('aria-valuenow', String(value))
  }
}

/** Espera a câmera parar: o retângulo do mapa igual por 400 ms (mais que o deslizamento de 350 ms). */
async function settledRect(page: Page) {
  let last = ''
  let since = 0
  await expect
    .poll(async () => {
      const now = (await map(page).getAttribute('data-map-rect')) ?? ''
      if (now !== last) {
        last = now
        since = Date.now()
      }
      return Date.now() - since >= 400
    }, { intervals: [100], timeout: 30_000 })
    .toBe(true)
  return last
}

/** O rótulo do slider com o foco, ou null se o foco não está num dos 9 sliders. */
async function focusedSlider(page: Page) {
  for (const name of SLIDERS) {
    const focused = await page.getByRole('slider', { name, exact: true, includeHidden: true }).evaluate((el) => el === document.activeElement)
    if (focused) return name
  }
  return null
}

const zoom = async (page: Page) => Number(await map(page).getAttribute('data-zoom'))

test('cria um mundo, mexe nos sliders só com o teclado, aplica um preset e navega (critério de saída do M1)', async ({ page, browserName }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  // 1. Criar um mundo pelo assistente, a partir da Lista de mundos vazia (AC-F1-19, AC-F4-05, AC-F4-06).
  const wizard = page.getByRole('dialog', { name: 'Novo mundo' })
  await page.getByRole('button', { name: 'Criar meu primeiro mundo' }).click()
  await expect(wizard.getByRole('textbox', { name: 'Nome do mundo' })).toBeFocused()
  await wizard.getByRole('textbox', { name: 'Nome do mundo' }).fill('Picos de Gelo')
  await wizard.getByRole('button', { name: /Terras geladas/ }).click()
  await wizard.getByRole('textbox', { name: /^Seed/ }).fill('gelo-55')
  await wizard.getByRole('button', { name: 'Criar mundo' }).click()
  await expect(wizard).toBeHidden()

  // Sem WebGL2, o mundo abre com o aviso no lugar do editor (AC-F1-20, AC-F4-12) e o fluxo não tem
  // como rodar. O Firefox do CI (Linux, sem GPU) pode não oferecer WebGL2: nele, o teste é pulado
  // com o motivo. No Chrome, que sempre tem WebGL2 (por software no CI), o aviso é falha.
  const notice = page.getByTestId('no-webgl2')
  await expect(page.getByTestId('editor').or(notice), 'nem o editor nem o aviso sem WebGL2 apareceram').toBeVisible({ timeout: 30_000 })
  const webgl2 = !(await notice.isVisible())
  const agent = await page.evaluate(() => navigator.userAgent)
  console.log(`[fluxos] ${browserName}: WebGL2 ${webgl2 ? 'sim' : 'não'} · ${agent}`)
  if (!webgl2) {
    test.info().annotations.push({ type: 'sem WebGL2', description: agent })
    expect(browserName, 'o Chrome sempre tem WebGL2: o aviso aqui é um erro').not.toBe('chromium')
    test.skip(true, `${browserName} sem WebGL2 nesta máquina: o fluxo do editor não roda (AC-F1-20)`)
  }

  await expect(page.getByTestId('world-name')).toHaveText('Picos de Gelo')
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('gelo-55')
  await expectSliders(page, FROZEN)
  await waitFinalMap(page)
  const created = await stableMapShot(page)

  // 2. Os 9 sliders só com o teclado (AC-F1-13, AC-F1-05): Tab percorre a sidebar, Enter abre as
  // seções fechadas, e a seta muda cada slider em 1 ponto e gera o mapa final de novo.
  await page.getByRole('button', { name: 'Recolher painel' }).focus()
  const visited: string[] = []
  for (let tabs = 0; visited.length < SLIDERS.length && tabs < 80; tabs++) {
    await page.keyboard.press('Tab')
    // Lido na hora, sem esperar: se o foco sai da página, o laço para, e a lista abaixo diz quais
    // sliders o Tab alcançou.
    const active = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      return { role: el.getAttribute('role'), expanded: el.getAttribute('aria-expanded'), controls: el.getAttribute('aria-controls') }
    })
    if (!active) break
    const focused = page.locator(':focus')
    if (active.role === 'slider') {
      const name = await focusedSlider(page)
      expect(name, 'slider sem rótulo').not.toBeNull()
      const value = Number(await focused.getAttribute('aria-valuenow'))
      const max = Number(await focused.getAttribute('aria-valuemax'))
      await page.keyboard.press(value < max ? 'ArrowRight' : 'ArrowLeft')
      await expect(focused).toHaveAttribute('aria-valuenow', String(value < max ? value + 1 : value - 1))
      await waitFinalMap(page)
      visited.push(name!)
      continue
    }
    if (active.expanded === 'false' && active.controls) {
      await page.keyboard.press('Enter')
      await expect(focused).toHaveAttribute('aria-expanded', 'true')
    }
  }
  // Cada slider foi alcançado pelo Tab, na ordem, e mudou, com rótulo, sem o mouse.
  expect(visited, 'sliders alcançados só com o teclado').toEqual(SLIDERS)
  for (const name of SLIDERS) {
    const slider = page.getByRole('slider', { name })
    const value = Number(await slider.getAttribute('aria-valuenow'))
    expect(Math.abs(value - FROZEN[name]), name).toBe(1)
  }
  // A câmera não se mexeu com as setas nos sliders.
  await expect(map(page)).toHaveAttribute('data-zoom', '1.000')
  await expect.poll(async () => (await mapShot(page)).equals(created)).toBe(false)
  const tweaked = await stableMapShot(page)

  // 3. Aplicar um preset pela sidebar (AC-F1-16).
  const presetsHeader = page.getByRole('button', { name: 'Presets' })
  if ((await presetsHeader.getAttribute('aria-expanded')) === 'false') await presetsHeader.click()
  const presets = page.getByRole('group', { name: 'Presets' })
  await presets.getByRole('button', { name: /Deserto árido/ }).click()
  await expect(presets.getByRole('button', { name: /Deserto árido/ })).toHaveAttribute('aria-pressed', 'true')
  await expectSliders(page, ARID)
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('gelo-55')
  await waitFinalMap(page)
  await expect.poll(async () => (await mapShot(page)).equals(tweaked)).toBe(false)

  // 4. Navegar (AC-F2-01 a AC-F2-04): arrastar faz pan, a roda e a pinça do touchpad (Ctrl+roda)
  // fazem zoom, e 0 centraliza o mapa inteiro de novo.
  const fit = await settledRect(page)
  const center = { x: 320 + 360, y: 450 }
  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -300)
  await settledRect(page)
  const wheeled = await zoom(page)
  expect(wheeled).toBeGreaterThan(1)

  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -40)
  await page.keyboard.up('Control')
  await settledRect(page)
  expect(await zoom(page)).toBeGreaterThan(wheeled)

  const zoomed = await settledRect(page)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x - 160, center.y - 80, { steps: 8 })
  await page.mouse.up()
  expect(await settledRect(page)).not.toBe(zoomed)

  // O foco ficou no cartão do preset; fora dele, o 0 vai para a câmera.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('0')
  await expect.poll(() => zoom(page), { timeout: 30_000 }).toBe(1)
  expect(await settledRect(page)).toBe(fit)

  expect(errors).toEqual([])
})
