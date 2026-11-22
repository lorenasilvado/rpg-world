import { useState } from 'react'
import { EditorLayout } from './app/EditorLayout'
import type { CreateMapRenderer } from './app/MapView'
import { NoWebGL2Notice } from './app/NoWebGL2Notice'
import type { SaveStore } from './persistence/autosave'
import { createWorldHistory, type WorldHistory } from './state/history'
import { createPinsStore, type PinsStore } from './state/pinsStore'
import { createUiStore, type UiStore } from './state/uiStore'
import type { WorldStore } from './state/worldStore'

/**
 * O editor do mundo aberto (`WorldsApp` o abre a partir da Lista de mundos). Sem WebGL2 (`webgl2`
 * falso, de `hasWebGL2` no `main.tsx`), o aviso com os navegadores suportados aparece no lugar do
 * editor (AC-F1-20, AC-F4-12). Os testes do jsdom, sem WebGL, não passam `webgl2` (o padrão é ter).
 * `onBack` volta à Lista de mundos (pelo cabeçalho da sidebar, ou pelo aviso sem WebGL2).
 */
function App({
  world,
  pins,
  ui,
  history,
  save,
  createRenderer,
  webgl2 = true,
  onBack,
}: {
  world: WorldStore
  /** Os pins do mundo; sem ele (testes), o App cria um store vazio. */
  pins?: PinsStore
  ui?: UiStore
  /** O histórico de desfazer do mundo; sem ele (testes), o App cria um sobre o `world` e os pins. */
  history?: WorldHistory
  /** O status do salvamento automático, para o indicador da sidebar. */
  save?: SaveStore
  createRenderer?: CreateMapRenderer
  webgl2?: boolean
  onBack?: () => void
}) {
  // Sem `ui` na prop (os testes), o App cria o seu, uma vez.
  const [uiStore] = useState(() => ui ?? createUiStore())
  const [pinsStore] = useState(() => pins ?? createPinsStore())
  const [historyStore] = useState(() => history ?? createWorldHistory({ world, pins: pinsStore }))
  if (!webgl2) return <NoWebGL2Notice onBack={onBack} />
  return (
    <EditorLayout
      world={world}
      pins={pinsStore}
      ui={uiStore}
      history={historyStore}
      save={save}
      createRenderer={createRenderer}
      onBack={onBack}
    />
  )
}

export default App
