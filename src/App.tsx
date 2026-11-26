import { useState } from 'react'
import { EditorLayout } from './app/EditorLayout'
import type { CreateMapRenderer } from './app/MapView'
import { NoWebGL2Notice } from './app/NoWebGL2Notice'
import type { SaveStore } from './persistence/autosave'
import type { MapImageOptions } from './render/mapImage'
import { createWorldHistory, type WorldHistory } from './state/history'
import { createPinImages, type PinImages } from './state/pinImages'
import { createPinsStore, type PinsStore } from './state/pinsStore'
import { createRoadsStore, type RoadsStore } from './state/roadsStore'
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
  roads,
  images,
  ui,
  history,
  save,
  createRenderer,
  webgl2 = true,
  onBack,
  onExport,
  onExportImage,
  welcomeTips = false,
}: {
  world: WorldStore
  /** Os pins do mundo; sem ele (testes), o App cria um store vazio. */
  pins?: PinsStore
  /** As estradas do mundo; sem ele (testes), o App cria um store vazio, ligado aos pins. */
  roads?: RoadsStore
  /** As imagens enviadas dos pins; sem ele (testes), o App cria um, só na memória. */
  images?: PinImages
  ui?: UiStore
  /** O histórico de desfazer do mundo; sem ele (testes), o App cria um sobre o `world`, os pins e as estradas. */
  history?: WorldHistory
  /** O status do salvamento automático, para o indicador da sidebar. */
  save?: SaveStore
  createRenderer?: CreateMapRenderer
  webgl2?: boolean
  onBack?: () => void
  /** Baixa o arquivo do mundo (.json); sem ele (testes), o Exportar fica desabilitado. */
  onExport?: () => Promise<void>
  /** Baixa o mapa em PNG (AC-F4-11); sem ele (testes), "Imagem (.png)" fica desabilitado. */
  onExportImage?: (options: MapImageOptions) => Promise<void>
  /** Mostra as dicas de boas-vindas no primeiro acesso (AC-F1-31); os testes não ligam. */
  welcomeTips?: boolean
}) {
  // Sem `ui` na prop (os testes), o App cria o seu, uma vez.
  const [uiStore] = useState(() => ui ?? createUiStore())
  const [pinsStore] = useState(() => pins ?? createPinsStore())
  // Antes do histórico: excluir um pin tira as estradas dele antes de o histórico ver a mudança.
  const [roadsStore] = useState(() => roads ?? createRoadsStore([], pinsStore))
  const [imagesStore] = useState(() => images ?? createPinImages({ worldId: world.getState().id }))
  const [historyStore] = useState(() => history ?? createWorldHistory({ world, pins: pinsStore, roads: roadsStore }))
  if (!webgl2) return <NoWebGL2Notice onBack={onBack} />
  return (
    <EditorLayout
      world={world}
      pins={pinsStore}
      roads={roadsStore}
      images={imagesStore}
      ui={uiStore}
      history={historyStore}
      save={save}
      createRenderer={createRenderer}
      onBack={onBack}
      onExport={onExport}
      onExportImage={onExportImage}
      welcomeTips={welcomeTips}
    />
  )
}

export default App
