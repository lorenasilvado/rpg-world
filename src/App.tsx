import { useState } from 'react'
import { EditorLayout } from './app/EditorLayout'
import type { CreateMapRenderer } from './app/MapView'
import { createUiStore, type UiStore } from './state/uiStore'
import type { WorldStore } from './state/worldStore'

function App({ world, ui, createRenderer }: { world: WorldStore; ui?: UiStore; createRenderer?: CreateMapRenderer }) {
  const [ownUi] = useState(createUiStore)
  return <EditorLayout world={world} ui={ui ?? ownUi} createRenderer={createRenderer} />
}

export default App
