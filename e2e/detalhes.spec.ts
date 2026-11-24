/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultWorld, gotoEditor } from './editor.ts'

// Aba Detalhes do drawer (#160): tipo, ícone, imagem enviada e campos livres (AC-F3-10, AC-F3-11).

type SavedPin = { id: string; type: string; icon: { kind: string; key?: string; blobId?: string }; fields: Record<string, string> }

const valdora = () =>
  defaultWorld({
    pins: [
      {
        id: 'p-valdora',
        type: 'cidade',
        name: 'Valdora',
        pos: { u: 0.45, v: 0.5 },
        icon: { kind: 'builtin', key: 'cidade' },
        description: '',
        tags: [],
        fields: { rei: 'Aldo' },
      },
    ],
  })

async function waitFinalMap(page: Page) {
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 30_000 })
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

/** O ponto da tela de (u, v), e o centro do círculo do pin ali (a 21,6 px da âncora: 27 de 48 no viewBox, 32 px de largura). */
async function screenOf(page: Page, u: number, v: number) {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return { x: x + u * width, y: y + v * height, circleY: y + v * height - (27 * 32) / 40 }
}

async function openValdora(page: Page) {
  const p = await screenOf(page, 0.45, 0.5)
  await page.mouse.click(p.x, p.y - 10)
  await expect(page.getByTestId('map')).toHaveAttribute('data-pin-selected', 'p-valdora')
  await page.getByRole('tab', { name: 'Detalhes' }).click()
}

/** Uma imagem de `width` × `height` px numa cor só, como PNG, desenhada no navegador. */
async function solidPng(page: Page, color: string, width: number, height: number): Promise<Buffer> {
  const b64 = await page.evaluate(
    ({ color, width, height }) => {
      const canvas = Object.assign(document.createElement('canvas'), { width, height })
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = color
      ctx.fillRect(0, 0, width, height)
      return canvas.toDataURL('image/png').split(',')[1]
    },
    { color, width, height },
  )
  return Buffer.from(b64, 'base64')
}

/** A cor (r, g, b) do pixel da tela em (x, y). */
async function pixel(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const shot = await page.screenshot({ clip: { x: Math.round(x) - 1, y: Math.round(y) - 1, width: 3, height: 3 } })
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height })
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const [r, g, b] = ctx.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data
    return [r, g, b] as [number, number, number]
  }, shot.toString('base64'))
}

/** Os pins gravados e o tamanho de cada imagem guardada, depois de o indicador dizer "Salvo". */
async function saved(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-status', 'saved')
  return page.evaluate(
    () =>
      new Promise<{ pins: SavedPin[]; images: { id: string; worldId: string; type: string; width: number; height: number }[] }>((resolve) => {
        const open = indexedDB.open('rpg-world')
        open.onsuccess = () => {
          const tx = open.result.transaction(['worlds', 'images'])
          const world = tx.objectStore('worlds').get('mundo-padrao')
          const all = tx.objectStore('images').getAll()
          tx.oncomplete = async () => {
            const images = await Promise.all(
              (all.result as { id: string; worldId: string; blob: Blob }[]).map(async (image) => {
                const bitmap = await createImageBitmap(image.blob)
                return { id: image.id, worldId: image.worldId, type: image.blob.type, width: bitmap.width, height: bitmap.height }
              }),
            )
            open.result.close()
            resolve({ pins: world.result.pins, images })
          }
        }
      }),
  )
}

const drawer = (page: Page) => page.getByTestId('pin-drawer')
const fileInput = (page: Page) => drawer(page).locator('input[type="file"]')

