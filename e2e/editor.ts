import type { Page } from '@playwright/test'

/**
 * Abre o editor como o usuário que cancela o assistente de novo mundo (#52): até a Lista de mundos
 * (M2), o app abre com o assistente sobre o mundo padrão, e os testes do editor seguem com ele.
 */
export async function gotoEditor(page: Page, url = '/') {
  await page.goto(url)
  await page.getByRole('dialog', { name: 'Novo mundo' }).getByRole('button', { name: 'Cancelar' }).click()
}

/** Print do retângulo do mapa (`data-map-rect`). */
export async function mapShot(page: Page) {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return page.screenshot({ clip: { x, y, width, height } })
}

/**
 * Espera o mapa parar de mudar e devolve o print dele: depois do mapa final, o desfoque some em
 * 260 ms, e um print no meio do caminho tem as cores borradas. Dois prints seguidos iguais.
 */
export async function stableMapShot(page: Page) {
  let last = await mapShot(page)
  for (;;) {
    await page.waitForTimeout(150)
    const next = await mapShot(page)
    if (next.equals(last)) return next
    last = next
  }
}
