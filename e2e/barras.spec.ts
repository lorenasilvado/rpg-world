/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { BAR_BOTTOM, BAR_GAP, TOOLBAR_LENGTH, TOOLBAR_THICKNESS, ZOOM_BAR_HEIGHT, ZOOM_SIDE } from '../src/features/map/bottomBarLayout.ts'
import { gotoEditor, gotoEditorWithDrawer } from './editor.ts'

// Barras do editor, Camadas e Ajuda (#54, AC-F2-10 a AC-F2-12). A barra de ações do topo e a
// toolbar de ferramentas, com as funções que ainda não existem desabilitadas; Camadas liga e desliga
// a decoração (o renderer expõe a camada em `data-decor-layer` e os ícones em `data-decor-drawn`);
// Ajuda (ou ?) abre o modal "Atalhos de teclado".

test.describe.configure({ timeout: 60_000 })

/** Abre o editor; com `drawer`, com um pin selecionado (o drawer de 400 px aberto, AC-F3-19). */
async function open(page: Page, width = 1440, height = 900, drawer = false) {
  await page.setViewportSize({ width, height })
  if (drawer) await gotoEditorWithDrawer(page)
  else await gotoEditor(page)
}

const box = async (page: Page, testId: string) => {
  const b = (await page.getByTestId(testId).boundingBox())!
  return { left: Math.round(b.x), right: Math.round(b.x + b.width), top: Math.round(b.y), bottom: Math.round(b.y + b.height) }
}

test('a barra superior e a toolbar: funções que ainda não existem desabilitadas (AC-F2-10)', async ({ page }) => {
  await open(page)
  const actions = page.getByTestId('actions')
  for (const name of ['Buscar', 'Desfazer', 'Refazer', 'Exportar']) await expect(actions.getByRole('button', { name })).toBeDisabled()
  await expect(actions.getByRole('button', { name: 'Usar tema escuro' })).toBeEnabled()
  await expect(actions.getByRole('button', { name: 'Ajuda' })).toBeEnabled()
  // Com espaço, Buscar mostra o rótulo e a tecla.
  await expect(page.getByTestId('search-button')).toHaveText('BuscarCtrl K')

  const toolbar = page.getByRole('toolbar', { name: 'Ferramentas' })
  await expect(toolbar.getByRole('button', { name: 'Navegar' })).toHaveAttribute('aria-pressed', 'true')
  await expect(toolbar.getByRole('button', { name: 'Navegar' })).toHaveCSS('background-color', 'rgb(200, 137, 43)')
  for (const name of ['Desenhar estrada', 'Rota automática']) {
    await expect(toolbar.getByRole('button', { name })).toBeDisabled()
    await expect(toolbar.getByRole('button', { name })).toHaveCSS('opacity', '0.55')
  }
  await expect(toolbar.getByRole('button', { name: 'Adicionar pin' })).toBeEnabled()
  await expect(toolbar.getByRole('button', { name: 'Camadas' })).toBeEnabled()
  await expect(toolbar.getByRole('button', { name: 'Medir distância' })).toBeEnabled()

  // Hover numa ferramenta (mesmo desabilitada) mostra o tooltip com o atalho.
  await toolbar.getByRole('button', { name: 'Adicionar pin' }).hover()
  await expect(page.getByRole('tooltip')).toHaveText('Adicionar pinP')
  await toolbar.getByRole('button', { name: 'Desenhar estrada' }).hover({ force: true })
  await expect(page.getByRole('tooltip')).toHaveText('Desenhar estradaR')
})

