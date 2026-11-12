import { EditorLayout } from './app/EditorLayout'
import type { CreateMapRenderer } from './app/MapView'
import type { WorldStore } from './state/worldStore'

function App({ world, createRenderer }: { world: WorldStore; createRenderer?: CreateMapRenderer }) {
  return <EditorLayout world={world} createRenderer={createRenderer} />
}

export default App