test('Detalhes: troca o tipo, recusa .gif e a imagem acima de 1 MB, envia SVG e PNG, edita os campos e tudo volta ao recarregar (AC-F3-10, AC-F3-11)', async ({ page }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoEditor(page, '/', valdora())
  await waitFinalMap(page)
  await openValdora(page)
  const panel = page.getByRole('tabpanel', { name: 'Detalhes' })
  await expect(panel.getByRole('radio', { name: 'Cidade' })).toBeChecked()
  await info.attach('detalhes-1440.png', { body: await page.screenshot(), contentType: 'image/png' })

  // O tipo, pela biblioteca embutida.
  await panel.getByText('Masmorra', { exact: true }).click()
  await expect(drawer(page).getByTestId('pin-drawer-type')).toHaveText('Masmorra')

  // Outro formato: recusado, e o ícone continua.
  await fileInput(page).setInputFiles({ name: 'dragao.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
  await expect(panel.getByRole('alert')).toHaveText('Formato não aceitoEnvie uma imagem PNG, JPG ou SVG.')
  await info.attach('detalhes-formato.png', { body: await drawer(page).screenshot(), contentType: 'image/png' })
  await expect(drawer(page).getByTestId('pin-drawer-type')).toHaveText('Masmorra')

  // Acima de 1 MB: a pergunta; Recusar deixa o ícone.
  await fileInput(page).setInputFiles({ name: 'mapa.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
  const ask = panel.getByRole('alertdialog', { name: 'Imagem acima de 1 MB' })
  await expect(ask).toContainText('“mapa.png” tem 2 MB, e o limite é 1 MB.')
  await expect(ask.getByRole('button', { name: 'Aceitar com redução' })).toBeFocused()
  await info.attach('detalhes-grande.png', { body: await drawer(page).screenshot(), contentType: 'image/png' })
  await ask.getByRole('button', { name: 'Recusar' }).click()
  await expect(ask).toBeHidden()
  await expect(drawer(page).getByTestId('pin-drawer-type')).toHaveText('Masmorra')

  // SVG: vira PNG de 256 px (o lado maior), no círculo do Personalizado.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><rect width="1000" height="500" fill="#2050E0"/></svg>'
  await fileInput(page).setInputFiles({ name: 'brasao.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) })
  await expect(drawer(page).getByTestId('pin-drawer-type')).toHaveText('Personalizado')
  await expect(drawer(page).getByTestId('pin-drawer-icon').getByTestId('pin-icon-image')).toHaveAttribute('href', /^blob:/)

  // SVG só com viewBox: desenhado com o lado maior em 256 px, na proporção do viewBox.
  const unsized = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10" fill="#20A050"/></svg>'
  await fileInput(page).setInputFiles({ name: 'faixa.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(unsized) })
  await expect(panel.getByRole('button', { name: 'Remover imagem' })).toBeVisible()

  // PNG de 512 px: reduzido para 256.
  await fileInput(page).setInputFiles({ name: 'brasao.png', mimeType: 'image/png', buffer: await solidPng(page, '#E02020', 512, 512) })
  await expect(panel.getByRole('button', { name: 'Remover imagem' })).toBeVisible()
  await expect(panel.getByRole('radio', { name: 'Personalizado' })).toBeChecked()

  // Os campos: renomear a chave, mudar o valor e adicionar outro.
  const key = panel.getByRole('textbox', { name: 'Campo' }).first()
  await key.fill('Governante')
  await key.press('Enter')
  await panel.getByRole('textbox', { name: 'Valor de Governante' }).fill('Aldo II')
  await panel.getByRole('button', { name: 'Adicionar campo' }).click()
  await expect(panel.getByRole('textbox', { name: 'Campo' }).nth(1)).toBeFocused()
  await page.keyboard.type('População')
  await page.keyboard.press('Tab')
  await page.keyboard.type('12 mil')
  await page.keyboard.press('Tab')
  await info.attach('detalhes-imagem.png', { body: await drawer(page).screenshot(), contentType: 'image/png' })

  const before = await saved(page)
  const [pin] = before.pins
  expect(pin).toMatchObject({ type: 'custom', icon: { kind: 'image' }, fields: { Governante: 'Aldo II', População: '12 mil' } })
  expect(Object.keys(pin.fields)).toEqual(['Governante', 'População'])
  const stored = before.images.find((i) => i.id === pin.icon.blobId)
  expect(stored).toEqual({ id: pin.icon.blobId, worldId: 'mundo-padrao', type: 'image/png', width: 256, height: 256 })
  // As duas do SVG (1000 × 500 e só viewBox 20 × 10) ficam com 256 × 128.
  const fromSvg = before.images.filter((i) => i.id !== pin.icon.blobId)
  expect(fromSvg.map((i) => [i.type, i.width, i.height])).toEqual([
    ['image/png', 256, 128],
    ['image/png', 256, 128],
  ])

  // Ao recarregar, a imagem volta no mapa e no drawer, com os campos.
  await page.reload()
  await page.getByRole('button', { name: /^Terras de Valdora/ }).click()
  await waitFinalMap(page)
  await page.mouse.move(5, 450)
  const p = await screenOf(page, 0.45, 0.5)
  await expect
    .poll(async () => {
      const [r, g, b] = await pixel(page, p.x, p.circleY)
      return r > 180 && g < 80 && b < 80
    }, { timeout: 10_000 })
    .toBe(true)
  await info.attach('mapa-pin-imagem.png', {
    body: await page.screenshot({ clip: { x: p.x - 60, y: p.y - 70, width: 120, height: 90 } }),
    contentType: 'image/png',
  })
  await openValdora(page)
  await expect(drawer(page).getByTestId('pin-drawer-icon').getByTestId('pin-icon-image')).toHaveAttribute('href', /^blob:/)
  await expect(panel.getByRole('radio', { name: 'Personalizado' })).toBeChecked()
  await expect(panel.getByRole('textbox', { name: 'Valor de Governante' })).toHaveValue('Aldo II')
  await expect(panel.getByRole('textbox', { name: 'Valor de População' })).toHaveValue('12 mil')

  // Tablet e celular (abaixo de 768 px, o drawer é o painel sobreposto).
  for (const [w, h] of [
    [1024, 768],
    [390, 844],
  ]) {
    await page.getByRole('button', { name: /^Fechar( detalhes)?$/ }).filter({ visible: true }).click()
    await expect(page.getByTestId('map')).not.toHaveAttribute('data-pin-selected', /./)
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(400)
    await openValdora(page)
    await expect(panel.getByRole('radio', { name: 'Personalizado' })).toBeChecked()
    await info.attach(`detalhes-${w}.png`, { body: await page.screenshot(), contentType: 'image/png' })
  }
})
