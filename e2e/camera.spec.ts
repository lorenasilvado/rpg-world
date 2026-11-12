/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

// Câmera (#47, AC-F2-01 a AC-F2-06): pan, inércia, zoom no cursor, pinça, teclado, limites e
// movimento reduzido. O renderer expõe no mapa o retângulo dele na tela (`data-map-rect`) e o zoom
// relativo (`data-zoom`, 1 = mapa inteiro na área livre).

type Rect = { x: number; y: number; width: number; height: number }

// Desktop 1440×900: a área livre fica entre a sidebar (320) e o drawer (400).
const AREA = { x: 320, y: 0, width: 720, height: 900 }
const FIT: Rect = { x: 320, y: 90, width: 720, height: 720 }
const CENTER = { x: AREA.x + AREA.width / 2, y: AREA.height / 2 }

async function open(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  const map = page.getByTestId('map')
  await expect(map).toHaveAttribute('data-terrain-size', '1024', { timeout: 30_000 })
  await expect(map).toHaveAttribute('data-map-rect', /.+/)
}

async function rect(page: Page): Promise<Rect> {
  const [x, y, width, height] = ((await page.getByTestId('map').getAttribute('data-map-rect')) ?? '').split(',').map(Number)
  return { x, y, width, height }
}

const zoom = async (page: Page) => Number(await page.getByTestId('map').getAttribute('data-zoom'))

/** Espera a câmera parar (o retângulo igual em quadros seguidos) e devolve o retângulo. */
async function settled(page: Page): Promise<Rect> {
  let last = ''
  await expect
    .poll(async () => {
      const now = (await page.getByTestId('map').getAttribute('data-map-rect')) ?? ''
      const same = now === last
      last = now
      return same
    }, { intervals: [150] })
    .toBe(true)
  return rect(page)
}

/** Ponto do mundo (0–1024) que está em `p` na tela. */
const worldAt = (r: Rect, p: { x: number; y: number }) => ({ x: ((p.x - r.x) / r.width) * 1024, y: ((p.y - r.y) / r.height) * 1024 })

test('abre com o mapa inteiro, no zoom 1×', async ({ page }) => {
  await open(page)
  expect(await rect(page)).toEqual(FIT)
  expect(await zoom(page)).toBe(1)
})

test('AC-F2-01: arrastar com o mouse faz pan, com inércia ao soltar', async ({ page }) => {
  await open(page)
  // Aproxima antes, para o pan ter espaço dentro dos limites.
  await page.keyboard.press('+')
  await page.keyboard.press('+')
  const before = await settled(page)

  await page.mouse.move(CENTER.x, CENTER.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(CENTER.x - i * 12, CENTER.y - i * 8)
  const atRelease = await rect(page)
  await page.mouse.up()
  expect(atRelease.x).toBeLessThan(before.x - 60)
  expect(atRelease.y).toBeLessThan(before.y - 40)

  // A inércia continua o movimento depois de soltar, na mesma direção, e para.
  const after = await settled(page)
  expect(after.x).toBeLessThan(atRelease.x)
  expect(after.width).toBe(before.width)
})

test('AC-F2-01: arrastar com o dedo faz pan', async ({ page }) => {
  await open(page)
  await page.keyboard.press('+')
  const before = await settled(page)
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', CENTER.x, CENTER.y)
  for (let i = 1; i <= 8; i++) await touch('touchMove', CENTER.x + i * 10, CENTER.y)
  await touch('touchEnd', 0, 0)
  const after = await settled(page)
  expect(after.x).toBeGreaterThan(before.x + 50)
})

test('AC-F2-02: a roda do mouse faz zoom centrado no cursor', async ({ page }) => {
  await open(page)
  const cursor = { x: 500, y: 300 }
  const before = await rect(page)
  const target = worldAt(before, cursor)
  await page.mouse.move(cursor.x, cursor.y)
  await page.mouse.wheel(0, -300)
  const after = await settled(page)
  expect(after.width).toBeGreaterThan(before.width)
  expect(await zoom(page)).toBeGreaterThan(1)
  // O ponto do mundo sob o cursor continua sob o cursor (arredondamento de 1 px no retângulo).
  const now = worldAt(after, cursor)
  expect(Math.abs(now.x - target.x)).toBeLessThan(3)
  expect(Math.abs(now.y - target.y)).toBeLessThan(3)
})

test('AC-F2-03: a pinça faz zoom (touchpad e toque)', async ({ page }) => {
  await open(page)
  // Touchpad: o navegador entrega a pinça como wheel com Ctrl.
  await page.mouse.move(CENTER.x, CENTER.y)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -40)
  await page.keyboard.up('Control')
  await settled(page)
  const afterTrackpad = await zoom(page)
  expect(afterTrackpad).toBeGreaterThan(1)

  // Toque: dois dedos se afastando.
  const cdp = await page.context().newCDPSession(page)
  const pinch = (type: 'touchStart' | 'touchMove' | 'touchEnd', d: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints:
        type === 'touchEnd'
          ? []
          : [
              { x: CENTER.x - d, y: CENTER.y, id: 1 },
              { x: CENTER.x + d, y: CENTER.y, id: 2 },
            ],
    })
  await pinch('touchStart', 40)
  for (let d = 50; d <= 140; d += 10) await pinch('touchMove', d)
  await pinch('touchEnd', 0)
  await settled(page)
  expect(await zoom(page)).toBeGreaterThan(afterTrackpad * 1.5)
})

