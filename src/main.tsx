import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createUiStore } from './state/uiStore'
import { createWorldStore } from './state/worldStore'
import { createGenerator } from './workers/generatorClient'

// Um mundo por página, criado fora do React (o StrictMode montaria duas vezes). O editor sempre
// abre com um mundo: o mapa final é gerado logo ao abrir.
const world = createWorldStore(createGenerator())
world.getState().generate()
const ui = createUiStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App world={world} ui={ui} />
  </StrictMode>,
)
