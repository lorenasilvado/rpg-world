/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  MINIMAP_CARD_COLLAPSED_HEIGHT,
  MINIMAP_CARD_COLLAPSED_HEIGHT_TOUCH,
  MINIMAP_CARD_HEIGHT_TOUCH,
  MINIMAP_HEADER_HEIGHT_TOUCH,
  MINIMAP_CARD_HEIGHT,
  MINIMAP_CARD_WIDTH,
  TOAST_WIDTH,
  ZOOM_BAR_HEIGHT,
  ZOOM_COMPACT_MAX_WIDTH,
} from '../src/features/map/bottomBarLayout.ts'
import { gotoEditor } from './editor.ts'

// Minimapa, escala e controles de zoom (#53, AC-F2-08 e AC-F2-09). O renderer expõe no mapa o
// retângulo dele na tela (`data-map-rect`) e o zoom relativo (`data-zoom`); o minimapa expõe em
// `data-drawn` o tamanho do campo que desenhou.

test.describe.configure({ timeout: 60_000 })

type Rect = { x: number; y: number; width: number; height: number }

async function open(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await gotoEditor(page)
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
  await expect(map).toHaveAttribute('data-map-rect', /.+/)
}

async function mapRect(page: Page): Promise<Rect> {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return { x, y, width, height }
}

const zoom = async (page: Page) => Number(await page.getByTestId('map').getAttribute('data-zoom'))

/** Espera a câmera parar: o retângulo do mapa igual por 400 ms (mais que os 350 ms do deslizamento). */
async function settled(page: Page): Promise<Rect> {
  let last = ''
  let since = 0
  await expect
    .poll(async () => {
      const now = (await page.getByTestId('map').getAttribute('data-map-rect')) ?? ''
      if (now !== last) {
        last = now
        since = Date.now()
      }
      return Date.now() - since >= 400
    }, { intervals: [100], timeout: 15_000 })
    .toBe(true)
  return mapRect(page)
}

/**
 * Espera o zoom chegar a `expected` e a câmera parar. Logo depois do mapa final, a thread principal
 * fica ocupada (textura, decoração, minimapa) e o primeiro quadro do deslizamento pode demorar mais
 * que os 400 ms do `settled`: sem esperar o zoom, ele pode terminar antes de a câmera sair do lugar.
 */
async function zoomed(page: Page, expected: number): Promise<Rect> {
  await expect.poll(() => zoom(page), { intervals: [100], timeout: 15_000 }).toBeCloseTo(expected, 2)
  return settled(page)
}

async function box(locator: Locator): Promise<Rect> {
  const b = await locator.boundingBox()
  if (!b) throw new Error('elemento sem caixa')
  return b
}

/** O elemento no centro de `locator` é ele mesmo (ou está dentro dele): nada o cobre. */
async function onTop(locator: Locator) {
  const b = await box(locator)
  return locator.evaluate((el, [x, y]) => {
    const hit = document.elementFromPoint(x, y)
    return !!hit && (hit === el || el.contains(hit))
  }, [b.x + b.width / 2, b.y + b.height / 2])
}

