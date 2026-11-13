import { useState } from 'react'
import { EditorLayout } from './app/EditorLayout'
import type { CreateMapRenderer } from './app/MapView'
import { createUiStore, type UiStore } from './state/uiStore'
import type { WorldStore } from './state/worldStore'

function App({ world, ui, createRenderer }: { world: WorldStore; ui?: UiStore; createRenderer?: CreateMapRenderer }) {
  // Sem `ui` na prop (os testes), o App cria o seu, uma vez.
  const [layers] = useState(() => ui ?? createUiStore())
  return <EditorLayout world={world} ui={layers} createRenderer={createRenderer} />
}

export default App
