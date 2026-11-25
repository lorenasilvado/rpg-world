/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { defaultWorld, gotoEditor } from './editor.ts'

// Aviso de pins sobre a água (#165): subir o Oceano deixa pins do litoral debaixo d'água, e o toast
// "N pins ficaram sobre a água" oferece Mostrar, que leva a câmera até o primeiro deles (AC-F1-30).

/** Uma grade de 64 pins pelo mapa todo: com o Oceano no máximo, os de terra perto da costa afundam. */
function gridPins() {
  return Array.from({ length: 64 }, (_, i) => ({
    id: `p${i}`,
    type: 'cidade',
    name: `Lugar ${i + 1}`,
    pos: { u: 0.1 + (i % 8) * 0.114, v: 0.1 + Math.floor(i / 8) * 0.114 },
    icon: { kind: 'builtin', key: 'cidade' },
    description: '',
    tags: [],
    fields: {},
  }))
}

test('AC-F1-30: subir o Oceano mostra o aviso dos pins sobre a água, e Mostrar centraliza no primeiro', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoEditor(page, '/', defaultWorld({ pins: gridPins() }))
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
  const toast = page.getByTestId('pins-on-water-toast')
  // O mapa de quando o mundo abre não é uma regeração: sem aviso, mesmo com pins no mar.
  await expect(toast).toHaveCount(0)
  await expect(map).toHaveAttribute('data-zoom', '1.000')

  // Oceano no máximo (End, com o foco no slider): o mapa final chega com mais água.
  const ocean = page.getByRole('slider', { name: 'Oceano' })
  await ocean.focus()
  await ocean.press('End')
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(toast).toHaveText(/^\d+ pins? fic(ou|aram) sobre a água\s*Mostrar$/, { timeout: 30_000 })

  // Pelo teclado: o botão some, e o foco vai para o mapa, não para o começo da página.
  await toast.getByRole('button', { name: 'Mostrar' }).focus()
  await page.keyboard.press('Enter')
  await expect(toast).toHaveCount(0)
  await expect(map).toHaveAttribute('data-zoom', '1.600')
  await expect(map).toBeFocused()
})

test('885×800 com a sidebar: o aviso ocupa a largura da área livre (16 px à esquerda, 12 à direita), acima da toolbar na segunda linha (AC-F1-30)', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 885, height: 800 })
  await gotoEditor(page, '/', defaultWorld({ pins: gridPins() }))
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle')
  const ocean = page.getByRole('slider', { name: 'Oceano' })
  await ocean.focus()
  await ocean.press('End')

  const toast = page.getByTestId('pins-on-water-toast')
  await expect(toast).toBeVisible({ timeout: 30_000 })
  // A área livre vai da sidebar (320) até a borda, 565 px, e o toast não cabe ao lado do zoom: fica de
  // 320 + 16 até 885 − 12, 12 px acima da toolbar, que está numa segunda linha acima do minimapa aberto,
  // no mesmo lugar do "Pin excluído" (espera a animação de entrada, que sobe o toast 8 px em 200 ms).
  await expect
    .poll(async () => {
      const box = await toast.boundingBox()
      return box && [Math.round(box.x), Math.round(box.x + box.width), Math.round(box.y + box.height)]
    })
    .toEqual([320 + 16, 885 - 12, 800 - 16 - 220])
  const toolbar = (await page.getByRole('toolbar', { name: 'Ferramentas' }).boundingBox())!
  const box = (await toast.boundingBox())!
  expect(Math.round(toolbar.y - (box.y + box.height))).toBe(12)
})
