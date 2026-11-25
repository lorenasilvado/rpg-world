/// <reference lib="dom" />
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Fluxos de pins e de mundos do M2, de ponta a ponta (#168; critério de saída de
// docs/milestones/m2.md): criar um mundo pelo assistente, marcar pins com nome, descrição e tags,
// mover um, excluir outro e desfazer, recarregar a página, exportar o mundo em JSON e reimportá-lo.
// Cada parte tem o seu E2E detalhado (assistente, pins, drawer, salvar, lista e importar); aqui elas
// rodam em sequência, no mesmo mundo, no Chrome (projeto app), no Firefox e no WebKit.

// No Firefox e no WebKit do Playwright, sem GPU, cada mapa final leva alguns segundos.
test.describe.configure({ timeout: 240_000 })

type SavedPin = { id: string; type: string; name: string; pos: { u: number; v: number }; description: string; tags: string[]; [key: string]: unknown }
type SavedWorld = { id: string; name: string; seed: string; params: Record<string, number>; pins: SavedPin[]; [key: string]: unknown }

/** Os pins que o teste marca: nome, descrição (texto puro) e uma tag, em pontos afastados do mapa. */
const PINS = [
  { name: 'Valdora', description: 'Capital do norte, com o porto grande.', tag: 'capital', at: { u: 0.42, v: 0.45 } },
  { name: 'Vila do Vau', description: 'Vila de pescadores na beira do rio.', tag: 'porto', at: { u: 0.56, v: 0.5 } },
  { name: 'Torre Caída', description: 'Ruína onde o mago sumiu.', tag: 'ruína', at: { u: 0.48, v: 0.6 } },
]
/** Para onde a Vila do Vau é arrastada. */
const MOVED = { u: 0.6, v: 0.4 }

const map = (page: Page) => page.getByTestId('map')
const nameField = (page: Page) => page.getByRole('textbox', { name: 'Nome do pin' })

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 60_000 })
  await expect(map(page)).toHaveAttribute('data-terrain-size', '1024', { timeout: 60_000 })
}

/** Espera a câmera parar (o retângulo do mapa igual por 400 ms, mais que o deslizamento de 350 ms). */
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
      return Date.now() - since >= 400
    }, { intervals: [100], timeout: 30_000 })
    .toBe(true)
  const [x, y, width, height] = last.split(',').map(Number)
  return { x, y, width, height }
}

/** O ponto da tela da posição (u, v), com a câmera parada. */
async function screenOf(page: Page, at: { u: number; v: number }) {
  const r = await settledRect(page)
  return { x: r.x + at.u * r.width, y: r.y + at.v * r.height }
}

/** Clica no desenho do pin (10 px acima da âncora, na base). */
async function clickPin(page: Page, at: { u: number; v: number }) {
  const p = await screenOf(page, at)
  await page.mouse.click(p.x, p.y - 10)
}

/** Fecha o drawer pelo Fechar dele e espera a seleção sair (AC-F3-19). */
async function closeDrawer(page: Page) {
  await page.getByTestId('pin-drawer').getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(map(page)).toHaveAttribute('data-pin-selected', '')
}