test('o foco do teclado numa ferramenta habilitada mostra o tooltip; o Tab pula as desabilitadas (AC-F2-10)', async ({ page }) => {
  await open(page)
  const toolbar = page.getByRole('toolbar', { name: 'Ferramentas' })
  await page.mouse.move(700, 300)
  await toolbar.getByRole('button', { name: 'Navegar' }).focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(toolbar.getByRole('button', { name: 'Navegar' })).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('NavegarV')
  // Do Navegar, o Tab vai para Adicionar pin e dele direto para Camadas (as duas desabilitadas não recebem foco).
  await page.keyboard.press('Tab')
  await expect(toolbar.getByRole('button', { name: 'Adicionar pin' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(toolbar.getByRole('button', { name: 'Camadas' })).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Camadas')
  await page.keyboard.press('Tab')
  await expect(toolbar.getByRole('button', { name: 'Medir distância' })).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Medir distânciaM')
  // Sem o foco, o tooltip some.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

for (const { name, width, height, left } of [
  { name: '1440 com a sidebar recolhida e o drawer (992 px)', width: 1440, height: 900, left: 48 },
  { name: '1280 com a sidebar recolhida e o drawer (832 px)', width: 1280, height: 800, left: 48 },
]) {
  test(`${name}: a toolbar fica deitada, centrada entre eles, 16 px da base, sem chegar ao zoom completo`, async ({ page }) => {
    await open(page, width, height, true)
    await page.getByRole('button', { name: 'Recolher painel' }).click()
    await expect(page.getByTestId('toolbar-slot')).toHaveAttribute('data-place', 'row')
    await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'false', { timeout: 45_000 })
    // Espera a transição da sidebar.
    const center = (left + width - 400) / 2
    await expect.poll(async () => {
      const t = await box(page, 'map-toolbar')
      return Math.abs((t.left + t.right) / 2 - center) <= 1
    }).toBe(true)
    const toolbar = await box(page, 'map-toolbar')
    expect(toolbar.right - toolbar.left).toBe(TOOLBAR_LENGTH)
    expect(toolbar.bottom - toolbar.top).toBe(TOOLBAR_THICKNESS)
    expect(height - toolbar.bottom).toBe(BAR_BOTTOM)
    const minimap = await box(page, 'minimap-slot')
    const zoom = await box(page, 'zoom-controls')
    expect(toolbar.left - minimap.right).toBeGreaterThanOrEqual(BAR_GAP)
    expect(zoom.left - toolbar.right).toBeGreaterThanOrEqual(BAR_GAP)
  })
}

test('1440 com a sidebar e o drawer (720 px): a toolbar fica deitada numa segunda linha, e o zoom mostra a escala e a porcentagem', async ({ page }) => {
  await open(page, 1440, 900, true)
  await expect(page.getByTestId('toolbar-slot')).toHaveAttribute('data-place', 'above')
  await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'false', { timeout: 45_000 })
  const toolbar = await box(page, 'map-toolbar')
  // Centrada na área livre (320 a 1040), 12 px acima do minimapa aberto.
  expect(Math.abs((toolbar.left + toolbar.right) / 2 - 680)).toBeLessThanOrEqual(1)
  expect((await box(page, 'minimap-slot')).top - toolbar.bottom).toBe(BAR_GAP)
  // O zoom completo, ao lado do minimapa, sem chegar a ele.
  const zoom = await box(page, 'zoom-controls')
  expect(zoom.left - (await box(page, 'minimap-slot')).right).toBeGreaterThanOrEqual(BAR_GAP)
  expect(1440 - 400 - zoom.right).toBe(ZOOM_SIDE)
})

test('1280 com a sidebar e sem pin (960 px): a toolbar fica deitada no centro da linha, e o zoom a 12 px da borda direita (AC-F3-19)', async ({ page }) => {
  await open(page, 1280, 800)
  await expect(page.getByTestId('toolbar-slot')).toHaveAttribute('data-place', 'row')
  await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'false', { timeout: 45_000 })
  const toolbar = await box(page, 'map-toolbar')
  // Centrada na área livre (320 a 1280), 16 px da base.
  expect(Math.abs((toolbar.left + toolbar.right) / 2 - 800)).toBeLessThanOrEqual(1)
  expect(800 - toolbar.bottom).toBe(BAR_BOTTOM)
  const zoom = await box(page, 'zoom-controls')
  expect(1280 - zoom.right).toBe(ZOOM_SIDE)
  expect(zoom.left - toolbar.right).toBeGreaterThanOrEqual(BAR_GAP)
  expect(toolbar.left - (await box(page, 'minimap-slot')).right).toBeGreaterThanOrEqual(BAR_GAP)
})

test('Camadas abre o popover, e o interruptor "Decoração" esconde e mostra os ícones (AC-F2-11)', async ({ page }) => {
  await open(page)
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
  await expect(map).toHaveAttribute('data-decor-layer', 'on')
  await expect.poll(async () => Number(await map.getAttribute('data-decor-drawn'))).toBeGreaterThan(0)

  const layers = page.getByRole('button', { name: 'Camadas' })
  await layers.click()
  await expect(layers).toHaveAttribute('aria-expanded', 'true')
  const popover = page.getByRole('group', { name: 'Camadas' })
  await expect(popover).toBeVisible()
  const decor = popover.getByRole('switch', { name: 'Decoração' })
  await expect(decor).toHaveAttribute('aria-checked', 'true')

  await decor.click()
  await expect(decor).toHaveAttribute('aria-checked', 'false')
  await expect(map).toHaveAttribute('data-decor-layer', 'off')
  await expect(map).toHaveAttribute('data-decor-drawn', '0')

  await decor.click()
  await expect(map).toHaveAttribute('data-decor-layer', 'on')
  await expect.poll(async () => Number(await map.getAttribute('data-decor-drawn'))).toBeGreaterThan(0)

  // Esc fecha e devolve o foco a Camadas; um clique no mapa também fecha.
  await page.keyboard.press('Escape')
  await expect(popover).toBeHidden()
  await expect(layers).toBeFocused()
  await layers.click()
  await expect(popover).toBeVisible()
  await page.mouse.click(700, 300)
  await expect(popover).toBeHidden()
})

test('Ajuda abre o modal "Atalhos de teclado"; Esc fecha e devolve o foco; ? também abre (AC-F2-12)', async ({ page }) => {
  await open(page)
  const help = page.getByRole('button', { name: 'Ajuda' })
  await help.click()
  const dialog = page.getByRole('dialog', { name: 'Atalhos de teclado' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('dt')).toHaveText(['Navegar', 'Adicionar pin', 'Medir distância', 'Mover o mapa', 'Zoom', 'Centralizar mapa', 'Excluir pin', 'Desfazer', 'Refazer', 'Recolher painel', 'Cancelar / fechar', 'Atalhos'])
  // Duas colunas a partir de 640 px: "Adicionar pin" fica ao lado de "Navegar", na mesma linha.
  const first = (await dialog.locator('dt').nth(0).boundingBox())!
  const second = (await dialog.locator('dt').nth(1).boundingBox())!
  expect(Math.round(second.y)).toBe(Math.round(first.y))
  expect(second.x).toBeGreaterThan(first.x + first.width)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(help).toBeFocused()

  await page.mouse.click(700, 300)
  await page.keyboard.press('?')
  await expect(dialog).toBeVisible()
  // Com o modal aberto, as teclas não mexem na câmera.
  const rect = await page.getByTestId('map').getAttribute('data-map-rect')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(450)
  expect(await page.getByTestId('map').getAttribute('data-map-rect')).toBe(rect)
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(dialog).toBeHidden()
})

test('tablet 1024 com a sidebar aberta e o drawer (304 px): a toolbar fica em pé acima do zoom, e a barra superior não chega à sidebar', async ({ page }) => {
  await open(page, 1024, 768, true)
  await expect(page.getByTestId('toolbar-slot')).toHaveAttribute('data-place', 'vertical')
  const toolbar = await box(page, 'map-toolbar')
  const zoom = await box(page, 'zoom-controls')
  expect(toolbar.right - toolbar.left).toBe(TOOLBAR_THICKNESS)
  expect(toolbar.bottom - toolbar.top).toBe(TOOLBAR_LENGTH)
  expect(toolbar.right).toBe(zoom.right)
  expect(1024 - 400 - toolbar.right).toBe(ZOOM_SIDE)
  expect(zoom.top - toolbar.bottom).toBe(BAR_GAP)
  expect(768 - zoom.bottom).toBe(BAR_BOTTOM)
  expect(zoom.bottom - zoom.top).toBe(ZOOM_BAR_HEIGHT)
  // O minimapa (empilhado acima do zoom, à esquerda) não fica sob a toolbar.
  expect((await box(page, 'minimap-slot')).right).toBeLessThanOrEqual(toolbar.left)

  // Sem espaço, Buscar fica só com o ícone, e a barra cabe entre a sidebar e o drawer.
  await expect(page.getByTestId('search-button')).toHaveAttribute('data-label', 'false')
  const actions = await box(page, 'actions')
  expect(actions.left).toBeGreaterThanOrEqual(320)

  // O popover de Camadas abre acima da toolbar em pé, alinhado à direita dela, dentro da área livre.
  await page.getByRole('button', { name: 'Camadas' }).click()
  const popover = await box(page, 'layers-popover')
  expect(popover.bottom).toBeLessThanOrEqual(toolbar.top)
  expect(popover.right).toBe(toolbar.right)
  expect(popover.left).toBeGreaterThanOrEqual(320)
})

test('1280 com a sidebar e o drawer (560 px): a toolbar fica deitada numa segunda linha, acima do minimapa', async ({ page }) => {
  await open(page, 1280, 800, true)
  await expect(page.getByTestId('toolbar-slot')).toHaveAttribute('data-place', 'above')
  // O zoom completo cabe ao lado do minimapa (#137).
  await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'false', { timeout: 45_000 })
  const toolbar = await box(page, 'map-toolbar')
  expect(toolbar.right - toolbar.left).toBe(TOOLBAR_LENGTH)
  // Centrada na área livre (320 a 880).
  expect(Math.abs((toolbar.left + toolbar.right) / 2 - 600)).toBeLessThanOrEqual(1)
  const minimap = await box(page, 'minimap-slot')
  expect(minimap.top - toolbar.bottom).toBe(BAR_GAP)
  // Recolher o minimapa: a toolbar desce para 12 px acima do zoom.
  await page.getByRole('button', { name: 'Minimapa' }).click()
  await expect.poll(async () => (await box(page, 'zoom-controls')).top - (await box(page, 'map-toolbar')).bottom).toBe(BAR_GAP)
  // O popover de Camadas abre acima dela, dentro da área livre.
  await page.getByRole('button', { name: 'Camadas' }).click()
  const popover = await box(page, 'layers-popover')
  expect(popover.left).toBeGreaterThanOrEqual(320)
  expect(popover.right).toBeLessThanOrEqual(880)
})

test('celular 390: a barra superior cabe na tela, e a toolbar fica deitada numa segunda linha', async ({ page }) => {
  await open(page, 390, 844)
  const actions = await box(page, 'actions')
  expect(actions.left).toBeGreaterThanOrEqual(12)
  expect(actions.right).toBe(390 - 12)
  await expect(page.getByTestId('search-button')).toHaveAttribute('data-label', 'false')
  await expect(page.getByTestId('toolbar-slot')).toHaveAttribute('data-place', 'above')
  const toolbar = await box(page, 'map-toolbar')
  expect(Math.abs((toolbar.left + toolbar.right) / 2 - 195)).toBeLessThanOrEqual(1)
  expect((await box(page, 'minimap-slot')).top - toolbar.bottom).toBe(BAR_GAP)

  await page.getByRole('button', { name: 'Ajuda' }).click()
  const dialog = await page.getByRole('dialog', { name: 'Atalhos de teclado' }).boundingBox()
  expect(dialog!.x).toBeGreaterThanOrEqual(16)
  expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(390 - 16)
  // Uma coluna abaixo de 640 px: "Adicionar pin" fica abaixo de "Navegar", alinhado à esquerda.
  const rows = page.getByRole('dialog', { name: 'Atalhos de teclado' }).locator('dt')
  const first = (await rows.nth(0).boundingBox())!
  const second = (await rows.nth(1).boundingBox())!
  expect(second.y).toBeGreaterThan(first.y + first.height)
  expect(Math.round(second.x)).toBe(Math.round(first.x))
})
