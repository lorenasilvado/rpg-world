/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

// Estradas no mapa (#246, AC-F5-01 a AC-F5-03): um mundo importado com os três tipos de via aparece
// com as estradas, Camadas as esconde, excluir um pin tira a estrada ligada (e Desfazer a devolve) e
// recarregar mantém tudo. Cada teste tem um contexto novo do navegador, então o banco começa vazio.

const pin = (id: string, u: number, v: number) => ({
  id,
  type: 'cidade',
  name: id,
  pos: { u, v },
  icon: { kind: 'builtin', key: 'cidade' },
  description: '',
  tags: [],
  fields: {},
})

const ROADS = [
  { id: 'r1', name: 'Estrada Real', kind: 'road', points: [{ u: 0.35, v: 0.45 }, { u: 0.45, v: 0.4 }, { u: 0.55, v: 0.5 }], from: 'Alda', to: 'Brena' },
  { id: 'r2', name: 'Trilha dos Pinheiros', kind: 'trail', points: [{ u: 0.4, v: 0.6 }, { u: 0.5, v: 0.62 }, { u: 0.6, v: 0.58 }] },
  // Sem nome: o arquivo editado à mão ganha "Estrada".
  { id: 'r3', kind: 'sea', points: [{ u: 0.55, v: 0.5 }, { u: 0.7, v: 0.3 }, { u: 0.85, v: 0.2 }], from: 'Brena' },
]

const FILE = {
  format: 'rpg-world-builder/world',
  version: 1,
  world: {
    name: 'Reino das Estradas',
    seed: 'estradas-246',
    generatorVersion: 1,
    sizeKm: 800,
    params: { ocean: 45, beach: 30, desert: 15, forest: 35, mountains: 30, snow: 40, continentSize: 50, coastRoughness: 50, temperature: 50 },
    pins: [pin('Alda', 0.35, 0.45), pin('Brena', 0.55, 0.5)],
    roads: ROADS,
  },
  images: [],
}

async function readRoads(page: Page): Promise<{ id: string; name: string }[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('rpg-world')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const req = open.result.transaction('worlds').objectStore('worlds').getAll()
          req.onsuccess = () => {
            open.result.close()
            resolve((req.result as { roads: { id: string; name: string }[] }[])[0]?.roads ?? [])
          }
          req.onerror = () => reject(req.error)
        }
      }),
  )
}

