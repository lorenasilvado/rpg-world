/// <reference lib="dom" />
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, putWorlds } from './editor.ts'

// Exportar e importar o mundo em JSON (#164, AC-F4-09, AC-F4-10). Cada teste tem um contexto novo
// do navegador, então o banco começa vazio.

/** Um PNG de 1×1 de verdade (o renderer o decodifica). */
const PNG = [...Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')]

const pin = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'city',
  name: id,
  pos: { u: 0.4, v: 0.6 },
  icon: { kind: 'builtin', key: 'castle' },
  description: '<p>Capital do <strong>norte</strong></p>',
  tags: ['porto'],
  fields: { Governante: 'Rainha Ilsa' },
  ...over,
})

const VALDORA = defaultWorld({
  id: 'valdora',
  name: 'Terras de Valdora',
  seed: 'valdora-7f3a',
  params: { ocean: 62 } as never,
  pins: [pin('capital'), pin('torre', { type: 'custom', icon: { kind: 'image', blobId: 'img-1' }, parentId: 'capital' })] as never,
})

/** Grava a imagem do pin da torre direto no IndexedDB do app. */
async function putImage(page: Page) {
  await page.evaluate(
    (bytes) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('rpg-world')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('images', 'readwrite')
          tx.objectStore('images').put({ id: 'img-1', worldId: 'valdora', blob: new Blob([new Uint8Array(bytes)], { type: 'image/png' }) })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    PNG,
  )
}

