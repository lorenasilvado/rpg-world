import '../index.css'
import { createGenerator } from '../workers/generatorClient'
import { FULL, QUICK, runBench, TARGETS, type BenchReport, type Timing } from './runBench'

/**
 * Página de medição de desempenho (#9, #45, #36), em /bench.html. `?rapido` roda menos vezes
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

const mb = (bytes: number) => (bytes / 1e6).toFixed(1)

function render(r: BenchReport) {
  const d = r.drag
  const m = r.memory
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
        ${timingRow(`Prévia ${r.coldPreview.size}², worker novo, sem aquecimento`, r.coldPreview, TARGETS.previewMs)}
        ${timingRow(`Mapa ${r.coldMap.size}², worker novo, sem aquecimento`, r.coldMap, TARGETS.mapMs)}
        ${timingRow(`Prévia ${r.preview.size}², seed nova`, r.preview, TARGETS.previewMs)}
        ${timingRow(`Mapa ${r.map.size}², seed nova`, r.map, TARGETS.mapMs)}
        ${timingRow(`Prévia ${r.previewSlider.size}², slider de limiar`, r.previewSlider, TARGETS.previewMs)}
        ${timingRow(`Mapa ${r.mapSlider.size}², slider de limiar`, r.mapSlider, TARGETS.mapMs)}
        ${timingRow(`Mapa ${r.mapShape.size}², Tamanho do continente`, r.mapShape, TARGETS.mapMs)}
      </tbody>
    </table>
    <ul class="mt-3 space-y-1 text-sm">
      ${r.visible ? '' : '<li>✗ A aba ficou escondida durante a medição: o maior quadro e o arrasto não valem. Meça de novo com a aba à vista.</li>'}
      <li>${ok(m.worldBytes <= TARGETS.worldBytes)} Memória do mundo: ${mb(m.worldBytes)} MB
        (cache do worker ${mb(m.cacheBytes)} MB + campo ${mb(m.fieldBytes)} MB; meta ${mb(TARGETS.worldBytes)} MB)</li>
      <li>${ok(r.transferred)} Arrays transferidos sem cópia (buffers vazios no worker depois do envio)</li>
      <li>${ok(d.duringDrag > 1 && d.inOrder && d.previewMatches)}
        Arrasto: ${d.sent} pedidos de prévia, ${d.duringDrag} prévias exibidas durante o arrasto, sempre da mais
        velha para a mais nova</li>
      <li>${ok(d.release.size === r.map.size && d.release.version === d.release.lastVersion && d.release.matches)}
        Ao soltar: o mapa ${d.release.size}² (v${d.release.version} de v${d.release.lastVersion}) substitui a prévia</li>
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
