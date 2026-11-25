/// <reference lib="dom" />
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { centerPin, defaultWorld, gotoEditor } from './editor.ts'

// Exportar › Imagem (.png) (#167, AC-F4-11). Cada teste tem um contexto novo do navegador, com o
// banco vazio; o mundo padrão tem um pin no centro do mapa.

const world = defaultWorld({ pins: [centerPin] })

/** Largura e altura do PNG, pelo cabeçalho (IHDR). */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

async function openEditor(page: Page) {
  await gotoEditor(page, '/', world)
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
}

/** Abre Exportar › Imagem (.png), escolhe a escala e os pins e baixa o PNG. */
async function exportPng(page: Page, { scale, pins }: { scale: 1 | 2 | 4; pins: boolean }) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  await page.getByRole('menu', { name: 'Exportar' }).getByRole('menuitem', { name: 'Imagem (.png)' }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar imagem' })
  await dialog.getByText(`${scale}×`, { exact: true }).click()
  await dialog.getByRole('checkbox', { name: 'Pins e rótulos' }).setChecked(pins)
  const downloading = page.waitForEvent('download', { timeout: 120_000 })
  await dialog.getByRole('button', { name: 'Baixar PNG' }).click()
  const download = await downloading
  await expect(dialog).toHaveCount(0)
  return { fileName: download.suggestedFilename(), bytes: await readFile((await download.path())!) }
}

/** A cor RGBA do PNG no ponto (u, v) do mapa, decodificada no navegador. */
async function pixel(page: Page, bytes: Buffer, u: number, v: number): Promise<number[]> {
  return page.evaluate(
    async ({ base64, u, v }) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      return [...ctx.getImageData(Math.floor(u * bitmap.width), Math.floor(v * bitmap.height), 1, 1).data]
    },
    { base64: bytes.toString('base64'), u, v },
  )
}

test('o modal escolhe a escala e os pins; baixar em 1× dá um PNG de 1024 × 1024 com o pin', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  const menu = page.getByRole('menu', { name: 'Exportar' })
  await expect(menu.getByRole('menuitem', { name: 'Imagem (.png)' })).toBeEnabled()
  await menu.getByRole('menuitem', { name: 'Imagem (.png)' }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar imagem' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio', { name: /^1×/ })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Pins e rótulos' })).toBeChecked()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeFocused()

  const withPins = await exportPng(page, { scale: 1, pins: true })
  expect(withPins.fileName).toBe('terras-de-valdora-1x.png')
  expect(pngSize(withPins.bytes)).toEqual({ width: 1024, height: 1024 })
  await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeFocused()

  const withoutPins = await exportPng(page, { scale: 1, pins: false })
  expect(pngSize(withoutPins.bytes)).toEqual({ width: 1024, height: 1024 })
  // Logo acima da ponta do pin (no centro do mapa), a imagem com pins tem o corpo dele; a sem, o terreno.
  const at = { u: 0.5, v: 0.5 - 16 / 1024 }
  expect(await pixel(page, withPins.bytes, at.u, at.v)).not.toEqual(await pixel(page, withoutPins.bytes, at.u, at.v))
})

test('em 2×, o terreno é gerado de novo em 2048² e o PNG tem 2048 × 2048', async ({ page }) => {
  test.setTimeout(180_000)
  await openEditor(page)
  const png = await exportPng(page, { scale: 2, pins: true })
  expect(png.fileName).toBe('terras-de-valdora-2x.png')
  expect(pngSize(png.bytes)).toEqual({ width: 2048, height: 2048 })
  // O editor segue com o mapa 1024²: o terreno grande foi gerado noutro worker.
  await expect(page.getByTestId('map')).toHaveAttribute('data-terrain-size', '1024')
})