async function openWorld(page: Page) {
  await page.getByRole('button', { name: /^Reino das Estradas/ }).click()
  await expect(page.getByTestId('editor')).toBeVisible()
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 45_000 })
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`um mundo importado com estradas as mostra, Camadas esconde e recarregar mantém (AC-F5-01 a AC-F5-03, ${size.width})`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/')
    await expect(page.getByTestId('world-list')).not.toHaveAttribute('data-state', 'loading')
    await page.getByTestId('import-input').setInputFiles({ name: 'estradas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FILE)) })
    await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
    expect((await readRoads(page)).map((r) => r.name)).toEqual(['Estrada Real', 'Trilha dos Pinheiros', 'Estrada'])

    await openWorld(page)
    const map = page.getByTestId('map')
    await expect(map).toHaveAttribute('data-roads', '3')
    await expect(map).toHaveAttribute('data-road-layer', 'on')

    // Camadas › Estradas esconde e mostra.
    await page.getByRole('button', { name: 'Camadas' }).click()
    const roadsSwitch = page.getByRole('switch', { name: 'Estradas' })
    await roadsSwitch.click()
    await expect(map).toHaveAttribute('data-road-layer', 'off')
    await expect(map).toHaveAttribute('data-roads', '0')
    await roadsSwitch.click()
    await expect(map).toHaveAttribute('data-roads', '3')
    await page.keyboard.press('Escape')

    if (size.width >= 768) {
      // Excluir Alda tira a Estrada Real, ligada a ela; Desfazer devolve o pin e a estrada.
      const [x, y, width, height] = ((await map.getAttribute('data-map-rect')) ?? '').split(',').map(Number)
      await page.mouse.click(x + 0.35 * width, y + 0.45 * height - 10)
      await expect(map).toHaveAttribute('data-pin-selected', 'Alda')
      await page.keyboard.press('Delete')
      await expect(map).toHaveAttribute('data-roads', '2')
      await expect.poll(async () => (await readRoads(page)).map((r) => r.id)).toEqual(['r2', 'r3'])
      await page.keyboard.press('Control+z')
      await expect(map).toHaveAttribute('data-roads', '3')
      await expect.poll(async () => (await readRoads(page)).map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
    }

    await page.reload()
    await openWorld(page)
    await expect(map).toHaveAttribute('data-roads', '3')
    expect((await readRoads(page)).map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
  })
}

// Desenhar estrada (#247, AC-F5-04, AC-F5-05): de Alda a Brena, passando por um ponto do mapa; a
// estrada nova entra no mundo ligada aos dois pins, e Desfazer a tira. No celular, com o toque.
async function savedRoad(page: Page, name: string) {
  return (await readRoads(page)).find((r) => r.name === name) as { from?: string; to?: string; kind: string; points: unknown[] } | undefined
}

async function importAndOpen(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('world-list')).not.toHaveAttribute('data-state', 'loading')
  await page.getByTestId('import-input').setInputFiles({ name: 'estradas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FILE)) })
  await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
  await openWorld(page)
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-roads', '3')
  const [x, y, width, height] = ((await map.getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  // O ponto do mapa (u, v) na página; `lift`: px acima, para cair no desenho do pin (a âncora é a base).
  return { map, at: (u: number, v: number, lift = 0) => ({ x: x + u * width, y: y + v * height - lift }) }
}

test('Desenhar estrada (R): de um pin a outro, com a prévia; a estrada fica ligada e Desfazer a tira (AC-F5-04, AC-F5-05, 1440)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const { map, at } = await importAndOpen(page)
  await page.keyboard.press('r')
  await expect(map).toHaveAttribute('data-tool', 'road')
  const hint = page.getByTestId('road-draw-hint')
  await expect(hint).toHaveText('Clique no mapa ou num pin para começar a estrada')

  const alda = at(0.35, 0.45, 10)
  await page.mouse.click(alda.x, alda.y)
  await expect(hint).toHaveText('Clique para adicionar pontos · Enter ou duplo clique termina · Esc cancela')
  // O clique no pin é do desenho: o pin não fica selecionado.
  await expect(map).not.toHaveAttribute('data-pin-selected', 'Alda')
  const mid = at(0.45, 0.3)
  await page.mouse.move(mid.x, mid.y)
  await expect(page.getByTestId('road-draw-preview')).toBeVisible()
  await page.mouse.click(mid.x, mid.y)
  await expect(page.getByTestId('road-draw-layer')).toHaveAttribute('data-points', '2')

  // Esc no meio apaga o desenho, e a ferramenta continua.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('road-draw-layer')).toHaveAttribute('data-points', '0')
  await page.mouse.click(alda.x, alda.y)
  await page.mouse.click(mid.x, mid.y)
  const brena = at(0.55, 0.5, 10)
  await page.mouse.dblclick(brena.x, brena.y)

  await expect(map).toHaveAttribute('data-roads', '4')
  await expect(map).toHaveAttribute('data-tool', 'nav')
  await expect(page.getByTestId('road-draw-layer')).toHaveCount(0)
  await expect.poll(async () => (await savedRoad(page, 'Nova estrada'))?.points.length).toBe(3)
  expect(await savedRoad(page, 'Nova estrada')).toMatchObject({ kind: 'road', from: 'Alda', to: 'Brena' })

  await page.keyboard.press('Control+z')
  await expect(map).toHaveAttribute('data-roads', '3')
  await expect.poll(async () => savedRoad(page, 'Nova estrada')).toBeUndefined()
  await page.keyboard.press('Control+Shift+z')
  await expect(map).toHaveAttribute('data-roads', '4')
})

test.describe('com o toque', () => {
  test.use({ hasTouch: true, isMobile: true })

  test('Desenhar estrada no celular: toques adicionam pontos, o duplo toque termina (AC-F5-04, AC-F5-05, 390)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { map, at } = await importAndOpen(page)
    await page.getByRole('button', { name: 'Desenhar estrada' }).tap()
    await expect(map).toHaveAttribute('data-tool', 'road')
    const alda = at(0.35, 0.45, 10)
    await page.touchscreen.tap(alda.x, alda.y)
    await expect(page.getByTestId('road-draw-layer')).toHaveAttribute('data-points', '1')
    const mid = at(0.45, 0.3)
    await page.touchscreen.tap(mid.x, mid.y)
    const brena = at(0.55, 0.5, 10)
    await page.touchscreen.tap(brena.x, brena.y)
    await page.touchscreen.tap(brena.x, brena.y)
    await expect(map).toHaveAttribute('data-roads', '4')
    await expect.poll(async () => (await savedRoad(page, 'Nova estrada'))?.points.length).toBe(3)
    expect(await savedRoad(page, 'Nova estrada')).toMatchObject({ from: 'Alda', to: 'Brena' })
  })
})

// Selecionar estrada e o drawer dela (#248, AC-F5-06 a AC-F5-08): clicar na Trilha dos Pinheiros a
// seleciona, com o halo e o drawer; renomear e trocar o tipo são passos no Desfazer, e Excluir (o botão
// ou Delete) mostra "Estrada excluída", com Desfazer.
test('selecionar, renomear, trocar o tipo, excluir e desfazer a estrada (AC-F5-06 a AC-F5-08, 1440)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const { map } = await importAndOpen(page)
  // O ponto do mapa (u, v) na página, lido de novo a cada vez: a câmera desliza quando o drawer abre
  // ou fecha, então espera ela parar (sem deslizamento pendente e duas leituras iguais seguidas).
  const at = async (u: number, v: number) => {
    let rect = ''
    await expect
      .poll(async () => {
        const before = rect
        rect = (await map.getAttribute('data-map-rect')) ?? ''
        return rect !== '' && rect === before && (await map.getAttribute('data-camera-moving')) === 'false'
      }, { intervals: [150] })
      .toBe(true)
    const [x, y, width, height] = rect.split(',').map(Number)
    return { x: x + u * width, y: y + v * height }
  }
  const trail = await at(0.5, 0.62)
  await page.mouse.click(trail.x, trail.y + 4)
  await expect(map).toHaveAttribute('data-road-selected', 'r2')
  const drawer = page.getByTestId('road-drawer')
  await expect(drawer).toBeVisible()
  await expect(page.getByTestId('drawer')).toBeInViewport({ ratio: 1 })
  const name = drawer.getByRole('textbox', { name: 'Nome da estrada' })
  await expect(name).toHaveValue('Trilha dos Pinheiros')
  await expect(drawer.getByRole('button', { name: 'Trilha' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('road-length')).toContainText(/Extensão aproximada: \d+ km/)

  // Renomear: as teclas seguidas são um passo só.
  await name.fill('Trilha Velha')
  await name.press('Enter')
  await expect.poll(async () => (await readRoads(page)).find((r) => r.id === 'r2')?.name).toBe('Trilha Velha')
  // Trocar o tipo.
  await drawer.getByRole('button', { name: 'Rota marítima' }).click()
  await expect.poll(async () => (await savedRoad(page, 'Trilha Velha'))?.kind).toBe('sea')
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await savedRoad(page, 'Trilha Velha'))?.kind).toBe('trail')
  await page.keyboard.press('Control+z')
  await expect(name).toHaveValue('Trilha dos Pinheiros')

  // Excluir pelo drawer: o toast oferece Desfazer.
  await drawer.getByRole('button', { name: 'Excluir estrada' }).click()
  await expect(map).toHaveAttribute('data-roads', '2')
  await expect(map).toHaveAttribute('data-road-selected', '')
  await expect(page.getByTestId('pin-deleted-toast')).toContainText('Estrada excluída')
  // O drawer fechou: a linha inferior desliza até a borda direita. Clicar no toast no meio do
  // deslize faz o Playwright rolar o editor (o drawer fora da tela conta na área rolável).
  await expect(page.getByTestId('bottom-bar')).toHaveCSS('right', '0px')
  await page.getByTestId('pin-deleted-toast').getByRole('button', { name: 'Desfazer' }).click()
  await expect(map).toHaveAttribute('data-roads', '3')
  await expect.poll(async () => (await readRoads(page)).map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])

  // A Estrada Real liga Alda e Brena: clicar em Brena em "Liga" a seleciona. Depois, Delete na estrada.
  let real = await at(0.45, 0.4)
  await page.mouse.click(real.x, real.y)
  await expect(map).toHaveAttribute('data-road-selected', 'r1')
  await expect(page.getByTestId('road-ends').getByRole('button')).toHaveText(['Alda', 'Brena'])
  await page.keyboard.press('Delete')
  await expect(map).toHaveAttribute('data-roads', '2')
  await expect(page.getByTestId('pin-deleted-toast')).toContainText('Estrada excluída')
  await page.keyboard.press('Control+z')
  await expect(map).toHaveAttribute('data-roads', '3')
  real = await at(0.45, 0.4)
  await page.mouse.click(real.x, real.y)
  await page.getByTestId('road-ends').getByRole('button', { name: 'Brena' }).click()
  await expect(map).toHaveAttribute('data-pin-selected', 'Brena')
  await expect(map).toHaveAttribute('data-road-selected', '')
  await expect(page.getByTestId('pin-drawer')).toBeVisible()
})