test('AC-F2-04: setas e WASD fazem pan, + e − fazem zoom e 0 centraliza', async ({ page }) => {
  await open(page)
  await page.keyboard.press('+')
  const zoomed = await settled(page)
  expect(await zoom(page)).toBeCloseTo(1.25, 2)
  // O zoom do teclado é no centro da área livre.
  const mid = worldAt(zoomed, CENTER)
  expect(Math.abs(mid.x - 512)).toBeLessThan(2)
  expect(Math.abs(mid.y - 512)).toBeLessThan(2)

  // → mostra o que está à direita: o mapa vai para a esquerda.
  for (const [k, axis, sign] of [
    ['ArrowRight', 'x', -1],
    ['ArrowLeft', 'x', 1],
    ['ArrowDown', 'y', -1],
    ['ArrowUp', 'y', 1],
    ['d', 'x', -1],
    ['a', 'x', 1],
    ['s', 'y', -1],
    ['w', 'y', 1],
  ] as const) {
    const before = await settled(page)
    await page.keyboard.press(k)
    const after = await settled(page)
    expect(Math.sign(after[axis] - before[axis]), k).toBe(sign)
  }

  await page.keyboard.press('-')
  await settled(page)
  expect(await zoom(page)).toBeCloseTo(1, 2)
  await page.keyboard.press('-')
  await settled(page)
  expect(await zoom(page)).toBeCloseTo(0.8, 2)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('0')
  expect(await settled(page)).toEqual(FIT)
  expect(await zoom(page)).toBe(1)
})

test('AC-F2-04: com o foco num campo, o teclado não move o mapa', async ({ page }) => {
  await open(page)
  // Um campo de teste (a sidebar ainda não tem sliders): o atalho fica com ele.
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.dataset.testid = 'campo'
    document.body.appendChild(input)
  })
  await page.getByTestId('campo').focus()
  await page.keyboard.press('+')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('d')
  await page.waitForTimeout(500)
  expect(await rect(page)).toEqual(FIT)
  await expect(page.getByTestId('campo')).toHaveValue('+d')
})

test('AC-F2-05: o zoom fica entre 0,4× e 4×, e o mapa não some da tela', async ({ page }) => {
  await open(page)
  await page.mouse.move(CENTER.x, CENTER.y)
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -400)
  await settled(page)
  expect(await zoom(page)).toBeCloseTo(4, 2)

  // Arrasta muito para um lado: pelo menos metade da área livre continua com mapa.
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) await page.mouse.move(CENTER.x + i * 100, CENTER.y + i * 100)
  await page.mouse.up()
  const far = await settled(page)
  expect(far.x).toBeLessThanOrEqual(CENTER.x + 1)
  expect(far.y).toBeLessThanOrEqual(CENTER.y + 1)

  // O arrasto terminou fora da área livre: a roda volta para o meio dela.
  await page.mouse.move(CENTER.x, CENTER.y)
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 400)
  await settled(page)
  expect(await zoom(page)).toBeCloseTo(0.4, 2)
  // Afastado, o mapa pequeno fica inteiro dentro da área livre, mesmo empurrado para fora.
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft')
  const small = await settled(page)
  expect(small.x).toBeGreaterThanOrEqual(AREA.x - 1)
  expect(small.x + small.width).toBeLessThanOrEqual(AREA.x + AREA.width + 1)
  expect(small.y).toBeGreaterThanOrEqual(-1)
  expect(small.y + small.height).toBeLessThanOrEqual(AREA.height + 1)
})

test('AC-F2-06: com movimento reduzido, a câmera salta direto e sem inércia', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.keyboard.press('+')
  // Sem deslizar: no quadro seguinte a câmera já está no destino.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  expect(await zoom(page)).toBeCloseTo(1.25, 2)

  await page.mouse.move(CENTER.x, CENTER.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(CENTER.x - i * 15, CENTER.y)
  const atRelease = await rect(page)
  await page.mouse.up()
  await page.waitForTimeout(400)
  expect(await rect(page)).toEqual(atRelease)

  await page.keyboard.press('0')
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  expect(await rect(page)).toEqual(FIT)
})

test('celular 390: abre com o mapa na largura toda, no zoom 1×', async ({ page }) => {
  await open(page, 390, 844)
  const r = await rect(page)
  expect(r).toEqual({ x: 0, y: 227, width: 390, height: 390 })
  expect(await zoom(page)).toBe(1)
})
