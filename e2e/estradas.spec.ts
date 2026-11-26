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
