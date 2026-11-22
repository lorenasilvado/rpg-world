import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { hasWebGL2 } from './app/webgl2'
import { WorldsApp } from './app/WorldsApp'
import { createThumbnails } from './features/wizard/thumbnails'
import { openDb } from './persistence/db'
import { createWorldsRepo } from './persistence/worldsRepo'
import type { WorldGenerator } from './state/worldStore'
import { createGenerator, type Generator } from './workers/generatorClient'

// O app abre na Lista de mundos (`WorldsApp`). O worker do editor é um só, guardado aqui, fora do
// React (o StrictMode montaria duas vezes), e criado no primeiro pedido de mapa: sem WebGL2, nada é
// gerado e ele nem existe. As miniaturas da lista e do assistente usam um worker só delas. Sem
// WebGL2, a lista funciona, e abrir um mundo mostra o aviso no lugar do editor.
const repo = createWorldsRepo(openDb())
let editorWorker: Generator | null = null
const generator: WorldGenerator = {
  request: (req) => (editorWorker ??= createGenerator()).request(req),
  latestVersion: () => editorWorker?.latestVersion() ?? 0,
}
const thumbnails = () => createThumbnails(createGenerator())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorldsApp repo={repo} generator={generator} webgl2={hasWebGL2()} createThumbnails={thumbnails} />
  </StrictMode>,
)
