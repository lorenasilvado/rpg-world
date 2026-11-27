/// <reference lib="dom" />
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Fluxos de estradas do M3, de ponta a ponta (#254; critério de saída de docs/milestones/m3.md):
// num mundo com 5 cidades, a Rota automática liga duas, a Ilha (sem caminho por terra) ganha a rota
// marítima pelo toast, "Conectar cidades" completa a malha, uma estrada desenhada à mão é renomeada,
// muda de tipo, é excluída e volta pelo Desfazer; depois, recarregar a página mantém tudo e o JSON
// exportado reimporta idêntico. Cada parte tem o seu E2E detalhado (estradas.spec.ts); aqui elas
// rodam em sequência, no mesmo mundo, no Chrome (projeto app), no Firefox e no WebKit.

// No Firefox e no WebKit do Playwright, sem GPU, cada mapa final e cada rota levam alguns segundos.
test.describe.configure({ timeout: 240_000 })

type SavedRoad = { id: string; name: string; kind: string; points: { u: number; v: number; pin?: string }[]; from?: string; to?: string }
type SavedWorld = { id: string; name: string; seed: string; pins: { id: string; name: string }[]; roads: SavedRoad[]; [key: string]: unknown }

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

// Na seed "rotas" (com os parâmetros padrão), Campo, Vale, Serra e Porto ficam no continente e a Ilha,
// numa ilha a sudeste, sem caminho por terra até o Porto; pela água há caminho (estradas.spec.ts).
const PINS = { Porto: { u: 0.752, v: 0.697 }, Ilha: { u: 0.842, v: 0.807 }, Campo: { u: 0.6, v: 0.6 }, Vale: { u: 0.7, v: 0.55 }, Serra: { u: 0.6, v: 0.45 } }
type PinName = keyof typeof PINS

const FILE = {
  format: 'rpg-world-builder/world',
  version: 1,
  world: {
    name: 'Reino das Rotas',
    seed: 'rotas',
    generatorVersion: 1,
    sizeKm: 800,
    params: { ocean: 45, beach: 30, desert: 15, forest: 35, mountains: 30, snow: 40, continentSize: 50, coastRoughness: 50, temperature: 50 },
    pins: Object.entries(PINS).map(([name, at]) => pin(name, at.u, at.v)),
    roads: [],
  },
  images: [],
}

/** Um ponto solto do meio da estrada desenhada à mão, entre Serra e Campo, a oeste delas. */
const DRAWN_MID = { u: 0.55, v: 0.52 }

const map = (page: Page) => page.getByTestId('map')
const roadsAttr = (page: Page, n: number, timeout = 30_000) => expect(map(page)).toHaveAttribute('data-roads', String(n), { timeout })

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 60_000 })
  await expect(map(page)).toHaveAttribute('data-terrain-size', '1024', { timeout: 60_000 })
}

/**
 * Espera a câmera parar (sem deslizamento pendente e o retângulo do mapa igual por 400 ms, mais que
 * o deslizamento de 350 ms) e devolve o retângulo: o drawer da estrada abre e fecha no meio do fluxo.
 */
async function settledRect(page: Page) {
  let last = ''
  let since = 0
  await expect
    .poll(async () => {
      const now = (await map(page).getAttribute('data-map-rect')) ?? ''
      if (now !== last) {
        last = now
        since = Date.now()
      }
      return Date.now() - since >= 400 && (await map(page).getAttribute('data-camera-moving')) === 'false'
    }, { intervals: [100], timeout: 30_000 })
    .toBe(true)
  const [x, y, width, height] = last.split(',').map(Number)
  return { x, y, width, height }
}

/** O ponto da tela da posição (u, v), com a câmera parada; `lift`: px acima (o desenho do pin fica acima da âncora). */
async function screenOf(page: Page, at: { u: number; v: number }, lift = 0) {
  const r = await settledRect(page)
  return { x: r.x + at.u * r.width, y: r.y + at.v * r.height - lift }
}

async function clickPin(page: Page, name: PinName) {
  const p = await screenOf(page, PINS[name], 10)
  await page.mouse.click(p.x, p.y)
}

function readWorlds(page: Page) {
  return page.evaluate(
    () =>
      new Promise<SavedWorld[]>((resolve, reject) => {
        const open = indexedDB.open('rpg-world')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const get = db.transaction('worlds').objectStore('worlds').getAll()
          get.onsuccess = () => {
            db.close()
            resolve(get.result)
          }
          get.onerror = () => reject(get.error)
        }
      }),
  )
}

/** Os mundos do banco, depois do Salvo. */
async function savedWorlds(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-status', 'saved')
  return readWorlds(page)
}

const savedRoads = async (page: Page) => (await savedWorlds(page))[0].roads
const roadNames = async (page: Page) => (await savedRoads(page)).map((r) => r.name).sort()
const roadNamed = async (page: Page, name: string) => (await savedRoads(page)).find((r) => r.name === name)

/** O mundo sem o que muda numa cópia (id e datas). */
const comparable = ({ id: _id, createdAt: _c, updatedAt: _u, ...rest }: SavedWorld) => rest

