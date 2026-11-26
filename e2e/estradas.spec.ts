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