test('AC-F2-08: o minimapa mostra o mapa, e o retângulo acompanha a câmera', async ({ page }) => {
  await open(page)
  const minimap = page.getByTestId('minimap-surface')
  await expect(minimap).toHaveAttribute('data-drawn', '1024')
  // 160 × 100, no canto inferior esquerdo da área livre, 16 px da base.
  const mm = await box(minimap)
  expect(mm.width).toBe(160)
  expect(mm.height).toBe(100)
  const card = await box(page.getByTestId('minimap'))
  expect(card.x).toBe(320 + 16)
  expect(Math.round(900 - (card.y + card.height))).toBe(16)
  // O minimapa tem o terreno desenhado (não é só o fundo do oceano).
  const colors = await minimap.locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    const set = new Set<string>()
    for (let i = 0; i < d.length; i += 4 * 97) set.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`)
    return set.size
  })
  expect(colors).toBeGreaterThan(5)

  // No zoom 1×, o mapa inteiro está à vista: o retângulo cobre o mapa do minimapa (100 × 100).
  const view = page.getByTestId('minimap-view')
  await settled(page)
  let r = await box(view)
  expect(Math.round(r.width)).toBe(100)
  expect(Math.round(r.height)).toBe(100)

  // Aproximando, o retângulo encolhe.
  await page.getByRole('button', { name: 'Aproximar' }).click()
  await page.getByRole('button', { name: 'Aproximar' }).click()
  await zoomed(page, 1.5625)
  r = await box(view)
  // Área livre 720 × 900 no zoom 1,5625: 720 px mostram 1024 / 1,5625 = 655 unidades → 64 px.
  expect(r.width).toBeCloseTo(64, 0)
  expect(r.height).toBeCloseTo(80, 0)
})

test('AC-F2-08: arrastar o retângulo move a área visível', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Aproximar' }).click()
  await page.getByRole('button', { name: 'Aproximar' }).click()
  const before = await zoomed(page, 1.5625)
  const view = page.getByTestId('minimap-view')
  const r = await box(view)
  const from = { x: r.x + r.width / 2 + 5, y: r.y + r.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 5, from.y + 4, { steps: 3 })
  await page.mouse.move(from.x + 10, from.y + 8, { steps: 3 })
  await page.mouse.up()
  const after = await settled(page)
  // 10 px no minimapa são 102,4 unidades do mundo; o mapa anda o mesmo na tela, na escala dele.
  const scale = before.width / 1024
  expect(after.x - before.x).toBeCloseTo(-102.4 * scale, -1)
  expect(after.y - before.y).toBeCloseTo(-81.92 * scale, -1)
  expect(after.width).toBe(before.width)
  // O retângulo foi junto com o arrasto.
  const moved = await box(view)
  expect(moved.x - r.x).toBeCloseTo(10, 0)
  expect(moved.y - r.y).toBeCloseTo(8, 0)
})

test('AC-F2-08: tocar fora do retângulo centra a câmera ali', async ({ page }) => {
  await open(page)
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Aproximar' }).click()
  await zoomed(page, 1.25 ** 4)
  const mm = await box(page.getByTestId('minimap-surface'))
  // O canto noroeste do mapa no minimapa (x 30..130): o mapa encosta no canto da área livre.
  await page.mouse.click(mm.x + 32, mm.y + 2)
  const after = await settled(page)
  expect(after.x).toBe(320)
  expect(after.y).toBe(0)
})

test('AC-F2-08: o minimapa recolhe e abre', async ({ page }) => {
  await open(page)
  const toggle = page.getByRole('button', { name: 'Minimapa' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('minimap-surface')).toBeHidden()
  // Recolhido, fica só o cabeçalho, ainda na base.
  const card = await box(page.getByTestId('minimap'))
  expect(card.height).toBeLessThan(40)
  expect(Math.round(900 - (card.y + card.height))).toBe(16)
  await toggle.click()
  await expect(page.getByTestId('minimap-surface')).toBeVisible()
})

test('AC-F2-09: com área livre de 450 px ou mais, mostra a escala e a porcentagem; os botões fazem zoom e centralizam', async ({ page }) => {
  await open(page)
  // Sidebar recolhida: 1440 − 48 − 400 = 992 px de área livre.
  await page.getByRole('button', { name: 'Recolher painel' }).click()
  const controls = page.getByTestId('zoom-controls')
  await expect(page.getByTestId('zoom-percent')).toHaveText('100%')
  // Mapa inteiro em 900 px de altura: 32 px = 800 × 32 / 900 ≈ 28 km.
  await expect(page.getByTestId('map-scale')).toHaveText('28 km')
  // No canto inferior direito da área livre: 12 px do drawer e 16 px da base.
  const c = await box(controls)
  expect(Math.round(1440 - 400 - (c.x + c.width))).toBe(12)
  expect(Math.round(900 - (c.y + c.height))).toBe(16)

  await page.getByRole('button', { name: 'Aproximar' }).click()
  await zoomed(page, 1.25)
  await expect(page.getByTestId('zoom-percent')).toHaveText('125%')
  await expect(page.getByTestId('map-scale')).toHaveText('23 km')
  await page.getByRole('button', { name: 'Afastar' }).click()
  await page.getByRole('button', { name: 'Afastar' }).click()
  await zoomed(page, 0.8)
  await expect(page.getByTestId('zoom-percent')).toHaveText('80%')
  await page.getByRole('button', { name: 'Centralizar' }).click()
  const fit = await zoomed(page, 1)
  await expect(page.getByTestId('zoom-percent')).toHaveText('100%')
  expect(fit).toEqual({ x: 48 + (992 - 900) / 2, y: 0, width: 900, height: 900 })
})

// #137: sem pin selecionado (o drawer de 400 px aberto), a escala e a porcentagem aparecem nos
// tamanhos comuns de desktop, com a sidebar aberta ou recolhida.
for (const { width, height } of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`AC-F2-09: em ${width} × ${height}, sem pin selecionado, mostra a escala e a porcentagem, com a sidebar aberta ou recolhida`, async ({ page }) => {
    await open(page, width, height)
    await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'false')
    await expect(page.getByTestId('map-scale')).toBeVisible()
    await expect(page.getByTestId('zoom-percent')).toHaveText('100%')
    await page.getByRole('button', { name: 'Recolher painel' }).click()
    await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'false')
    await expect(page.getByTestId('zoom-percent')).toBeVisible()
  })
}

test('AC-F2-09: com menos de 450 px de área livre, esconde a escala e a porcentagem', async ({ page }) => {
  // Tablet 1024 com a sidebar recolhida: 1024 − 48 − 400 = 576 px, completo; aberta: 304 px, compacto.
  await open(page, 1024, 768)
  await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'true')
  await expect(page.getByTestId('map-scale')).toHaveCount(0)
  await expect(page.getByTestId('zoom-percent')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Centralizar' })).toBeVisible()
  // Recolhendo a sidebar, a área passa de 450 px e elas voltam; abrindo de novo, somem.
  await page.getByRole('button', { name: 'Recolher painel' }).click()
  await expect(page.getByTestId('zoom-percent')).toBeVisible()
  await page.getByRole('button', { name: 'Expandir painel' }).click()
  await expect(page.getByTestId('zoom-percent')).toHaveCount(0)
})

for (const { name, width, height } of [
  { name: 'tablet 1024', width: 1024, height: 768 },
  { name: 'celular 390', width: 390, height: 844 },
]) {
  test(`${name}: o minimapa e os botões de zoom ficam à vista e clicáveis (AC-F2-08, AC-F2-09)`, async ({ page }) => {
    await open(page, width, height)
    await expect(page.getByTestId('zoom-controls')).toHaveAttribute('data-compact', 'true')
    await expect(page.getByTestId('zoom-percent')).toHaveCount(0)
    for (const label of ['Afastar', 'Aproximar', 'Centralizar']) {
      const button = page.getByRole('button', { name: label })
      await expect(button).toBeVisible()
      expect(await onTop(button)).toBe(true)
    }
    await expect(page.getByTestId('minimap-surface')).toBeVisible()
    await page.getByRole('button', { name: 'Aproximar' }).click()
    await zoomed(page, 1.25)
  })
}

test('com mouse, os botões de zoom têm 40 px de largura (a exceção do zoom no desktop)', async ({ page }) => {
  await open(page)
  for (const label of ['Afastar', 'Aproximar', 'Centralizar']) {
    const b = await box(page.getByRole('button', { name: label }))
    expect([b.width, b.height]).toEqual([40, 44])
  }
})

test.describe('tela de toque', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('os botões de zoom têm a área de toque mínima, 44 × 44 px', async ({ page }) => {
    await gotoEditor(page)
    await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
    for (const label of ['Afastar', 'Aproximar', 'Centralizar']) {
      const b = await box(page.getByRole('button', { name: label }))
      expect([b.width, b.height]).toEqual([44, 44])
    }
    // Continuam à vista e sem cobrir o minimapa.
    const zoom = await box(page.getByTestId('zoom-controls'))
    const minimap = await box(page.getByTestId('minimap'))
    expect(zoom.x).toBeGreaterThan(minimap.x + minimap.width)
    expect(zoom.x + zoom.width).toBeLessThanOrEqual(390 - 12)
  })
})

test('tablet 1024 com a sidebar aberta: o minimapa sobe acima do zoom, sem sobreposição; recolhendo a sidebar, volta para o lado', async ({ page }) => {
  // 1024 − 320 − 400 = 304 px de área livre: não cabem os dois lado a lado.
  await open(page, 1024, 768)
  const minimapBox = () => box(page.getByTestId('minimap'))
  const zoomBox = () => box(page.getByTestId('zoom-controls'))
  // Empilhado: o minimapa termina 12 px acima do zoom, que segue a 16 px da base.
  const bottomOf = (b: Rect) => b.y + b.height
  await expect.poll(async () => Math.round((await zoomBox()).y - bottomOf(await minimapBox()))).toBe(12)
  const z = await zoomBox()
  expect(Math.round(768 - (z.y + z.height))).toBe(16)
  // Nada cobre o minimapa: o canto inferior direito dele recebe o ponteiro.
  const m = await minimapBox()
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-testid=minimap]') !== null, [m.x + m.width - 4, m.y + m.height - 4])
  expect(hit).toBe(true)

  // Sidebar recolhida: 1024 − 48 − 400 = 576 px; o minimapa volta para a base, ao lado do zoom.
  await page.getByRole('button', { name: 'Recolher painel' }).click()
  await expect.poll(async () => Math.round(768 - bottomOf(await minimapBox()))).toBe(16)
  const side = await minimapBox()
  expect(side.x + side.width).toBeLessThan((await zoomBox()).x)
})

test('AC-F2-08: com o foco no minimapa, as setas movem a área visível 1/10 do mapa (só elas, sem o pan da câmera)', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Aproximar' }).click()
  await page.getByRole('button', { name: 'Aproximar' }).click()
  const before = await zoomed(page, 1.5625)
  const surface = page.getByTestId('minimap-surface')
  await surface.focus()
  await page.keyboard.press('ArrowRight')
  const right = await settled(page)
  // 1/10 do mapa = 102,4 unidades; o pan das setas da câmera seria 20% da área livre (144 px).
  const scale = before.width / 1024
  expect(right.x - before.x).toBeCloseTo(-102.4 * scale, -1)
  expect(right.y).toBe(before.y)
  await page.keyboard.press('ArrowDown')
  const down = await settled(page)
  expect(down.y - right.y).toBeCloseTo(-102.4 * scale, -1)
  await expect(surface).toBeFocused()
})

test('as caixas da linha inferior batem com as medidas de bottomBarLayout', async ({ page }) => {
  await open(page)
  const minimap = await box(page.getByTestId('minimap'))
  expect([minimap.width, minimap.height]).toEqual([MINIMAP_CARD_WIDTH, MINIMAP_CARD_HEIGHT])
  expect((await box(page.getByTestId('zoom-controls'))).height).toBe(ZOOM_BAR_HEIGHT)
  await page.getByRole('button', { name: 'Minimapa' }).click()
  expect((await box(page.getByTestId('minimap'))).height).toBe(MINIMAP_CARD_COLLAPSED_HEIGHT)
})

test('a largura do toast no canto direito bate com TOAST_WIDTH, e o texto cabe numa linha', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/generator.worker*', (route) => route.abort())
  await gotoEditor(page)
  const toast = page.getByTestId('generation-error-toast')
  await expect(toast).toBeVisible()
  const b = await box(toast)
  expect(b.width).toBe(TOAST_WIDTH)
  expect(b.height).toBe(60)
})

test.describe('zoom compacto no toque', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('o cabeçalho do minimapa tem a área de toque mínima (44 px), e o cartão bate com as medidas de toque', async ({ page }) => {
    await gotoEditor(page)
    await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
    const header = page.getByRole('button', { name: 'Minimapa' })
    expect((await box(header)).height).toBe(MINIMAP_HEADER_HEIGHT_TOUCH)
    expect((await box(page.getByTestId('minimap'))).height).toBe(MINIMAP_CARD_HEIGHT_TOUCH)
    await header.tap()
    expect((await box(page.getByTestId('minimap'))).height).toBe(MINIMAP_CARD_COLLAPSED_HEIGHT_TOUCH)
  })

  test('a largura bate com ZOOM_COMPACT_MAX_WIDTH', async ({ page }) => {
    await gotoEditor(page)
    await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
    expect((await box(page.getByTestId('zoom-controls'))).width).toBe(ZOOM_COMPACT_MAX_WIDTH)
  })
})

test('tablet 1024 com a sidebar aberta: ao abrir o editor, o minimapa já aparece acima do zoom, sem subir animado', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  // Registra cada mudança da posição do minimapa e se a transição estava ligada naquele momento.
  // (Amostrar a posição por quadro não basta: ao abrir, a thread principal fica ocupada carregando o
  // mapa, e a animação de 200 ms pode acontecer inteira entre dois quadros desenhados.)
  await page.addInitScript(() => {
    const w = window as unknown as { minimapMoves: { bottom: string; transition: string }[] }
    w.minimapMoves = []
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement
        if (el.dataset?.testid !== 'minimap-slot') continue
        const last = w.minimapMoves[w.minimapMoves.length - 1]
        if (last?.bottom === el.style.bottom) continue
        w.minimapMoves.push({ bottom: el.style.bottom, transition: getComputedStyle(el).transitionDuration })
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
  })
  await gotoEditor(page)
  await expect(page.getByTestId('minimap-slot')).toHaveAttribute('data-animated', 'true', { timeout: 15_000 })
  const moves = await page.evaluate(() => (window as unknown as { minimapMoves: { bottom: string; transition: string }[] }).minimapMoves)
  // Ele sobe uma vez para 68 px (acima do zoom), sem transição; depois, a transição fica ligada.
  const stacked = moves.find((m) => m.bottom === '68px')
  expect(stacked).toEqual({ bottom: '68px', transition: '0s' })
  expect(await page.getByTestId('minimap-slot').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.2s')
})