test('rota automática, rota marítima, Conectar cidades, estrada desenhada e o drawer dela, recarregar, exportar e reimportar (critério de saída do M3)', async ({ page, browserName }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  // 0. O mundo das 5 cidades, importado na Lista de mundos (AC-F4-09).
  await expect(page.getByTestId('world-list')).not.toHaveAttribute('data-state', 'loading')
  await page.getByTestId('import-input').setInputFiles({ name: 'rotas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FILE)) })
  await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
  await page.getByRole('button', { name: /^Reino das Rotas/ }).click()

  // Sem WebGL2, o mundo abre com o aviso no lugar do editor (AC-F1-20), e o fluxo não tem como rodar:
  // no Firefox do CI (Linux, sem GPU), o teste é pulado com o motivo. No Chrome, o aviso é falha.
  const notice = page.getByTestId('no-webgl2')
  await expect(page.getByTestId('editor').or(notice), 'nem o editor nem o aviso sem WebGL2 apareceram').toBeVisible({ timeout: 30_000 })
  const webgl2 = !(await notice.isVisible())
  const agent = await page.evaluate(() => navigator.userAgent)
  console.log(`[fluxos-m3] ${browserName}: WebGL2 ${webgl2 ? 'sim' : 'não'} · ${agent}`)
  if (!webgl2) {
    test.info().annotations.push({ type: 'sem WebGL2', description: agent })
    expect(browserName, 'o Chrome sempre tem WebGL2: o aviso aqui é um erro').not.toBe('chromium')
    test.skip(true, `${browserName} sem WebGL2 nesta máquina: o fluxo do editor não roda (AC-F1-20)`)
  }
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '5')
  await roadsAttr(page, 0)

  // 1. Rota automática (A) de Campo a Vale (AC-F5-12): a rota pelo terreno, ligada aos dois.
  await page.keyboard.press('a')
  await expect(map(page)).toHaveAttribute('data-tool', 'route')
  const hint = page.getByTestId('route-hint')
  await expect(hint).toHaveText('Clique no pin de origem')
  await clickPin(page, 'Campo')
  await expect(hint).toHaveText('Agora clique no pin de destino')
  await clickPin(page, 'Vale')
  await roadsAttr(page, 1)
  const toast = page.getByTestId('pin-deleted-toast')
  await expect(toast).toContainText('Rota criada')
  await expect.poll(() => roadNamed(page, 'Rota de Campo a Vale')).toMatchObject({ kind: 'road', from: 'Campo', to: 'Vale' })

  // 2. Porto a Ilha não tem caminho por terra: o toast oferece a rota marítima (AC-F5-13).
  await expect(hint).toHaveText('Clique no pin de origem')
  await clickPin(page, 'Porto')
  await expect(hint).toHaveText('Agora clique no pin de destino')
  await clickPin(page, 'Ilha')
  const noPath = page.getByTestId('no-path-toast')
  await expect(noPath).toContainText('Não há caminho por terra entre Porto e Ilha.', { timeout: 30_000 })
  await roadsAttr(page, 1)
  await noPath.getByRole('button', { name: 'Criar rota marítima' }).click()
  await roadsAttr(page, 2)
  await expect(noPath).toBeHidden()
  await expect.poll(() => roadNamed(page, 'Rota marítima de Porto a Ilha')).toMatchObject({ kind: 'sea', from: 'Porto', to: 'Ilha' })

  // 3. "Conectar cidades" (AC-F5-14): Campo e Vale já estão ligadas, e Porto e Ilha também (pela
  // rota marítima); a malha liga os grupos e a Serra com 2 estradas, num passo só do Desfazer.
  const connect = page.getByTestId('route-status').getByRole('button', { name: 'Conectar cidades' })
  await expect(connect).toBeEnabled()
  await connect.click()
  await roadsAttr(page, 4)
  await expect(toast).toContainText('2 estradas criadas')
  const network = await roadNames(page)
  expect(network).toEqual(['Rota de Campo a Vale', 'Rota de Porto a Vale', 'Rota de Vale a Serra', 'Rota marítima de Porto a Ilha'])
  await toast.getByRole('button', { name: 'Desfazer' }).click()
  await roadsAttr(page, 2)
  await page.keyboard.press('Control+Shift+z')
  await roadsAttr(page, 4)
  await expect.poll(() => roadNames(page)).toEqual(network)
  // De novo: tudo já ligado, nada novo.
  await connect.click()
  await expect(toast).toContainText('Nenhuma estrada nova: as cidades já estão ligadas', { timeout: 30_000 })
  await roadsAttr(page, 4)
  await page.keyboard.press('Escape')
  await expect(map(page)).toHaveAttribute('data-tool', 'nav')

  // 4. Desenhar estrada (R) de Serra a Campo, por um ponto solto (AC-F5-04, AC-F5-05): ligada aos
  // dois pins e selecionada, com o drawer aberto (AC-F5-06).
  await page.keyboard.press('r')
  await expect(map(page)).toHaveAttribute('data-tool', 'road')
  await clickPin(page, 'Serra')
  const mid = await screenOf(page, DRAWN_MID)
  await page.mouse.click(mid.x, mid.y)
  await expect(page.getByTestId('road-draw-layer')).toHaveAttribute('data-points', '2')
  const campo = await screenOf(page, PINS.Campo, 10)
  await page.mouse.dblclick(campo.x, campo.y)
  await roadsAttr(page, 5)
  await expect(map(page)).toHaveAttribute('data-tool', 'nav')
  await expect.poll(() => roadNamed(page, 'Nova estrada')).toMatchObject({ kind: 'road', from: 'Serra', to: 'Campo' })
  const drawn = (await roadNamed(page, 'Nova estrada'))!
  expect(drawn.points).toHaveLength(3)
  await expect(map(page)).toHaveAttribute('data-road-selected', drawn.id)
  const drawer = page.getByTestId('road-drawer')
  await expect(drawer).toBeVisible()
  await expect(page.getByTestId('road-ends').getByRole('button')).toHaveText(['Serra', 'Campo'])

  // 5. O drawer da estrada (AC-F5-07): renomear e trocar o tipo, cada um um passo no Desfazer.
  const name = drawer.getByRole('textbox', { name: 'Nome da estrada' })
  await expect(name).toHaveValue('Nova estrada')
  await name.fill('Estrada da Serra')
  await name.press('Enter')
  await expect.poll(async () => (await savedRoads(page)).find((r) => r.id === drawn.id)?.name).toBe('Estrada da Serra')
  await drawer.getByRole('button', { name: 'Trilha' }).click()
  await expect(drawer.getByRole('button', { name: 'Trilha' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await savedRoads(page)).find((r) => r.id === drawn.id)?.kind).toBe('trail')
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await savedRoads(page)).find((r) => r.id === drawn.id)?.kind).toBe('road')
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(async () => (await savedRoads(page)).find((r) => r.id === drawn.id)?.kind).toBe('trail')

  // 6. Excluir pelo drawer e desfazer pelo toast (AC-F5-08).
  const beforeDelete = await savedRoads(page)
  await drawer.getByRole('button', { name: 'Excluir estrada' }).click()
  await roadsAttr(page, 4)
  await expect(map(page)).toHaveAttribute('data-road-selected', '')
  await expect(toast).toContainText('Estrada excluída')
  // O drawer fechou: espera a linha inferior parar na borda direita antes de clicar no toast.
  await expect(page.getByTestId('bottom-bar')).toHaveCSS('right', '0px')
  await toast.getByRole('button', { name: 'Desfazer' }).click()
  await roadsAttr(page, 5)
  await expect.poll(() => savedRoads(page)).toEqual(beforeDelete)

  // 7. Recarregar mantém tudo (AC-F5-02): o mundo volta da Lista de mundos como estava.
  const [beforeReload] = await savedWorlds(page)
  await page.reload()
  await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
  await page.getByRole('button', { name: /^Reino das Rotas/ }).click()
  await waitFinalMap(page)
  await roadsAttr(page, 5)
  const [reloaded] = await readWorlds(page)
  expect(comparable(reloaded)).toEqual(comparable(beforeReload))
  // A estrada desenhada abre pela aba Conexões da Serra, com o nome e o tipo editados (AC-F5-15).
  await clickPin(page, 'Serra')
  await expect(map(page)).toHaveAttribute('data-pin-selected', 'Serra')
  const pinDrawer = page.getByTestId('pin-drawer')
  await pinDrawer.getByRole('tab', { name: 'Conexões' }).click()
  await expect(pinDrawer.getByRole('region', { name: 'Estradas (2)' }).getByRole('button')).toHaveText([
    /^ValeRota de Vale a Serra · Estrada · \d+ km$/,
    /^CampoEstrada da Serra · Trilha · \d+ km$/,
  ])

  // 8. Exportar pelo "⋯" do cartão e reimportar: o mundo novo é idêntico, com as estradas (AC-F5-02).
  await page.getByRole('button', { name: 'Voltar à lista de mundos' }).click()
  await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
  await page.getByRole('button', { name: 'Mais ações de Reino das Rotas' }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Exportar' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('reino-das-rotas.json')
  const text = await readFile((await download.path())!, 'utf8')
  expect((JSON.parse(text) as { world: { roads: unknown[] } }).world.roads).toEqual(beforeReload.roads)
  await page.getByTestId('import-input').setInputFiles({ name: 'reino-das-rotas.json', mimeType: 'application/json', buffer: Buffer.from(text) })
  await expect(page.getByTestId('world-count')).toHaveText('2 mundos')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const worlds = await readWorlds(page)
  const original = worlds.find((w) => w.id === beforeReload.id)!
  const copy = worlds.find((w) => w.id !== beforeReload.id)!
  expect(comparable(copy)).toEqual(comparable(original))

  // A cópia (no topo da lista) abre no editor com as 5 estradas.
  await page.getByRole('button', { name: /^Reino das Rotas/ }).first().click()
  await waitFinalMap(page)
  await roadsAttr(page, 5)

  expect(errors).toEqual([])
})
