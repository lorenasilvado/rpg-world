import { expect, test } from '@playwright/test'

test.describe('Layout vazio do editor', () => {
  test('desktop 1440×900: sidebar de 320 px, mapa e drawer de 400 px (AC-M0-01)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const sidebar = await page.getByTestId('sidebar').boundingBox()
    const drawer = await page.getByTestId('drawer').boundingBox()
    const map = await page.getByTestId('map').boundingBox()
    expect(sidebar).toMatchObject({ x: 0, width: 320, height: 900 })
    expect(drawer).toMatchObject({ x: 1040, width: 400, height: 900 })
    expect(map).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 })
    await expect(page.getByRole('button', { name: 'Abrir painel' })).toBeHidden()
  })

  test('cores, fonte e raios vêm do design system (AC-M0-01)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const sidebar = page.getByTestId('sidebar')
    await expect(sidebar).toHaveCSS('background-color', 'rgb(247, 241, 227)')
    await expect(page.locator('body')).toHaveCSS('font-family', /Nunito/)
    await expect(page.getByTestId('actions')).toHaveCSS('border-radius', '12px')
    await expect(page.getByTestId('map')).toHaveCSS('background-color', 'rgb(31, 78, 121)')
  })

  test('abaixo de 768 px, sidebar e drawer viram painéis sobrepostos (AC-M0-02)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByTestId('sidebar')).toBeHidden()
    await expect(page.getByTestId('drawer')).toBeHidden()
    await expect(page.getByTestId('map')).toBeVisible()

    await page.getByRole('button', { name: 'Abrir painel' }).click()
    const sidebar = page.getByTestId('sidebar')
    await expect(sidebar).toBeVisible()
    await expect(page.getByTestId('scrim')).toBeVisible()
    await expect.poll(async () => (await sidebar.boundingBox())?.x).toBe(0)
    await page.getByRole('button', { name: 'Fechar painel' }).click()
    await expect(sidebar).toBeHidden()

    await page.getByRole('button', { name: 'Abrir detalhes' }).click()
    const drawer = page.getByTestId('drawer')
    await expect(drawer).toBeVisible()
    await expect.poll(async () => (await drawer.boundingBox())?.width).toBe(390)
    await page.getByRole('button', { name: 'Fechar detalhes' }).click()
    await expect(drawer).toBeHidden()
  })

  test('o tema alterna entre claro e escuro, só mudando as cores (AC-M0-03)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const sidebar = page.getByTestId('sidebar')
    const before = await sidebar.boundingBox()
    await expect(sidebar).toHaveCSS('background-color', 'rgb(247, 241, 227)')
    await page.getByRole('button', { name: 'Usar tema escuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(sidebar).toHaveCSS('background-color', 'rgb(30, 27, 24)')
    expect(await sidebar.boundingBox()).toEqual(before)
    await page.getByRole('button', { name: 'Usar tema claro' }).click()
    await expect(sidebar).toHaveCSS('background-color', 'rgb(247, 241, 227)')
  })
})
