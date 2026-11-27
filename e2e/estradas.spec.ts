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
  return (await readRoads(page)).find((r) => r.name === name) as { from?: string; to?: string; kind: string; points: { u: number; v: number; pin?: string }[] } | undefined
}

async function importAndOpen(page: Page, file: object = FILE) {
  await page.goto('/')
  await expect(page.getByTestId('world-list')).not.toHaveAttribute('data-state', 'loading')
  await page.getByTestId('import-input').setInputFiles({ name: 'estradas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
  await openWorld(page)
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-roads', String((file as typeof FILE).world.roads.length))
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

// Pins do meio (#285, AC-F5-17): de Alda, passando por Brena, até um ponto solto; Brena fica ligada
// ao ponto dela, "Liga" mostra os dois na ordem, e excluir Brena deixa a estrada com o ponto solto.
test('Desenhar estrada: o pin clicado no meio fica ligado; excluí-lo deixa o ponto solto e Desfazer devolve (AC-F5-17, 1440)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const { map, at } = await importAndOpen(page)
  await page.keyboard.press('r')
  const alda = at(0.35, 0.45, 10)
  const brena = at(0.55, 0.5, 10)
  const solto = at(0.6, 0.7)
  await page.mouse.click(alda.x, alda.y)
  await page.mouse.click(brena.x, brena.y)
  await page.mouse.click(solto.x, solto.y)
  await page.keyboard.press('Enter')
  await expect(map).toHaveAttribute('data-roads', '4')
  await expect.poll(async () => (await savedRoad(page, 'Nova estrada'))?.points.length).toBe(3)
  const road = (await savedRoad(page, 'Nova estrada'))!
  expect(road.from).toBe('Alda')
  expect(road.to).toBeUndefined()
  expect(road.points[1]).toEqual({ u: 0.55, v: 0.5, pin: 'Brena' })

  // "Liga" no drawer: os pins ligados, na ordem da estrada.
  await expect(page.getByTestId('road-drawer')).toBeVisible()
  await expect(page.getByTestId('road-ends').getByRole('button')).toHaveText([/Alda/, /Brena/])

  // Excluir Brena tira as estradas com a ponta nela (Estrada Real, a rota marítima), e a nova fica.
  await page.mouse.click(brena.x, brena.y)
  await expect(map).toHaveAttribute('data-pin-selected', 'Brena')
  await page.keyboard.press('Delete')
  await expect(map).toHaveAttribute('data-roads', '2')
  await expect.poll(async () => (await savedRoad(page, 'Nova estrada'))?.points[1]).toEqual({ u: 0.55, v: 0.5 })
  await page.keyboard.press('Control+z')
  await expect(map).toHaveAttribute('data-roads', '4')
  await expect.poll(async () => (await savedRoad(page, 'Nova estrada'))?.points[1]).toEqual({ u: 0.55, v: 0.5, pin: 'Brena' })
})

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Rota automática (A): origem e destino criam "Rota de Alda a Brena", ligada, no Desfazer; Esc cancela (AC-F5-12, ${size.width})`, async ({ page }) => {
    await page.setViewportSize(size)
    const { map, at } = await importAndOpen(page)
    const toolbar = page.getByRole('toolbar', { name: 'Ferramentas' })
    await toolbar.getByRole('button', { name: 'Rota automática' }).click()
    await expect(map).toHaveAttribute('data-tool', 'route')
    const hint = page.getByTestId('route-hint')
    const layer = page.getByTestId('route-layer')
    await expect(hint).toHaveText('Clique no pin de origem')

    const alda = at(0.35, 0.45, 10)
    const brena = at(0.55, 0.5, 10)
    await page.mouse.click(alda.x, alda.y)
    await expect(hint).toHaveText('Agora clique no pin de destino')
    await expect(layer).toHaveAttribute('data-from', 'Alda')
    // O clique no pin é da rota: o pin não fica selecionado.
    await expect(map).not.toHaveAttribute('data-pin-selected', 'Alda')
    // Esc com a origem marcada cancela, e a ferramenta continua.
    await page.keyboard.press('Escape')
    await expect(hint).toHaveText('Clique no pin de origem')
    await expect(layer).not.toHaveAttribute('data-from', /.+/)

    await page.mouse.click(alda.x, alda.y)
    await page.mouse.click(brena.x, brena.y)
    await expect(map).toHaveAttribute('data-roads', '4', { timeout: 15_000 })
    await expect(page.getByTestId('pin-deleted-toast')).toContainText('Rota criada')
    await expect(map).toHaveAttribute('data-tool', 'route')
    await expect(hint).toHaveText('Clique no pin de origem')
    await expect.poll(async () => savedRoad(page, 'Rota de Alda a Brena')).toMatchObject({ kind: 'road', from: 'Alda', to: 'Brena' })
    expect(((await savedRoad(page, 'Rota de Alda a Brena'))?.points.length ?? 0) >= 2).toBe(true)

    // Um passo no Desfazer.
    await page.keyboard.press('Control+z')
    await expect(map).toHaveAttribute('data-roads', '3')
    await expect.poll(async () => savedRoad(page, 'Rota de Alda a Brena')).toBeUndefined()

    // Sem nada marcado, Esc volta para Navegar.
    await page.keyboard.press('Escape')
    await expect(map).toHaveAttribute('data-tool', 'nav')
  })
}

// Na seed "rotas" (com os parâmetros padrão), o pin Ilha fica numa ilha a sudeste, sem caminho por
// terra até o Porto, na costa do continente; pela água há caminho.
const ISLAND_FILE = {
  ...FILE,
  world: { ...FILE.world, seed: 'rotas', pins: [pin('Porto', 0.752, 0.697), pin('Ilha', 0.842, 0.807)], roads: [] },
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Rota automática sem caminho por terra: o toast oferece "Criar rota marítima", que cria a rota pela água, no Desfazer (AC-F5-13, ${size.width})`, async ({ page }) => {
    await page.setViewportSize(size)
    const { map, at } = await importAndOpen(page, ISLAND_FILE)
    await page.keyboard.press('a')
    await expect(map).toHaveAttribute('data-tool', 'route')
    const porto = at(0.752, 0.697, 10)
    const ilha = at(0.842, 0.807, 10)
    await page.mouse.click(porto.x, porto.y)
    await expect(page.getByTestId('route-hint')).toHaveText('Agora clique no pin de destino')
    await page.mouse.click(ilha.x, ilha.y)

    const toast = page.getByTestId('no-path-toast')
    await expect(toast).toContainText('Não há caminho por terra entre Porto e Ilha.', { timeout: 15_000 })
    await expect(map).toHaveAttribute('data-roads', '0')
    await expect(page.getByTestId('route-hint')).toHaveText('Clique no pin de origem')

    await toast.getByRole('button', { name: 'Criar rota marítima' }).click()
    await expect(map).toHaveAttribute('data-roads', '1', { timeout: 15_000 })
    await expect(toast).toBeHidden()
    await expect(page.getByTestId('pin-deleted-toast')).toContainText('Rota criada')
    await expect.poll(async () => savedRoad(page, 'Rota marítima de Porto a Ilha')).toMatchObject({ kind: 'sea', from: 'Porto', to: 'Ilha' })

    // Um passo no Desfazer.
    await page.keyboard.press('Control+z')
    await expect(map).toHaveAttribute('data-roads', '0')
    await expect.poll(async () => savedRoad(page, 'Rota marítima de Porto a Ilha')).toBeUndefined()

    // O Fechar tira o toast, sem criar nada.
    await page.mouse.click(porto.x, porto.y)
    await page.mouse.click(ilha.x, ilha.y)
    await expect(toast).toBeVisible({ timeout: 15_000 })
    await toast.getByRole('button', { name: 'Fechar' }).click()
    await expect(toast).toBeHidden()
    await expect(map).toHaveAttribute('data-roads', '0')
  })
}

