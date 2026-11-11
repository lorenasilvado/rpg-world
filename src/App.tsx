import { EditorLayout } from './app/EditorLayout'
import type { WorldStore } from './state/worldStore'

function App({ world }: { world: WorldStore }) {
  return <EditorLayout world={world} />
}

export default App