/** Os mundos e as imagens do banco (as imagens como bytes). */
function readDb(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ worlds: Record<string, unknown>[]; images: { id: string; worldId: string; type: string; bytes: number[] }[] }>((resolve, reject) => {
        const open = indexedDB.open('rpg-world')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction(['worlds', 'images'], 'readonly')
          const worlds = tx.objectStore('worlds').getAll()
          const images = tx.objectStore('images').getAll()
          tx.oncomplete = async () => {
            db.close()
            const list = await Promise.all(
              (images.result as { id: string; worldId: string; blob: Blob }[]).map(async (i) => ({
                id: i.id,
                worldId: i.worldId,
                type: i.blob.type,
                bytes: [...new Uint8Array(await i.blob.arrayBuffer())],
              })),
            )
            resolve({ worlds: worlds.result, images: list })
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
}

async function setup(page: Page) {
  await page.goto('/')
  await putWorlds(page, [VALDORA])
  await putImage(page)
  await page.reload()
  await expect(page.getByTestId('world-count')).toHaveText('1 mundo')
}

/** Exporta pelo menu "⋯" do cartão e devolve o nome e o texto do arquivo baixado. */
async function exportFromCard(page: Page, name: string) {
  await page.getByRole('button', { name: `Mais ações de ${name}` }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Exportar' }).click()
  const download = await downloading
  return { fileName: download.suggestedFilename(), text: await readFile((await download.path())!, 'utf8') }
}

/** Solta um arquivo sobre o elemento, como o arrastar do explorador de arquivos. */
async function dropFile(page: Page, testId: string, name: string, text: string) {
  const dataTransfer = await page.evaluateHandle(
    ([name, text]) => {
      const dt = new DataTransfer()
      dt.items.add(new File([text], name, { type: 'application/json' }))
      return dt
    },
    [name, text],
  )
  await page.getByTestId(testId).dispatchEvent('dragover', { dataTransfer })
  await page.getByTestId(testId).dispatchEvent('drop', { dataTransfer })
}

test('exportar pelo "⋯" e importar o arquivo cria um mundo idêntico, com as imagens (AC-F4-09)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page)
  const { fileName, text } = await exportFromCard(page, 'Terras de Valdora')
  expect(fileName).toBe('terras-de-valdora.json')

  await page.getByTestId('import-input').setInputFiles({ name: fileName, mimeType: 'application/json', buffer: Buffer.from(text) })
  await expect(page.getByTestId('world-count')).toHaveText('2 mundos')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const { worlds, images } = await readDb(page)
  const original = worlds.find((w) => w.id === 'valdora')!
  const copy = worlds.find((w) => w.id !== 'valdora')!
  // O original foi salvo só com o oceano; o arquivo leva os parâmetros que faltam com o padrão.
  expect(copy.params).toMatchObject(original.params as Record<string, unknown>)
  expect(Object.keys(copy.params as object)).toHaveLength(9)
  const strip = ({ id: _id, createdAt: _c, updatedAt: _u, params: _p, pins, ...rest }: Record<string, unknown>) => ({
    ...rest,
    pins: (pins as { icon: { kind: string } }[]).map((p) => ({ ...p, icon: p.icon.kind === 'image' ? 'imagem' : p.icon })),
  })
  expect(strip(copy)).toEqual(strip(original))
  const copiedImage = images.find((i) => i.worldId === copy.id)!
  expect(copiedImage).toMatchObject({ type: 'image/png', bytes: PNG })
  expect((copy.pins as { icon: { blobId?: string } }[])[1].icon.blobId).toBe(copiedImage.id)

  // O mundo importado abre no editor com a mesma seed e os mesmos pins.
  await page.getByRole('button', { name: /^Terras de Valdora/ }).first().click()
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('valdora-7f3a')
})

for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`arquivo inválido mostra o modal com o motivo; outro arquivo entra sem fechar o modal (AC-F4-10, ${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await setup(page)
    const { text } = await exportFromCard(page, 'Terras de Valdora')

    // Um JSON editado à mão sem a seed.
    const noSeed = JSON.parse(text)
    delete noSeed.world.seed
    await page.getByTestId('import-input').setInputFiles({
      name: 'reino-antigo.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(noSeed)),
    })
    const dialog = page.getByRole('dialog', { name: 'Importar mundo' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('import-file-name')).toHaveText('reino-antigo.json')
    await expect(dialog.getByText('Não aceito')).toBeVisible()
    await expect(dialog.getByRole('alert')).toContainText('Este arquivo não é um mundo válido')
    await expect(dialog.getByTestId('import-reason')).toHaveText(
      'Falta a parte do terreno. Abra o mundo de origem, use Exportar › Arquivo do mundo (.json) e tente de novo.',
    )
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(16)
    expect(box.x + box.width).toBeLessThanOrEqual(width - 16)

    // Outro arquivo solto sobre o modal: um que não é JSON troca o motivo; o válido entra e fecha o modal.
    await dropFile(page, 'import-world-dialog', 'notas.txt', 'não é json')
    await expect(dialog).toHaveAttribute('data-reason', 'not-json')
    await expect(dialog.getByTestId('import-file-name')).toHaveText('notas.txt')
    await dropFile(page, 'import-world-dialog', 'valdora.json', text)
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('world-count')).toHaveText('2 mundos')
  })
}

test('"Escolher outro arquivo" abre o seletor e o arquivo escolhido é validado (AC-F4-10)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page)
  await dropFile(page, 'world-list', 'outro.json', '{"nome":"não é um mundo"}')
  const dialog = page.getByRole('dialog', { name: 'Importar mundo' })
  await expect(dialog).toHaveAttribute('data-reason', 'not-world')

  const choosing = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Escolher outro arquivo' }).click()
  const chooser = await choosing
  await chooser.setFiles({ name: 'vazio.json', mimeType: 'application/json', buffer: Buffer.from('') })
  await expect(dialog).toHaveAttribute('data-reason', 'not-json')
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Importar' })).toBeFocused()
})

for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`no editor, Exportar › Arquivo do mundo (.json) baixa o mundo como está na tela; o menu cabe na tela (AC-F4-09, ${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await setup(page)
    await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
    // Abaixo de 768 px, a seed fica no painel sobreposto: abre, troca e fecha (Esc).
    if (width < 768) await page.getByRole('button', { name: 'Abrir painel' }).click()
    const seed = page.getByRole('textbox', { name: 'Seed' })
    await seed.fill('valdora-2')
    await seed.press('Enter')
    if (width < 768) {
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Abrir painel' })).toBeVisible()
    }

    await page.getByRole('button', { name: 'Exportar', exact: true }).click()
    const menu = page.getByRole('menu', { name: 'Exportar' })
    await expect(menu).toBeInViewport({ ratio: 1 })
    const box = (await menu.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(8)
    expect(box.x + box.width).toBeLessThanOrEqual(width - 8)
    await expect(menu.getByRole('menuitem', { name: 'Arquivo do mundo (.json)' })).toBeFocused()
    await expect(menu.getByRole('menuitem', { name: 'Imagem (.png)' })).toBeEnabled()
    const downloading = page.waitForEvent('download')
    await menu.getByRole('menuitem', { name: 'Arquivo do mundo (.json)' }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toBe('terras-de-valdora.json')
    const file = JSON.parse(await readFile((await download.path())!, 'utf8'))
    expect(file.world.seed).toBe('valdora-2')
    expect(file.world.pins).toHaveLength(2)
    expect(file.images).toHaveLength(1)
    await expect(menu).toHaveCount(0)
  })
}
