import '../index.css'
import { createGenerator } from '../workers/generatorClient'
import { FULL, QUICK, runBench, TARGETS, type BenchReport, type Timing } from './runBench'

/**
 * Página de medição do spike de desempenho (#9), em /bench.html. `?rapido` roda menos vezes
 * (usado pelo E2E do build).
 */
const quick = new URLSearchParams(location.search).has('rapido')

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} não encontrado`)
  return el as T
}

const button = $<HTMLButtonElement>('run')
const status = $('status')
const results = $('results')
const json = $('json')
const dot = $('dot')
const frameCount = $('frames')

$('machine').textContent = `${navigator.userAgent} · ${navigator.hardwareConcurrency} núcleos lógicos${quick ? ' · modo rápido' : ''}`

// Indicador de que a UI responde: anda a cada quadro pelo requestAnimationFrame (JS na thread
// principal). Se a thread travar, ele para.
let frames = 0
const animate = (t: number) => {
  frames++
  dot.style.transform = `translateX(${((t / 8) % 100).toFixed(1)}cqw)`
  frameCount.textContent = String(frames)
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)

const ok = (pass: boolean) => (pass ? '✓' : '✗')

function timingRow(label: string, t: Timing, target: number): string {
  return `<tr>
    <td class="py-1 pr-4">${label}</td>
    <td class="pr-4 text-right font-mono">${t.median}</td>
    <td class="pr-4 text-right font-mono">${t.max}</td>
    <td class="pr-4 text-right font-mono">${t.workerMedian}</td>
    <td class="pr-4 text-right font-mono">${target}</td>
    <td class="pr-4 text-right font-mono">${t.maxFrameGap}</td>
    <td>${ok(t.median <= target)}</td>
  </tr>`
}

function render(r: BenchReport) {
  const d = r.drag
  results.innerHTML = `
    <table class="text-sm">
      <thead class="text-ink-2"><tr>
        <th class="pr-4 text-left font-normal">Geração</th>
        <th class="pr-4 text-right font-normal">Mediana (ms)</th>
        <th class="pr-4 text-right font-normal">Máx. (ms)</th>
        <th class="pr-4 text-right font-normal">No worker (ms)</th>
        <th class="pr-4 text-right font-normal">Meta (ms)</th>
        <th class="pr-4 text-right font-normal">Maior quadro (ms)</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${timingRow(`Prévia ${r.preview.size}²`, r.preview, TARGETS.previewMs)}
        ${timingRow(`Mapa ${r.map.size}²`, r.map, TARGETS.mapMs)}
      </tbody>
    </table>
    <ul class="mt-3 space-y-1 text-sm">
      ${r.visible ? '' : '<li>✗ A aba ficou escondida durante a medição: o maior quadro e o arrasto não valem. Meça de novo com a aba à vista.</li>'}
      <li>${ok(r.transferred)} Arrays transferidos sem cópia (buffers vazios no worker depois do envio)</li>
      <li>${ok(d.onlyLatest && d.lastDeliveredVersion === d.lastVersion && d.lastFieldMatches)}
        Arrasto: ${d.sent} pedidos, ${d.delivered} entregues, ${d.sent - d.delivered} descartados;
        só o mais novo chega (último entregue: v${d.lastDeliveredVersion} de v${d.lastVersion})</li>
      ${
        r.mainThread
          ? `<li>Referência: o mapa ${r.map.size}² na thread principal leva ${r.mainThread.ms} ms e trava a UI por
             ${r.mainThread.maxFrameGap} ms; no worker, o maior quadro foi ${r.map.maxFrameGap} ms</li>`
          : ''
      }
    </ul>`
  json.textContent = JSON.stringify(r, null, 2)
}

const gen = createGenerator()

button.addEventListener('click', async () => {
  button.disabled = true
  document.body.dataset.state = 'running'
  try {
    const report = await runBench(gen, quick ? QUICK : FULL, (step) => (status.textContent = step))
    render(report)
    status.textContent = 'Pronto.'
    document.body.dataset.state = 'done'
  } catch (e) {
    status.textContent = `Erro: ${e instanceof Error ? e.message : String(e)}`
    document.body.dataset.state = 'error'
  } finally {
    button.disabled = false
  }
})

document.body.dataset.state = 'idle'
