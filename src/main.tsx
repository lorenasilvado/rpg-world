import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { hasWebGL2 } from './app/webgl2'
import { createThumbnails } from './features/wizard/thumbnails'
import { createUiStore } from './state/uiStore'
import { createWorldStore } from './state/worldStore'
import { createGenerator } from './workers/generatorClient'

// Um mundo por página, criado fora do React (o StrictMode montaria duas vezes). O editor sempre
// abre com um mundo: o mapa final é gerado logo ao abrir. Sem WebGL2, o editor não abre (o aviso
// toma o lugar dele) e nada é gerado. Até a Lista de mundos (M2), o assistente de novo mundo abre
// sobre o editor, com o mundo padrão por trás; as miniaturas dele usam um worker só delas.
const webgl2 = hasWebGL2()
const world = createWorldStore(createGenerator())
if (webgl2) world.getState().generate()
const ui = createUiStore()
const thumbnails = () => createThumbnails(createGenerator())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App world={world} ui={ui} webgl2={webgl2} newWorld createThumbnails={thumbnails} />
  </StrictMode>,
)
