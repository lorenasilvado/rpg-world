/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import type { BenchReport } from '../src/bench/report.ts'

// Spike de desempenho (#9, RNF-2): a página /bench.html gera no worker e mede. Os tempos são
// medianas depois de uma geração de aquecimento; a máquina e os números vão para as anotações
// do teste (e para o PR).
test('a geração no worker atinge as metas, só o mais novo chega e a UI responde (AC-M0-13 a 15)', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/bench.html')
  await page.getByRole('button', { name: 'Medir' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-state', 'done', { timeout: 110_000 })
  const report = JSON.parse((await page.getByTestId('report').textContent()) ?? '') as BenchReport

  test.info().annotations.push(
    { type: 'máquina', description: `${report.machine.userAgent} · ${report.machine.cores} núcleos` },
    { type: 'prévia 256²', description: `mediana ${report.preview.median} ms, máx. ${report.preview.max} ms` },
    { type: 'mapa 1024²', description: `mediana ${report.map.median} ms, máx. ${report.map.max} ms` },
  )
  expect(report.visible).toBe(true)

  // AC-M0-13: metas de tempo, com os arrays transferidos sem cópia.
  expect(report.preview.median).toBeLessThanOrEqual(report.targets.previewMs)
  expect(report.map.median).toBeLessThanOrEqual(report.targets.mapMs)
  expect(report.transferred).toBe(true)

  // AC-M0-14: no arrasto, pedidos são descartados e só o mais novo chega, com o campo certo.
  expect(report.drag.delivered).toBeLessThan(report.drag.sent)
  expect(report.drag.onlyLatest).toBe(true)
  expect(report.drag.lastDeliveredVersion).toBe(report.drag.lastVersion)
  expect(report.drag.lastFieldMatches).toBe(true)

  // AC-M0-15: durante o mapa 1024² no worker, nenhum quadro da UI passa de 100 ms; na thread
  // principal, a mesma geração trava a UI pelo tempo inteiro dela.
  expect(report.mainThread).not.toBeNull()
  test.info().annotations.push({
    type: 'maior quadro da UI',
    description: `worker ${report.map.maxFrameGap} ms; thread principal ${report.mainThread!.maxFrameGap} ms`,
  })
  expect(report.map.maxFrameGap).toBeLessThan(100)
  expect(report.mainThread!.maxFrameGap).toBeGreaterThan(report.map.maxFrameGap)
  expect(errors).toEqual([])
})
