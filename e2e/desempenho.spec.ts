/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import type { BenchReport, Timing } from '../src/bench/report.ts'

// Desempenho da geração (#9, #45, #36; RNF-2): a página /bench.html gera no worker, com o pipeline
// completo, e mede. Os tempos são medianas depois de uma geração de aquecimento, e também num
// worker recém-criado, sem aquecimento; a máquina e os números vão para as anotações do teste (e
// para o PR).
//
// As checagens de tempo só rodam fora do CI: o check `ci` é obrigatório e roda numa máquina
// compartilhada, onde uma lentidão do runner travaria o merge. No CI ficam as checagens que não
// dependem do tempo (memória, transferência sem cópia e ordem de entrega).
const CONFERE_TEMPO = !process.env.CI

test('a geração no worker atinge as metas, a prévia atualiza no arrasto e a UI responde (AC-F1-09 a 11)', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/bench.html')
  await page.getByRole('button', { name: 'Medir' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-state', 'done', { timeout: 170_000 })
  const report = JSON.parse((await page.getByTestId('report').textContent()) ?? '') as BenchReport
  const t = report.targets

  const timing = (label: string, x: Timing) => ({ type: label, description: `mediana ${x.median} ms, máx. ${x.max} ms` })
  test.info().annotations.push(
    { type: 'máquina', description: `${report.machine.userAgent} · ${report.machine.cores} núcleos` },
    timing('prévia 256², worker novo', report.coldPreview),
    timing('mapa 1024², worker novo', report.coldMap),
    timing('prévia 256², seed nova', report.preview),
    timing('mapa 1024², seed nova', report.map),
    timing('prévia 256², slider de limiar', report.previewSlider),
    timing('mapa 1024², slider de limiar', report.mapSlider),
    timing('mapa 1024², Tamanho do continente', report.mapShape),
    { type: 'memória do mundo', description: `${report.memory.worldBytes} bytes` },
    { type: 'arrasto', description: `${report.drag.sent} pedidos, ${report.drag.duringDrag} prévias exibidas` },
  )
  expect(report.visible).toBe(true)

  // #36: a primeira geração num worker recém-criado aparece no relatório, nos dois tamanhos.
  expect(report.coldPreview.size).toBe(256)
  expect(report.coldMap.size).toBe(1024)
  for (const x of [report.coldPreview, report.coldMap]) {
    expect(x.runs.length).toBeGreaterThan(0)
    expect(x.median).toBeGreaterThan(0)
    expect(x.workerMedian).toBeGreaterThan(0)
  }

  // AC-F1-09: metas de tempo com o pipeline completo, e memória do mundo.
  if (CONFERE_TEMPO) {
    for (const x of [report.preview, report.previewSlider]) expect(x.median).toBeLessThanOrEqual(t.previewMs)
    for (const x of [report.map, report.mapSlider, report.mapShape]) expect(x.median).toBeLessThanOrEqual(t.mapMs)
  }
  expect(report.memory.worldBytes).toBeGreaterThan(0)
  expect(report.memory.worldBytes).toBeLessThanOrEqual(t.worldBytes)
  expect(report.transferred).toBe(true)

  // AC-F1-10: no arrasto, o mapa continua atualizando, sempre do mais velho para o mais novo.
  expect(report.drag.inOrder).toBe(true)
  expect(report.drag.previewMatches).toBe(true)
  if (CONFERE_TEMPO) expect(report.drag.duringDrag).toBeGreaterThanOrEqual(5)
  // AC-F1-11: ao soltar, o mapa final 1024² substitui a prévia.
  expect(report.drag.release.size).toBe(1024)
  expect(report.drag.release.version).toBe(report.drag.release.lastVersion)
  expect(report.drag.release.matches).toBe(true)

  // Durante o mapa 1024² no worker, nenhum quadro da UI passa de 100 ms; na thread principal, a
  // mesma geração trava a UI pelo tempo inteiro dela.
  expect(report.mainThread).not.toBeNull()
  test.info().annotations.push({
    type: 'maior quadro da UI',
    description: `worker ${report.map.maxFrameGap} ms; thread principal ${report.mainThread!.maxFrameGap} ms`,
  })
  if (CONFERE_TEMPO) {
    expect(report.map.maxFrameGap).toBeLessThan(100)
    expect(report.mainThread!.maxFrameGap).toBeGreaterThan(report.map.maxFrameGap)
  }
  expect(errors).toEqual([])
})
