import { useState } from 'react'
import { EditorLayout } from './app/EditorLayout'
import type { CreateMapRenderer } from './app/MapView'
import { NoWebGL2Notice } from './app/NoWebGL2Notice'
import { NewWorldWizard } from './features/wizard/NewWorldWizard'
import type { SaveStore } from './persistence/autosave'
import type { CreateThumbnails } from './features/wizard/thumbnails'
import { createUiStore, type UiStore } from './state/uiStore'
import type { WorldStore } from './state/worldStore'

/**
 * O editor do mundo. Sem WebGL2 (`webgl2` falso, de `hasWebGL2` no `main.tsx`), o aviso com os
 * navegadores suportados aparece no lugar do editor (AC-F1-20). Os testes do jsdom, sem WebGL,
 * não passam `webgl2` (o padrão é ter).
 *
 * Com `newWorld`, o assistente de novo mundo (AC-F1-19) abre sobre o editor, com o mundo padrão por
 * trás: até a Lista de mundos (M2), é assim que o app abre quando não há mundo salvo (`main.tsx`). `createThumbnails` dá as
 * miniaturas dos presets do assistente (sem ele, os cartões ficam sem miniatura).
 */
function App({
  world,
  ui,
  save,
  createRenderer,
  webgl2 = true,
  newWorld = false,
  createThumbnails,
}: {
  world: WorldStore
  ui?: UiStore
  /** O status do salvamento automático, para o indicador da sidebar. */
  save?: SaveStore
  createRenderer?: CreateMapRenderer
  webgl2?: boolean
  newWorld?: boolean
  createThumbnails?: CreateThumbnails
}) {
  // Sem `ui` na prop (os testes), o App cria o seu, uma vez.
  const [uiStore] = useState(() => ui ?? createUiStore())
  const [wizardOpen, setWizardOpen] = useState(newWorld)
  if (!webgl2) return <NoWebGL2Notice />
  return (
    <>
      <EditorLayout world={world} ui={uiStore} save={save} createRenderer={createRenderer} />
      <NewWorldWizard
        world={world}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        createThumbnails={createThumbnails}
      />
    </>
  )
}

export default App
