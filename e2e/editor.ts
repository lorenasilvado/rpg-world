/// <reference lib="dom" />
import { expect, type Page } from '@playwright/test'
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
