/// <reference lib="dom" />
import { expect, type Locator, type Page } from '@playwright/test'
import { GENERATOR_VERSION } from '../src/core/types.ts'

/** O mundo como o app o salva (`World`, de `src/persistence/types.ts`), no que os testes usam. */
type World = {
  id: string
  name: string
  seed: string
  generatorVersion: number
  sizeKm: number
  params: Record<string, number>
  pins: unknown[]
  roads: unknown[]
  createdAt: string
  updatedAt: string
}

/**
 * O mundo padrão dos testes do editor: o nome e a seed do M1 (quando o app abria com eles atrás do
 * assistente), sem pins. Os parâmetros vão vazios: ao abrir, o app completa os que faltam com os
 * padrão (`worldStoreInitial`).
 */
export function defaultWorld(over: Partial<World> = {}): World {
  return {
    id: 'mundo-padrao',
    name: 'Terras de Valdora',
    seed: 'rpg-world',
    generatorVersion: GENERATOR_VERSION,
    sizeKm: 800,
    params: {},
    pins: [],
    roads: [],
    createdAt: '2026-11-21T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    ...over,
  }
}

/**
 * Grava mundos direto no IndexedDB do app (o banco do Dexie, `rpg-world`). A página precisa ter
 * aberto o banco antes (a Lista de mundos à vista); a lista só os mostra depois de recarregar.
 */
export async function putWorlds(page: Page, worlds: World[]) {
  await expect(page.getByTestId('world-list')).not.toHaveAttribute('data-state', 'loading')
  await page.evaluate(
    (records) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('rpg-world')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('worlds', 'readwrite')
          for (const record of records) tx.objectStore('worlds').put(record)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    worlds,
  )
}

/**
 * Abre o editor com o mundo padrão (`defaultWorld`, ou o `world` dado): cada teste tem um contexto
 * novo, com o banco vazio, então o mundo é gravado no IndexedDB, a página recarrega e o cartão dele é
 * aberto na Lista de mundos (a tela inicial).
 */
export async function gotoEditor(page: Page, url = '/', world = defaultWorld()) {
  await page.goto(url)
  await putWorlds(page, [world])
  await page.reload()
  await page.getByRole('button', { name: new RegExp(`^${world.name}`) }).click()
  await expect(page.getByTestId('editor').or(page.getByTestId('no-webgl2'))).toBeVisible()
}

/**
 * Os controles por cima do mapa (a barra de baixo, com o minimapa, a toolbar e o zoom, e as ações
 * do topo) ficam fora do print. O minimapa é translúcido, com `backdrop-blur`, e o Chrome às vezes
 * rasteriza o texto dele com um antisserrilhado um pouco diferente em outra aba: o mesmo mapa daria
 * prints diferentes (#199).
 */
const ONLY_THE_MAP = [
  '[data-testid="bottom-bar"], [data-testid="bottom-bar"] *,',
  '[data-testid="actions"], [data-testid="actions"] * { visibility: hidden !important; }',
].join(' ')

/** Print do retângulo do mapa (`data-map-rect`), só com o mapa (sem os controles por cima). */
export async function mapShot(page: Page) {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return page.screenshot({ clip: { x, y, width, height }, style: ONLY_THE_MAP })
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

/**
 * O tamanho da fonte (px) de cada campo de texto dentro de `root`, pelo rótulo acessível. O iOS
 * aproxima a página ao focar um campo com fonte menor que 16 px e não volta sozinho (#208, #210).
 */
export async function textFieldFontSizes(root: Locator) {
  return root.evaluate((el) =>
    Object.fromEntries(
      [...el.querySelectorAll<HTMLElement>('input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=range]), textarea, [contenteditable=true]')].map((field) => [
        field.getAttribute('aria-label') ?? document.querySelector(`label[for="${field.id}"]`)?.textContent?.trim() ?? field.id,
        parseFloat(getComputedStyle(field).fontSize),
      ]),
    ),
  )
}

/** Um pin no centro do mapa, para os testes que precisam do drawer aberto (AC-F3-19). */
export const centerPin = { id: 'p-centro', type: 'cidade', name: 'Centro', pos: { u: 0.5, v: 0.5 }, icon: { kind: 'builtin', key: 'cidade' }, description: '', tags: [], fields: {} }

/**
 * Abre o editor com um pin no centro do mapa e o seleciona: a partir de 768 px, o drawer entra e
 * a linha inferior e a barra do topo ficam à esquerda dele (sem pin, o drawer fica fora da tela).
 */
export async function gotoEditorWithDrawer(page: Page, url = '/') {
  await gotoEditor(page, url, defaultWorld({ pins: [centerPin] }))
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-pins', /\d/, { timeout: 45_000 })
  const [x, y, width, height] = ((await map.getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  await page.mouse.click(x + width / 2, y + height / 2 - 10)
  await expect(map).toHaveAttribute('data-pin-selected', centerPin.id)
  await expect.poll(async () => (await page.getByTestId('drawer').boundingBox())?.x).toBe(page.viewportSize()!.width - 400)
}
