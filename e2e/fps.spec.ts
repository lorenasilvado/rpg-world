/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { summarizeFrames } from '../src/sprites/frameStats.ts'
import { defaultWorld, gotoEditor } from './editor.ts'

// Fps de pan, zoom e pinça com o app completo e 5.000 ícones decorativos (#55, AC-F2-07; critério
// de saída do M1) e, com 500 pins por cima, AC-F3-17 (#168; critério de saída do M2). Roda no projeto desempenho, sozinho e depois dos outros: em paralelo, a disputa
// pela CPU atrasa os quadros.
//
// O editor nunca passa de uns 3.600 ícones (a amostra de Poisson-disk inteira, com a distância
// mínima `DECOR_SPACING`), então o teste serve o `decor.ts` com uma distância menor: a amostra
// passa de 5.000 pontos, e o limite `MAX_DECOR` corta em 5.000. O resto do app é o de sempre:
// worker, renderer, culling, nível de detalhe, sidebar, drawer, minimapa e barras.
//
// Durante 30 s, o teste faz gestos de verdade (roda, Ctrl+roda da pinça do touchpad, pinça de dois
// dedos e arrasto), e um laço de requestAnimationFrame guarda o instante de cada quadro. A média e
// o mínimo (pior janela de 1 s) saem de `summarizeFrames`, a mesma conta do spike de 5.000 sprites.
// Com os 500 pins, cada arrasto começa num ponto sem pin nem grupo embaixo (o cursor do mapa diz),
// para ser pan, e não o arrasto de um pin.
//
// As metas só são conferidas fora do CI. No CI, sem GPU, o Chrome desenha por software e o número
// não vale; fora dele, um renderer por software faz o teste falhar, em vez de passar sem medir. A máquina, a GPU e os números vão para as anotações e para o
// anexo `fps-<AC>.json` (e para o PR). Para medir com a janela à vista:
// `npx playwright test e2e/fps.spec.ts --project=desempenho --no-deps --headed`.

const TYPES = ['cidade', 'vila', 'castelo', 'masmorra', 'npc', 'poi', 'custom'] as const

/** 500 pins numa grade de 25 × 20 sobre o mapa (de 0,12 a 0,88), com os 7 tipos alternados. */
function pins500() {
  return Array.from({ length: 500 }, (_, i) => {
    const type = TYPES[i % TYPES.length]
    const col = i % 25
    const row = Math.floor(i / 25)
    return {
      id: `p-${i}`,
      type,
      name: `Pin ${i + 1}`,
      pos: { u: 0.12 + (col * 0.76) / 24, v: 0.12 + (row * 0.76) / 19 },
      icon: { kind: 'builtin', key: type },
      description: '',
      tags: [],
      fields: {},
    }
  })
}

const CASES = [
  { ac: 'AC-F2-07', pins: 0, title: 'pan, zoom e pinça com 5.000 ícones e o app completo ficam em 60 fps de média e 55 de mínimo (AC-F2-07)' },
  { ac: 'AC-F3-17', pins: 500, title: 'pan, zoom e pinça com 500 pins, 5.000 ícones e o app completo ficam em 60 fps de média e 55 de mínimo (AC-F3-17)' },
]

const CONFERE_FPS = !process.env.CI
const DURATION_MS = 30_000
const TARGET_AVG = 60
const TARGET_MIN = 55
/** Renderers por software: neles o fps não vale para a meta. */
const SOFTWARE_GPU = /SwiftShader|llvmpipe|Software|Basic Render/i

const map = (page: Page) => page.getByTestId('map')
const zoom = async (page: Page) => Number(await map(page).getAttribute('data-zoom'))

// Desktop 1440×900: a área livre fica entre a sidebar (320) e o drawer (400).
const CENTER = { x: 320 + 360, y: 450 }

// Os dois casos um depois do outro, no mesmo worker: em paralelo, um atrasaria os quadros do outro.
test.describe.configure({ mode: 'default' })

