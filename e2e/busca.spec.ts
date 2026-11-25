/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, gotoEditor } from './editor.ts'

// Buscar pins (#163): Ctrl K abre a busca, o texto acha os pins por nome e por tag, e escolher um
// resultado (só com o teclado) seleciona o pin e leva a câmera até ele (AC-F3-16).

const TYPES = ['cidade', 'vila', 'castelo', 'masmorra', 'npc', 'poi'] as const

/** 50 pins numa grade; um em cada cinco tem a tag "porto", e o 23 é Valdora, a capital. */
function fiftyPins() {
  return Array.from({ length: 50 }, (_, i) => {
    const type = TYPES[i % TYPES.length]
    const name = i === 23 ? 'Valdora' : `Lugar ${String(i + 1).padStart(2, '0')}`
    const tags = [...(i % 5 === 0 ? ['porto'] : []), ...(i === 23 ? ['capital'] : [])]
    return {
      id: `p${i}`,
      type,
      name,
      pos: { u: 0.15 + (i % 10) * 0.08, v: 0.25 + Math.floor(i / 10) * 0.12 },
      icon: { kind: 'builtin', key: type },
      description: '',
      tags,
      fields: {},
    }
  })
}

const map = (page: Page) => page.getByTestId('map')
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Buscar pins' })
const input = (page: Page) => page.getByRole('combobox', { name: 'Buscar pins' })

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(map(page)).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

/** Distância, em px, entre o ponto (u, v) do mapa na tela e (cx, cy). */
async function distanceTo(page: Page, u: number, v: number, cx: number, cy: number) {
  const [x, y, width, height] = ((await map(page).getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return Math.round(Math.hypot(x + u * width - cx, y + v * height - cy))
}

test('Ctrl K, uma tag e Enter: o pin fica selecionado e a câmera vai até ele (AC-F3-16)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoEditor(page, '/', defaultWorld({ pins: fiftyPins() }))
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-zoom', '1.000')

  await page.keyboard.press('Control+k')
  await expect(dialog(page)).toBeVisible()
  await expect(input(page)).toBeFocused()

  // Pela tag: os 10 pins com "porto", em ordem alfabética.
  await input(page).fill('porto')
  const options = dialog(page).getByRole('option')
  await expect(options).toHaveCount(10)
  await expect(options.first()).toHaveText(/^Lugar 01/)
  await info.attach('busca-tag-1440.png', { body: await page.screenshot(), contentType: 'image/png' })

  // Pelo nome, sem acento nem maiúscula: Valdora, que também aparece pela tag "capital".
  await input(page).fill('VALD')
  await expect(options).toHaveText(['ValdoraPonto de interesse'])
  await input(page).fill('capi')
  await expect(options).toHaveText(['ValdoraPonto de interessecapital'])

  // Só o teclado: a seta desce até o sexto "porto" (Lugar 26, p25, perto do meio do mapa), e Enter o escolhe.
  await input(page).fill('porto')
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown')
  await expect(options.nth(5)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeHidden()
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p25')
  await expect(page.getByTestId('pin-drawer').getByRole('textbox', { name: 'Nome do pin' })).toHaveValue('Lugar 26')
  // Aproxima até 1,6× (como o Centralizar), com o pin no centro da área livre entre a sidebar e o drawer: (680, 450).
  await expect(map(page)).toHaveAttribute('data-zoom', '1.600')
  await expect.poll(() => distanceTo(page, 0.55, 0.49, 680, 450)).toBeLessThanOrEqual(1)
  // O foco volta ao Buscar da barra.
  await expect(page.getByRole('button', { name: 'Buscar' })).toBeFocused()
  await info.attach('busca-escolhido-1440.png', { body: await page.screenshot(), contentType: 'image/png' })

  // Esc fecha sem mudar nada.
  await page.keyboard.press('Control+k')
  await input(page).fill('valdora')
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p25')
})

test('tablet 1024: o Buscar da barra abre a busca, e o clique num resultado seleciona o pin (AC-F3-16)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1024, height: 768 })
  await gotoEditor(page, '/', defaultWorld({ pins: fiftyPins() }))
  await waitFinalMap(page)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await input(page).fill('lugar 4')
  await expect(dialog(page).getByRole('option')).toHaveCount(10)
  await info.attach('busca-1024.png', { body: await page.screenshot(), contentType: 'image/png' })
  await dialog(page).getByRole('option', { name: /^Lugar 45/ }).click()
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p44')
  await expect(map(page)).toHaveAttribute('data-zoom', '1.600')
})

test('celular 390: a busca cabe na tela, e escolher um pin abre a ficha dele no painel sobreposto (AC-F3-16, AC-F3-18)', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoEditor(page, '/', defaultWorld({ pins: fiftyPins() }))
  await waitFinalMap(page)
  await page.getByRole('button', { name: 'Buscar' }).click()
  const box = (await dialog(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(16)
  expect(box.x + box.width).toBeLessThanOrEqual(390 - 16)
  // 16 px: o iOS não aproxima a página ao focar o campo.
  await expect(input(page)).toHaveCSS('font-size', '16px')
  await input(page).fill('porto')
  await info.attach('busca-390.png', { body: await page.screenshot(), contentType: 'image/png' })
  await dialog(page).getByRole('option', { name: /^Lugar 06/ }).click()
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'p5')
  const panel = page.getByTestId('drawer')
  await expect(panel).toHaveAttribute('data-open', 'true')
  await expect(page.getByRole('button', { name: 'Fechar detalhes' })).toBeFocused()
  await info.attach('busca-escolhido-390.png', { body: await page.screenshot(), contentType: 'image/png' })
})