// Na seed "rotas", Campo, Vale, Serra e Porto ficam no continente e a Ilha, numa ilha a sudeste.
// A menor malha liga Campo–Vale, Vale–Serra e Porto–Vale; a Ilha fica sem caminho por terra.
const CITIES_FILE = {
  ...FILE,
  world: {
    ...FILE.world,
    seed: 'rotas',
    pins: [pin('Porto', 0.752, 0.697), pin('Ilha', 0.842, 0.807), pin('Campo', 0.6, 0.6), pin('Vale', 0.7, 0.55), pin('Serra', 0.6, 0.45)],
    roads: [],
  },
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`"Conectar cidades" liga as cidades alcançáveis num passo só; de novo, não repete o par já ligado (AC-F5-14, ${size.width})`, async ({ page }) => {
    await page.setViewportSize(size)
    const { map } = await importAndOpen(page, CITIES_FILE)
    await page.keyboard.press('a')
    await expect(map).toHaveAttribute('data-tool', 'route')
    const status = page.getByTestId('route-status')
    const connect = status.getByRole('button', { name: 'Conectar cidades' })
    await expect(connect).toBeEnabled()
    // A dica cabe na área do mapa, sem cortar o botão.
    const box = (await status.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(size.width)

    await connect.click()
    await expect(map).toHaveAttribute('data-roads', '3', { timeout: 15_000 })
    const toast = page.getByTestId('pin-deleted-toast')
    await expect(toast).toContainText('3 estradas criadas · 1 cidade sem caminho por terra')
    await expect(page.getByTestId('route-hint')).toHaveText('Clique no pin de origem')
    await expect.poll(async () => (await readRoads(page)).map((r) => r.name).sort()).toEqual([
      'Rota de Campo a Vale',
      'Rota de Porto a Vale',
      'Rota de Vale a Serra',
    ])
    expect(await savedRoad(page, 'Rota de Porto a Vale')).toMatchObject({ kind: 'road', from: 'Porto', to: 'Vale' })

    // Um passo só no Desfazer.
    await toast.getByRole('button', { name: 'Desfazer' }).click()
    await expect(map).toHaveAttribute('data-roads', '0')
    await expect.poll(async () => (await readRoads(page)).length).toBe(0)

    // Com Porto–Vale já ligada (Rota automática), a malha não repete o par.
    const at = async (u: number, v: number) => {
      const [x, y, width, height] = ((await map.getAttribute('data-map-rect')) ?? '').split(',').map(Number)
      return { x: x + u * width, y: y + v * height - 10 }
    }
    const porto = await at(0.752, 0.697)
    const vale = await at(0.7, 0.55)
    await page.mouse.click(porto.x, porto.y)
    await page.mouse.click(vale.x, vale.y)
    await expect(map).toHaveAttribute('data-roads', '1', { timeout: 15_000 })
    await connect.click()
    await expect(map).toHaveAttribute('data-roads', '3', { timeout: 15_000 })
    await expect(toast).toContainText('2 estradas criadas · 1 cidade sem caminho por terra')
    await expect.poll(async () => (await readRoads(page)).map((r) => r.name).sort()).toEqual([
      'Rota de Campo a Vale',
      'Rota de Porto a Vale',
      'Rota de Vale a Serra',
    ])

    // Tudo já ligado: nada novo, sem "Desfazer".
    await connect.click()
    await expect(toast).toContainText('Nenhuma estrada nova · 1 cidade sem caminho por terra', { timeout: 15_000 })
    await expect(toast.getByRole('button', { name: 'Desfazer' })).toHaveCount(0)
    await expect(map).toHaveAttribute('data-roads', '3')
  })
}

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

  // Pins do meio no celular (#285, AC-F5-17): o toque num pin no meio do desenho o liga; o "Liga" do
  // painel sobreposto mostra os dois, e excluir Brena (pelo drawer dela) deixa o ponto solto.
  test('Desenhar estrada no celular: o pin tocado no meio fica ligado; excluí-lo deixa o ponto solto (AC-F5-17, 390)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { map, at } = await importAndOpen(page)
    await page.getByRole('button', { name: 'Desenhar estrada' }).tap()
    const alda = at(0.35, 0.45, 10)
    const brena = at(0.55, 0.5, 10)
    const solto = at(0.6, 0.7)
    await page.touchscreen.tap(alda.x, alda.y)
    await page.touchscreen.tap(brena.x, brena.y)
    await expect(page.getByTestId('road-draw-layer')).toHaveAttribute('data-points', '2')
    await page.touchscreen.tap(solto.x, solto.y)
    await page.touchscreen.tap(solto.x, solto.y)
    await expect(map).toHaveAttribute('data-roads', '4')
    await expect.poll(async () => (await savedRoad(page, 'Nova estrada'))?.points[1]).toEqual({ u: 0.55, v: 0.5, pin: 'Brena' })

    await expect(page.getByTestId('drawer')).toHaveAttribute('data-open', 'true')
    await expect(page.getByTestId('drawer')).toBeInViewport({ ratio: 1 })
    const ends = page.getByTestId('road-ends').getByRole('button')
    await expect(ends).toHaveText([/Alda/, /Brena/])

    // Brena no "Liga" abre a ficha dela; Excluir tira as estradas com a ponta nela, e a nova fica.
    await ends.nth(1).tap()
    await expect(map).toHaveAttribute('data-pin-selected', 'Brena')
    await page.getByTestId('drawer').getByRole('button', { name: 'Excluir', exact: true }).tap()
    await expect(map).toHaveAttribute('data-roads', '2')
    await expect.poll(async () => (await savedRoad(page, 'Nova estrada'))?.points[1]).toEqual({ u: 0.55, v: 0.5 })
    await page.getByRole('button', { name: 'Desfazer' }).first().tap()
    await expect(map).toHaveAttribute('data-roads', '4')
    await expect.poll(async () => (await savedRoad(page, 'Nova estrada'))?.points[1]).toEqual({ u: 0.55, v: 0.5, pin: 'Brena' })
  })

  // A dica da estrada (#279) é maior, mas cabe na tela do celular: quebra em linhas, a 12 px das bordas.
  for (const [width, height] of [[360, 800], [390, 844]]) {
    test(`a dica de Desenhar estrada cabe na tela, sem cortar o texto (AC-F5-04, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      const { map, at } = await importAndOpen(page)
      await page.getByRole('button', { name: 'Desenhar estrada' }).tap()
      await expect(map).toHaveAttribute('data-tool', 'road')
      const start = at(0.3, 0.35)
      await page.touchscreen.tap(start.x, start.y)
      const hint = page.getByTestId('road-draw-hint')
      await expect(hint).toHaveText('Clique para adicionar pontos · Enter ou duplo clique termina · Esc cancela')
      const box = await page.getByTestId('road-draw-status').boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(12 - 0.5)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width - 12 + 0.5)
      expect(await hint.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      await expect(hint).toHaveCSS('font-size', '16px')
    })
  }
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

// Estradas na aba Conexões (#253, AC-F5-15): Brena tem a Estrada Real (até Alda) e a rota marítima
// até um ponto solto; clicar em Alda abre a ficha dela na mesma aba, e o ponto no mapa abre a estrada.
test('a aba Conexões lista as estradas do pin; clicar abre o vizinho ou a estrada (AC-F5-15, 1440)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const { map, at } = await importAndOpen(page)
  const brena = at(0.55, 0.5, 10)
  await page.mouse.click(brena.x, brena.y)
  await expect(map).toHaveAttribute('data-pin-selected', 'Brena')
  const drawer = page.getByTestId('pin-drawer')
  await drawer.getByRole('tab', { name: 'Conexões' }).click()
  const roads = drawer.getByRole('region', { name: 'Estradas (2)' }).getByRole('button')
  await expect(roads).toHaveText([/^AldaEstrada Real · Estrada · \d+ km$/, /^Ponto no mapaEstrada · Rota marítima · \d+ km$/])

  // O vizinho: a ficha de Alda abre em Conexões, com a Estrada Real até Brena.
  await roads.first().click()
  await expect(map).toHaveAttribute('data-pin-selected', 'Alda')
  await expect(drawer.getByRole('tab', { name: 'Conexões' })).toHaveAttribute('aria-selected', 'true')
  const back = drawer.getByRole('region', { name: 'Estradas (1)' }).getByRole('button')
  await expect(back).toHaveText([/^BrenaEstrada Real · Estrada · \d+ km$/])
  await back.click()
  await expect(map).toHaveAttribute('data-pin-selected', 'Brena')

  // O ponto no mapa: seleciona a rota marítima, com o mesmo comprimento no drawer da estrada.
  const sea = drawer.getByRole('region', { name: 'Estradas (2)' }).getByRole('button', { name: /^Ponto no mapa/ })
  const km = ((await sea.textContent()) ?? '').split(' · ').at(-1)
  await sea.click()
  await expect(map).toHaveAttribute('data-road-selected', 'r3')
  await expect(map).toHaveAttribute('data-pin-selected', '')
  await expect(page.getByTestId('road-length')).toHaveText(`Extensão aproximada: ${km}`)
})
