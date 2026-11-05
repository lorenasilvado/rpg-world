import '../index.css'
import { DECOR_SHEET_URL } from '../render/style/decor'
import { drawMockup, placeDecor } from './drawMockup'
import { generateMockTerrain } from './terrain'

/** Página do spike visual (#7): mockup estático do mapa, com a seed fixa "valdora". */
const SEED = 'valdora'
const WIDTH = 360
const HEIGHT = 225

const canvas = document.querySelector<HTMLCanvasElement>('#mockup')
if (!canvas) throw new Error('canvas #mockup não encontrado')

const terrain = generateMockTerrain(SEED, WIDTH, HEIGHT)
const decor = placeDecor(terrain, SEED)
const sheet = new Image()
sheet.src = DECOR_SHEET_URL

const render = () => {
  drawMockup(canvas, terrain, decor, sheet, window.innerWidth, window.innerHeight, window.devicePixelRatio || 1)
  canvas.dataset.decor = String(decor.length)
  canvas.dataset.ready = 'true'
}

sheet.decode().then(() => {
  render()
  window.addEventListener('resize', render)
})
