import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { hasWebGL2 } from './app/webgl2'
import { createUiStore } from './state/uiStore'
import { createWorldStore } from './state/worldStore'
import { createGenerator } from './workers/generatorClient'

// Um mundo por página, criado fora do React (o StrictMode montaria duas vezes). O editor sempre
// abre com um mundo: o mapa final é gerado logo ao abrir. Sem WebGL2, o editor não abre (o aviso
// toma o lugar dele) e nada é gerado.
const webgl2 = hasWebGL2()
const world = createWorldStore(createGenerator())
if (webgl2) world.getState().generate()
const ui = createUiStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App world={world} ui={ui} webgl2={webgl2} />
  </StrictMode>,
)
