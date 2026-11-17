import { useState } from 'react'
import { EditorLayout } from './app/EditorLayout'
import type { CreateMapRenderer } from './app/MapView'
import { NoWebGL2Notice } from './app/NoWebGL2Notice'
import { createUiStore, type UiStore } from './state/uiStore'
import type { WorldStore } from './state/worldStore'

/**
 * O editor do mundo. Sem WebGL2 (`webgl2` falso, de `hasWebGL2` no `main.tsx`), o aviso com os
 * navegadores suportados aparece no lugar do editor (AC-F1-20). Os testes do jsdom, sem WebGL,
 * não passam `webgl2` (o padrão é ter).
 */
function App({
  world,
  ui,
  createRenderer,
  webgl2 = true,
}: {
  world: WorldStore
  ui?: UiStore
  createRenderer?: CreateMapRenderer
  webgl2?: boolean
}) {
  // Sem `ui` na prop (os testes), o App cria o seu, uma vez.
  const [uiStore] = useState(() => ui ?? createUiStore())
  if (!webgl2) return <NoWebGL2Notice />
  return <EditorLayout world={world} ui={uiStore} createRenderer={createRenderer} />
}

export default App
