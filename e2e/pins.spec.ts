/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, gotoEditor } from './editor.ts'

// Pins no mapa (#157): adicionar com P, desenhar por tipo e selecionar (AC-F3-01 a AC-F3-03).

const TYPES = ['cidade', 'vila', 'castelo', 'masmorra', 'npc', 'poi', 'custom'] as const

/** Um pin salvo, como o app o grava. */
function pin(id: string, type: string, name: string, u: number, v: number) {
  return { id, type, name, pos: { u, v }, icon: { kind: 'builtin', key: type }, description: '', tags: [], fields: {} }
}

/** O mundo padrão com um pin de cada tipo, numa linha no meio do mapa (em terra, na seed padrão). */
const sevenPins = () =>
  defaultWorld({
    pins: TYPES.map((t, i) => pin(`p-${t}`, t, `Pin ${i + 1}`, 0.35 + i * 0.05, 0.5)),
  })

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

/** O retângulo do mapa na tela (`data-map-rect`). */
async function mapRect(page: Page) {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return { x, y, width, height }
}

/** O ponto da tela da posição (u, v), pelo retângulo do mapa. */
async function screenOf(page: Page, u: number, v: number) {
  const r = await mapRect(page)
  return { x: r.x + u * r.width, y: r.y + v * r.height }
}

/** Clica no desenho do pin (10 px acima da âncora, na base). */
async function clickPin(page: Page, u: number, v: number) {
  const p = await screenOf(page, u, v)
  await page.mouse.click(p.x, p.y - 10)
}

const map = (page: Page) => page.getByTestId('map')
const nameField = (page: Page) => page.getByRole('textbox', { name: 'Nome do pin' })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('com P, clicar no mapa cria um "Novo pin" Cidade ali e abre o drawer com o nome em edição; recarregar mantém (AC-F3-01)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page)
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '0')

  await page.keyboard.press('p')
  await expect(page.getByRole('button', { name: 'Adicionar pin' })).toHaveAttribute('aria-pressed', 'true')
  await expect(map(page)).toHaveAttribute('data-tool', 'pin')
  const at = await screenOf(page, 0.5, 0.5)
  await page.mouse.click(at.x, at.y)

  await expect(map(page)).toHaveAttribute('data-pins', '1')
  await expect(nameField(page)).toBeFocused()
  await expect(nameField(page)).toHaveValue('Novo pin')
  expect(await nameField(page).evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 8])
  await expect(page.getByTestId('pin-drawer-type')).toHaveText('Cidade')
  // Depois de criar, a ferramenta volta para Navegar.
  await expect(map(page)).toHaveAttribute('data-tool', 'nav')

  await page.keyboard.type('Valdora')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-status', 'saved')
  const saved = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open('rpg-world')
        open.onsuccess = () => {
          const get = open.result.transaction('worlds').objectStore('worlds').get('mundo-padrao')
          get.onsuccess = () => resolve(get.result.pins)
        }
      }),
  )
  expect(saved).toEqual([expect.objectContaining({ type: 'cidade', name: 'Valdora' })])
  const [{ pos }] = saved as { pos: { u: number; v: number } }[]
  expect(pos.u).toBeCloseTo(0.5, 2)
  expect(pos.v).toBeCloseTo(0.5, 2)

  await page.reload()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '1')
  await clickPin(page, pos.u, pos.v)
  await expect(nameField(page)).toHaveValue('Valdora')
})

test('os 7 tipos têm 32 px na tela em qualquer zoom; o rótulo aparece a partir de 1,5×, no hover e na seleção (AC-F3-02)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', sevenPins())
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '7')
  await expect(map(page)).toHaveAttribute('data-pin-size', '32.0')
  await expect(map(page)).toHaveAttribute('data-pin-labels', '0')
  await info.attach('pins-zoom-1.png', { body: await page.screenshot(), contentType: 'image/png' })

  // Hover num pin: só ele ganha o rótulo.
  const p = await screenOf(page, 0.35, 0.5)
  await page.mouse.move(p.x, p.y - 10)
  await expect(map(page)).toHaveAttribute('data-pin-labels', '1')
  await page.mouse.move(p.x, p.y + 80)
  await expect(map(page)).toHaveAttribute('data-pin-labels', '0')

  // + duas vezes: 1,5625×, todos os rótulos à vista, e os pins seguem com 32 px.
  await page.keyboard.press('=')
  await page.keyboard.press('=')
  await expect(map(page)).toHaveAttribute('data-zoom', '1.563')
  await expect(map(page)).toHaveAttribute('data-pin-labels', '7')
  await expect(map(page)).toHaveAttribute('data-pin-size', '32.0')
  for (let i = 0; i < 6; i++) await page.keyboard.press('=')
  await expect(map(page)).toHaveAttribute('data-zoom', '4.000')
  await expect(map(page)).toHaveAttribute('data-pin-size', '32.0')
  await page.keyboard.press('0')
  await expect(map(page)).toHaveAttribute('data-zoom', '1.000')
  await expect(map(page)).toHaveAttribute('data-pin-labels', '0')

  // A seleção também mostra o rótulo.
  await clickPin(page, 0.35, 0.5)
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-cidade')
  await page.mouse.move(p.x, p.y + 80)
  await expect(map(page)).toHaveAttribute('data-pin-labels', '1')
})

