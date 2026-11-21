import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { hasWebGL2 } from './app/webgl2'
import { createThumbnails } from './features/wizard/thumbnails'
import { createAutosave } from './persistence/autosave'
import { openDb } from './persistence/db'
import { loadLastWorld, worldStoreInitial } from './persistence/lastWorld'
import { createWorldsRepo } from './persistence/worldsRepo'
import { createUiStore } from './state/uiStore'
import { createWorldStore } from './state/worldStore'
import { createGenerator } from './workers/generatorClient'

// Um mundo por página, criado fora do React (o StrictMode montaria duas vezes). O editor sempre
// abre com um mundo: o mapa final é gerado logo ao abrir. Sem WebGL2, o editor não abre (o aviso
// toma o lugar dele) e nada é gerado. Até a Lista de mundos (M2), o app reabre o último mundo salvo
// no IndexedDB; sem mundo salvo, o assistente de novo mundo abre sobre o editor, com o mundo padrão
// por trás. As miniaturas do assistente usam um worker só delas. O mundo aberto é salvo sozinho
// (`createAutosave`), e o que espera o debounce é gravado ao esconder ou sair da página.
async function start() {
  const webgl2 = hasWebGL2()
  const repo = createWorldsRepo(openDb())
  const saved = await loadLastWorld(repo)
  const world = createWorldStore(createGenerator(), saved ? worldStoreInitial(saved) : {})
  if (webgl2) world.getState().generate()
  const autosave = createAutosave({ world, repo, loaded: saved })
  const flush = () => void autosave.flush()
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  const ui = createUiStore()
  const thumbnails = () => createThumbnails(createGenerator())

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App world={world} ui={ui} save={autosave.store} webgl2={webgl2} newWorld={!saved} createThumbnails={thumbnails} />
    </StrictMode>,
  )
}

void start()