/** Os mundos do banco, depois do Salvo. */
async function savedWorlds(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-status', 'saved')
  return readWorlds(page)
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

/** O mundo sem o que muda numa cópia (id e datas), com os pins pelo nome. */
const comparable = ({ id: _id, createdAt: _c, updatedAt: _u, ...rest }: SavedWorld) => rest

test('cria um mundo, marca, edita, move, exclui e desfaz pins, recarrega, exporta e reimporta (critério de saída do M2)', async ({ page, browserName }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  // 1. Criar um mundo pelo assistente, a partir da Lista de mundos vazia (AC-F4-05, AC-F4-06, AC-F1-19).
  const wizard = page.getByRole('dialog', { name: 'Novo mundo' })
  await page.getByRole('button', { name: 'Criar meu primeiro mundo' }).click()
  await wizard.getByRole('textbox', { name: 'Nome do mundo' }).fill('Reino de Ostra')
  await wizard.getByRole('textbox', { name: /^Seed/ }).fill('ostra-168')
  await wizard.getByRole('button', { name: 'Criar mundo' }).click()
  await expect(wizard).toBeHidden()

  // Sem WebGL2, o mundo abre com o aviso no lugar do editor (AC-F1-20, AC-F4-12), e o fluxo não tem
  // como rodar: no Firefox do CI (Linux, sem GPU), o teste é pulado com o motivo. No Chrome, que
  // sempre tem WebGL2 (por software no CI), o aviso é falha.
  const notice = page.getByTestId('no-webgl2')
  await expect(page.getByTestId('editor').or(notice), 'nem o editor nem o aviso sem WebGL2 apareceram').toBeVisible({ timeout: 30_000 })
  const webgl2 = !(await notice.isVisible())
  const agent = await page.evaluate(() => navigator.userAgent)
  console.log(`[fluxos-m2] ${browserName}: WebGL2 ${webgl2 ? 'sim' : 'não'} · ${agent}`)
  if (!webgl2) {
    test.info().annotations.push({ type: 'sem WebGL2', description: agent })
    expect(browserName, 'o Chrome sempre tem WebGL2: o aviso aqui é um erro').not.toBe('chromium')
    test.skip(true, `${browserName} sem WebGL2 nesta máquina: o fluxo do editor não roda (AC-F1-20)`)
  }
  await expect(page.getByTestId('world-name')).toHaveText('Reino de Ostra')
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '0')

  // 2. Marcar 3 pins com P, cada um com nome, descrição e tag (AC-F3-01, AC-F3-06 a AC-F3-08).
  for (const [i, pin] of PINS.entries()) {
    await page.keyboard.press('p')
    await expect(map(page)).toHaveAttribute('data-tool', 'pin')
    const at = await screenOf(page, pin.at)
    await page.mouse.click(at.x, at.y)
    await expect(map(page)).toHaveAttribute('data-pins', String(i + 1))
    await expect(nameField(page)).toBeFocused()
    await expect(nameField(page)).toHaveValue('Novo pin')
    await page.keyboard.type(pin.name)
    await page.keyboard.press('Enter')
    await page.getByRole('textbox', { name: 'Descrição' }).click()
    await page.keyboard.type(pin.description)
    await page.getByRole('textbox', { name: 'Nova tag' }).fill(pin.tag)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('pin-tag')).toHaveText([pin.tag])
    await closeDrawer(page)
  }
  let [world] = await savedWorlds(page)
  expect(world.pins.map((p) => [p.name, p.type, p.description, p.tags])).toEqual(
    PINS.map((p) => [p.name, 'cidade', `<p>${p.description}</p>`, [p.tag]]),
  )
  for (const [i, pin] of PINS.entries()) {
    expect(world.pins[i].pos.u, pin.name).toBeCloseTo(pin.at.u, 2)
    expect(world.pins[i].pos.v, pin.name).toBeCloseTo(pin.at.v, 2)
  }

  // 3. Editar: o nome da Torre pelo drawer (AC-F3-06).
  await clickPin(page, PINS[2].at)
  await expect(nameField(page)).toHaveValue('Torre Caída')
  await nameField(page).fill('Torre do Mago')
  await nameField(page).press('Enter')
  await closeDrawer(page)
  ;[world] = await savedWorlds(page)
  expect(world.pins[2].name).toBe('Torre do Mago')

  // 4. Mover a Vila do Vau, arrastando (AC-F3-04).
  const from = await screenOf(page, PINS[1].at)
  const to = await screenOf(page, MOVED)
  await page.mouse.move(from.x, from.y - 10)
  await page.mouse.down()
  await page.mouse.move(from.x + 20, from.y - 30, { steps: 4 })
  await page.mouse.move(to.x, to.y - 10, { steps: 8 })
  await expect(map(page)).toHaveAttribute('data-pin-dragging', world.pins[1].id)
  await page.mouse.up()
  await expect(map(page)).toHaveAttribute('data-pin-dragging', '')
  await expect
    .poll(async () => {
      const [w] = await savedWorlds(page)
      return [Number(w.pins[1].pos.u.toFixed(2)), Number(w.pins[1].pos.v.toFixed(2))]
    })
    .toEqual([MOVED.u, MOVED.v])

  // 5. Excluir a Valdora pela tecla Delete e desfazer pelo toast: ela volta com a ficha (AC-F3-05, AC-F4-08).
  ;[world] = await savedWorlds(page)
  const beforeDelete = world.pins
  await clickPin(page, PINS[0].at)
  await expect(map(page)).toHaveAttribute('data-pin-selected', beforeDelete[0].id)
  await page.mouse.move(10, 450)
  await page.keyboard.press('Delete')
  await expect(map(page)).toHaveAttribute('data-pins', '2')
  const toast = page.getByTestId('pin-deleted-toast')
  await expect(toast).toContainText('Pin excluído')
  await expect.poll(async () => (await savedWorlds(page))[0].pins.map((p) => p.name)).toEqual(['Vila do Vau', 'Torre do Mago'])
  await toast.getByRole('button', { name: 'Desfazer' }).click()
  await expect(map(page)).toHaveAttribute('data-pins', '3')
  await expect.poll(async () => (await savedWorlds(page))[0].pins).toEqual(beforeDelete)

  // 6. Recarregar mantém tudo (AC-F4-01): o mundo volta da Lista de mundos como estava.
  const [beforeReload] = await savedWorlds(page)
  await page.reload()
  await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
  await page.getByRole('button', { name: /^Reino de Ostra/ }).click()
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '3')
  const [reloaded] = await readWorlds(page)
  expect(comparable(reloaded)).toEqual(comparable(beforeReload))
  await clickPin(page, MOVED)
  await expect(nameField(page)).toHaveValue('Vila do Vau')
  await expect(page.getByRole('textbox', { name: 'Descrição' })).toHaveText(PINS[1].description)
  await expect(page.getByTestId('pin-tag')).toHaveText([PINS[1].tag])
  await closeDrawer(page)

  // 7. Exportar pelo "⋯" do cartão e reimportar: o mundo novo é idêntico (AC-F4-09).
  await page.getByRole('button', { name: 'Voltar à lista de mundos' }).click()
  await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
  await page.getByRole('button', { name: 'Mais ações de Reino de Ostra' }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Exportar' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('reino-de-ostra.json')
  const text = await readFile((await download.path())!, 'utf8')
  await page.getByTestId('import-input').setInputFiles({ name: 'reino-de-ostra.json', mimeType: 'application/json', buffer: Buffer.from(text) })
  await expect(page.getByTestId('world-count')).toHaveText('2 mundos')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const worlds = await readWorlds(page)
  const original = worlds.find((w) => w.id === beforeReload.id)!
  const copy = worlds.find((w) => w.id !== beforeReload.id)!
  expect(comparable(copy)).toEqual(comparable(original))

  // O mundo importado (no topo da lista) abre no editor com a mesma seed e os mesmos pins.
  await page.getByRole('button', { name: /^Reino de Ostra/ }).first().click()
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('ostra-168')
  await waitFinalMap(page)
  await expect(map(page)).toHaveAttribute('data-pins', '3')
  await clickPin(page, PINS[2].at)
  await expect(nameField(page)).toHaveValue('Torre do Mago')

  expect(errors).toEqual([])
})