test('clicar num pin o seleciona, abre o drawer e centraliza a câmera na área livre; Esc fecha (AC-F3-03)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', sevenPins())
  await waitFinalMap(page)
  // Zoom 2,44×: a câmera tem por onde andar.
  for (let i = 0; i < 4; i++) await page.keyboard.press('=')
  await expect(map(page)).toHaveAttribute('data-zoom', '2.441')

  // A Cidade fica à esquerda do centro do mapa: com o zoom, longe do centro da tela.
  const u = 0.35
  const before = await screenOf(page, u, 0.5)
  expect(before.x).toBeLessThan(560)
  await clickPin(page, u, 0.5)
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p-cidade')
  await expect(page.getByTestId('pin-drawer')).toBeVisible()
  await expect(nameField(page)).toHaveValue('Pin 1')
  await expect(page.getByTestId('pin-drawer-type')).toHaveText('Cidade')
  // O nome não fica em edição: só no pin novo.
  await expect(nameField(page)).not.toBeFocused()

  // A área livre fica entre a sidebar (320) e o drawer (400): o centro é (680, 450).
  await expect
    .poll(async () => {
      const s = await screenOf(page, u, 0.5)
      return Math.round(Math.hypot(s.x - 680, s.y - 450))
    })
    .toBeLessThanOrEqual(1)

  await page.keyboard.press('Escape')
  await expect(map(page)).toHaveAttribute('data-pin-selected', '')
  await expect(page.getByTestId('pin-drawer')).toHaveCount(0)
})

test('com movimento reduzido, o pin selecionado não pulsa (sem quique nem pulsação)', async ({ page }) => {
  test.setTimeout(90_000)
  await gotoEditor(page, '/', sevenPins())
  await waitFinalMap(page)
  const p = await screenOf(page, 0.35, 0.5)
  const clip = { x: p.x - 40, y: p.y - 50, width: 80, height: 70 }
  const differs = async () => {
    const a = await page.screenshot({ clip })
    await page.waitForTimeout(400)
    return !a.equals(await page.screenshot({ clip }))
  }
  await clickPin(page, 0.35, 0.5)
  await page.mouse.move(10, 450)
  await page.waitForTimeout(500)
  expect(await differs(), 'sem movimento reduzido, a pulsação anima').toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(100)
  expect(await differs(), 'com movimento reduzido, nada muda').toBe(false)

  // O pin novo aparece sem quique: já no lugar no primeiro quadro.
  await page.keyboard.press('Escape')
  await page.keyboard.press('p')
  const at = await screenOf(page, 0.5, 0.62)
  const near = { x: at.x - 40, y: at.y - 50, width: 80, height: 70 }
  await page.mouse.click(at.x, at.y)
  await page.mouse.move(10, 450)
  await expect(map(page)).toHaveAttribute('data-pins', '8')
  const first = await page.screenshot({ clip: near })
  await page.waitForTimeout(600)
  expect(first.equals(await page.screenshot({ clip: near })), 'o pin novo não quica').toBe(true)
})

test('celular 390: tocar num pin abre o drawer sobreposto, e fechá-lo tira a seleção', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoEditor(page, '/', sevenPins())
  await waitFinalMap(page)
  await clickPin(page, 0.35, 0.5)
  const drawer = page.getByTestId('drawer')
  await expect(drawer).toHaveAttribute('data-open', 'true')
  await expect(nameField(page)).toHaveValue('Pin 1')
  await page.getByRole('button', { name: 'Fechar detalhes' }).click()
  await expect(drawer).toHaveAttribute('data-open', 'false')
  await expect(map(page)).toHaveAttribute('data-pin-selected', '')
})
