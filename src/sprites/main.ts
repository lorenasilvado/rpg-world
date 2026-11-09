import { UPDATE_PRIORITY } from 'pixi.js'
import '../index.css'
import { generateMockTerrain } from '../mockup/terrain'
import { cameraAt } from './cameraPath'
import { summarizeFrames } from './frameStats'
import { placeSprites } from './placeSprites'
import {
  FULL_DURATION_MS,
  invalidReason,
  QUICK_DURATION_MS,
  SPRITE_COUNT,
  TARGET_FPS,
  type Gestures,
  type SpriteReport,
} from './report'
import { createScene } from './scene'

/**
 * Página do spike de 5.000 sprites (#10), em /sprites.html. `?rapido` mede por 2 s em vez de 30 s
 * (usado pelo E2E, que não confere fps: o navegador dele não tem GPU).
 */
const SEED = 'valdora'
const TERRAIN_WIDTH = 1024
const TERRAIN_HEIGHT = 640
const HUD_INTERVAL_MS = 250

const quick = new URLSearchParams(location.search).has('rapido')
const durationMs = quick ? QUICK_DURATION_MS : FULL_DURATION_MS

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} não encontrado`)
  return el as T
}

const stage = $('stage')
const fpsNow = $('fps')
const fpsMin = $('fps-min')
const zoom = $('zoom')
const status = $('status')
const verdict = $('verdict')
const reportBox = $<HTMLPreElement>('report')
const autoButton = $<HTMLButtonElement>('run-auto')
const manualButton = $<HTMLButtonElement>('run-manual')

function gpuName(): string | null {
  const gl = document.createElement('canvas').getContext('webgl2')
  const info = gl?.getExtension('WEBGL_debug_renderer_info')
  return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null
}

type Run = {
  mode: SpriteReport['mode']
  startedAt: number | null
  times: number[]
  visible: boolean
  gestures: Gestures | null
}

async function start() {
  const terrain = generateMockTerrain(SEED, TERRAIN_WIDTH, TERRAIN_HEIGHT)
  const decor = placeSprites(terrain, SEED, SPRITE_COUNT)
  const { app, viewport, world } = await createScene(stage, terrain, decor)
  stage.dataset.sprites = String(decor.length)

  let run: Run | null = null
  let recent: number[] = []
  let lastHud = 0

  const finish = (r: Run) => {
    run = null
    const stats = summarizeFrames(r.times)
    const invalid = invalidReason(r.visible, r.gestures)
    const report: SpriteReport = {
      machine: {
        userAgent: navigator.userAgent,
        cores: navigator.hardwareConcurrency,
        gpu: gpuName(),
        renderer: app.renderer.name,
      },
      screen: {
        cssWidth: window.innerWidth,
        cssHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      mode: r.mode,
      sprites: decor.length,
      visible: r.visible,
      gestures: r.gestures,
      target: TARGET_FPS,
      stats,
      pass: invalid === null && stats.minFps >= TARGET_FPS,
    }
    reportBox.textContent = JSON.stringify(report, null, 2)
    reportBox.hidden = false
    fpsMin.textContent = stats.minFps.toFixed(1)
    verdict.textContent = invalid
      ? invalid
      : report.pass
        ? `✓ Mínimo ${stats.minFps} fps (meta ${TARGET_FPS})`
        : `✗ Mínimo ${stats.minFps} fps (meta ${TARGET_FPS})`
    status.textContent = 'Medição concluída. Copie o relatório para o PR.'
    autoButton.disabled = false
    manualButton.disabled = false
    document.body.dataset.state = 'done'
  }

  const onVisibility = () => {
    if (run && document.visibilityState !== 'visible') run.visible = false
  }
  document.addEventListener('visibilitychange', onVisibility)

  // Pelos gestos, não pela posição: o zoom no cursor também desloca a câmera.
  viewport.on('moved', (e) => {
    if (run?.gestures && e.type === 'drag') run.gestures.panned = true
  })
  viewport.on('zoomed', (e) => {
    if (run?.gestures && (e.type === 'wheel' || e.type === 'pinch')) run.gestures.zoomed = true
  })

  const begin = (mode: Run['mode']) => {
    run = {
      mode,
      startedAt: null,
      times: [],
      visible: document.visibilityState === 'visible',
      gestures: mode === 'manual' ? { panned: false, zoomed: false } : null,
    }
    autoButton.disabled = true
    manualButton.disabled = true
    reportBox.hidden = true
    verdict.textContent = ''
    const seconds = durationMs / 1000
    status.textContent =
      mode === 'auto' ? `Câmera automática por ${seconds} s…` : `Faça pan e zoom no mapa por ${seconds} s…`
    document.body.dataset.state = 'running'
  }
  autoButton.addEventListener('click', () => begin('auto'))
  manualButton.addEventListener('click', () => begin('manual'))

  // Antes do viewport e do render: a câmera roteirizada entra no mesmo quadro que é medido.
  app.ticker.add(
    (ticker) => {
      const now = ticker.lastTime
      recent.push(now)
      while (now - recent[0] > 1000) recent.shift()

      if (run) {
        run.startedAt ??= now
        const elapsed = now - run.startedAt
        run.times.push(now)
        if (run.mode === 'auto') {
          const c = cameraAt(elapsed, world)
          viewport.setZoom(c.scale, true)
          viewport.moveCenter(c.x, c.y)
        }
        if (elapsed >= durationMs) finish(run)
      }

      if (now - lastHud >= HUD_INTERVAL_MS) {
        lastHud = now
        fpsNow.textContent = String(recent.length - 1)
        if (run) fpsMin.textContent = summarizeFrames(run.times).minFps.toFixed(1)
        zoom.textContent = `${viewport.scale.x.toFixed(2)}×`
        stage.dataset.scale = String(viewport.scale.x)
        stage.dataset.x = String(viewport.x)
        stage.dataset.y = String(viewport.y)
      }
    },
    undefined,
    UPDATE_PRIORITY.HIGH,
  )

  autoButton.disabled = false
  manualButton.disabled = false
  status.textContent = 'Pronto. Arraste, use a roda ou a pinça.'
  document.body.dataset.state = 'idle'
}

start().catch((e: unknown) => {
  status.textContent = `Erro: ${String(e)}`
  document.body.dataset.state = 'error'
  throw e
})