for (const size of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test.describe(`no celular (${size.width}×${size.height})`, () => {
    test.use({ hasTouch: true, isMobile: true })

    test(`tocar na estrada abre o drawer sobreposto; fechar tira a seleção (AC-F5-06, ${size.width}×${size.height})`, async ({ page }) => {
      await page.setViewportSize(size)
      const { map, at } = await importAndOpen(page)
      const trail = at(0.5, 0.62)
      await page.touchscreen.tap(trail.x, trail.y + 3)
      await expect(map).toHaveAttribute('data-road-selected', 'r2')
      await expect(page.getByTestId('drawer')).toHaveAttribute('data-open', 'true')
      await expect(page.getByTestId('scrim')).toBeVisible()
      // O painel desliza (200 ms) para dentro: as medidas abaixo valem com ele parado.
      await expect(page.getByTestId('drawer')).toBeInViewport({ ratio: 1 })
      await expect(page.getByTestId('road-drawer').getByRole('textbox', { name: 'Nome da estrada' })).toHaveValue('Trilha dos Pinheiros')
      // O seletor do tipo de via cabe no painel de 320 px: cada rótulo numa linha, sem cortar.
      const kinds = await page.getByTestId('road-kind').getByRole('button').evaluateAll((buttons) =>
        buttons.map((b) => {
          const range = document.createRange()
          range.selectNodeContents(b)
          // Uma caixa por linha do texto: o rótulo quebrado tem duas.
          const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size
          return { text: b.textContent, lines, cut: b.scrollWidth > b.clientWidth }
        }),
      )
      expect(kinds).toEqual(['Estrada', 'Trilha', 'Rota marítima'].map((text) => ({ text, lines: 1, cut: false })))
      const kindBox = await page.getByTestId('road-kind').boundingBox()
      expect(kindBox!.x + kindBox!.width).toBeLessThanOrEqual(size.width)
      await page.getByRole('button', { name: 'Fechar detalhes' }).tap()
      await expect(page.getByTestId('drawer')).toHaveAttribute('data-open', 'false')
      await expect(map).toHaveAttribute('data-road-selected', '')
    })
  })
}