for (const { ac, pins, title } of CASES) test(title, async ({ page, context }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await context.route(/\/src\/core\/decor\/decor\.ts/, async (route) => {
    const response = await route.fetch()
    const source = await response.text()
    const body = source.replace(/DECOR_SPACING = 0?\.013/, 'DECOR_SPACING = 0.005')
    expect(body, 'a distância mínima da decoração mudou: ajuste o teste').not.toBe(source)
    await route.fulfill({ response, body })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoEditor(page, '/', defaultWorld({ pins: pins === 0 ? [] : pins500() }))
  await expect(page.getByTestId('editor')).toHaveAttribute('data-generation-status', 'idle', { timeout: 60_000 })
  await expect(map(page)).toHaveAttribute('data-terrain-size', '1024', { timeout: 60_000 })
  await expect(map(page)).toHaveAttribute('data-decor-total', '5000')
  await expect(map(page)).toHaveAttribute('data-decor-layer', 'on')
  await expect(map(page)).toHaveAttribute('data-pins', String(pins))

  const machine = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      userAgent: navigator.userAgent,
      cores: navigator.hardwareConcurrency,
      gpu: gl ? String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null,
      screen: { cssWidth: innerWidth, cssHeight: innerHeight, devicePixelRatio },
    }
  })

  // Laço de quadros: o instante de cada um, e se a aba ficou escondida em algum momento.
  await page.evaluate(() => {
    const w = window as unknown as { __fps: { times: number[]; hidden: boolean; on: boolean } }
    w.__fps = { times: [], hidden: document.visibilityState !== 'visible', on: true }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') w.__fps.hidden = true
    })
    const tick = (t: number) => {
      if (!w.__fps.on) return
      w.__fps.times.push(t)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  const cdp = await context.newCDPSession(page)
  const touchPinch = async (from: number, to: number) => {
    const points = (d: number) => [
      { x: CENTER.x - d, y: CENTER.y, id: 1 },
      { x: CENTER.x + d, y: CENTER.y, id: 2 },
    ]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) })
    const step = (to - from) / 20
    for (let i = 1; i <= 20; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(from + step * i) })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const wheel = async (dy: number, times: number, ctrl = false) => {
    if (ctrl) await page.keyboard.down('Control')
    for (let i = 0; i < times; i++) {
      await page.mouse.wheel(0, dy)
      await page.waitForTimeout(30)
    }
    if (ctrl) await page.keyboard.up('Control')
  }
  /** Um ponto perto do centro sem pin nem grupo embaixo: apertar nele faz pan. */
  const freeSpot = async () => {
    for (const [ox, oy] of [[0, 0], [0, 30], [30, 0], [-30, 0], [0, -30], [30, 30], [-30, 30], [30, -30], [-30, -30], [0, 60], [60, 0], [-60, 0], [0, -60]]) {
      const at = { x: CENTER.x + ox, y: CENTER.y + oy }
      await page.mouse.move(at.x, at.y)
      if (pins === 0) return at
      await page.waitForTimeout(20)
      if (!/cursor-(pointer|zoom-in)/.test((await map(page).getAttribute('class')) ?? '')) return at
    }
    return null
  }
  let pinDrags = 0
  let pans = 0
  let skipped = 0
  const drag = async (dx: number, dy: number) => {
    const at = await freeSpot()
    if (!at) {
      skipped++
      return
    }
    pans++
    await page.mouse.down()
    await page.mouse.move(at.x + dx, at.y + dy, { steps: 40 })
    if ((await map(page).getAttribute('data-pin-dragging')) !== '') pinDrags++
    await page.mouse.up()
  }

  const zooms = new Set<number>()
  const rects = new Set<string>()
  const seen = async () => {
    zooms.add(await zoom(page))
    rects.add((await map(page).getAttribute('data-map-rect')) ?? '')
  }
  const start = Date.now()
  let cycles = 0
  while (Date.now() - start < DURATION_MS) {
    await page.mouse.move(CENTER.x, CENTER.y)
    await wheel(-120, 8) // zoom no cursor, para perto
    await seen()
    await drag(-220, -120) // pan, com inércia ao soltar
    await drag(260, 140)
    await seen()
    await wheel(20, 10, true) // pinça do touchpad, para longe
    await touchPinch(140, 40) // pinça de dois dedos, para longe
    await seen()
    await wheel(120, 8) // roda, até o mapa inteiro e menos (LOD)
    await drag(160, -90)
    await touchPinch(40, 140) // pinça de dois dedos, para perto
    await seen()
    cycles++
  }

  const recorded = await page.evaluate(() => {
    const w = window as unknown as { __fps: { times: number[]; hidden: boolean; on: boolean } }
    w.__fps.on = false
    return { times: w.__fps.times, hidden: w.__fps.hidden }
  })
  const stats = summarizeFrames(recorded.times)
  const drawn = Number(await map(page).getAttribute('data-decor-drawn'))
  const hardware = machine.gpu !== null && !SOFTWARE_GPU.test(machine.gpu)
  const report = {
    machine,
    ac,
    pins,
    pinDrags,
    pans,
    skipped,
    decor: { total: 5000, drawnAtEnd: drawn },
    durationMs: DURATION_MS,
    cycles,
    zoomRange: [Math.min(...zooms), Math.max(...zooms)],
    visible: !recorded.hidden,
    hardware,
    stats,
    pass: !recorded.hidden && hardware && stats.avgFps >= TARGET_AVG - 0.5 && stats.minFps >= TARGET_MIN,
  }
  await test.info().attach(`fps-${ac}.json`, { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
  test.info().annotations.push(
    { type: 'máquina', description: `${machine.userAgent} · ${machine.cores} núcleos` },
    { type: 'GPU', description: `${machine.gpu ?? 'sem WebGL2'}${hardware ? '' : ' (por software: não vale para a meta)'}` },
    { type: 'tela', description: `${machine.screen.cssWidth}×${machine.screen.cssHeight} CSS, DPR ${machine.screen.devicePixelRatio}` },
    {
      type: 'fps',
      description: `${pins} pins: média ${stats.avgFps}, mínimo ${stats.minFps} (pior janela de 1 s), pior quadro ${stats.worstFrameMs} ms, ${stats.slowFrames} quadros acima de 1/55 s, ${stats.frames} quadros em ${stats.durationMs} ms`,
    },
  )
  console.log(`[fps ${ac}] ${JSON.stringify(report)}`)

  // Os gestos aconteceram: o zoom passou do mapa inteiro para os dois lados, e o mapa andou.
  expect(cycles).toBeGreaterThan(0)
  expect(Math.max(...zooms)).toBeGreaterThan(1)
  expect(Math.min(...zooms)).toBeLessThan(1)
  expect(rects.size).toBeGreaterThan(2)
  expect(stats.frames).toBeGreaterThan(0)
  expect(report.visible, 'a aba ficou escondida: a medição não vale').toBe(true)
  expect(pinDrags, 'um arrasto pegou um pin em vez de fazer pan').toBe(0)
  // Sem ponto livre, o arrasto é pulado; a medição precisa ter pan de verdade.
  expect(pans, `${skipped} arrastos pulados sem ponto livre: a medição ficou sem pan`).toBeGreaterThan(0)

  if (CONFERE_FPS) {
    // Fora do CI, um verde por software não pode passar por medição do AC.
    expect(hardware, `sem GPU de verdade (${machine.gpu ?? 'sem WebGL2'}): a medição não vale; rode numa máquina com GPU`).toBe(true)
    // "60 fps de média" num monitor de 60 Hz: a média arredondada é 60.
    expect(stats.avgFps).toBeGreaterThanOrEqual(TARGET_AVG - 0.5)
    expect(stats.minFps).toBeGreaterThanOrEqual(TARGET_MIN)
  }
  expect(errors).toEqual([])
})
