import { useCallback, useEffect, useState } from 'react'
import App from '../App'
import { pinsWithCleanLinks } from '../features/pins/links'
import { NewWorldWizard } from '../features/wizard/NewWorldWizard'
import type { CreateThumbnails } from '../features/wizard/thumbnails'
import { UnsavedLeaveDialog } from '../features/worlds/UnsavedLeaveDialog'
import { WorldList } from '../features/worlds/WorldList'
import { downloadFile } from '../features/worlds/download'
import { mapImageFileName, type MapImageSource } from '../features/worlds/exportImage'
import type { MapImageOptions } from '../render/mapImage'
import type { ImportFailureReason } from '../features/worlds/importMessages'
import { createAutosave, type Autosave } from '../persistence/autosave'
import { exportWorldJson, importedWorldRecord, parseWorldFile, worldFileName } from '../persistence/exportImport'
import type { World } from '../persistence/types'
import { copyName, loadWorlds, newWorldRecord, worldStoreInitial } from '../persistence/worldRecord'
import type { WorldsRepo } from '../persistence/worldsRepo'
import { createWorldHistory, type WorldHistory } from '../state/history'
import { createPinImages, pinImageIds, type PinImages } from '../state/pinImages'
import { createPinsStore, type PinsStore } from '../state/pinsStore'
import { createRoadsStore, type RoadsStore } from '../state/roadsStore'
import { createUiStore, type UiStore } from '../state/uiStore'
import { createWorldStore, newWorldId, type WorldGenerator, type WorldStore } from '../state/worldStore'
import type { CreateMapRenderer } from './MapView'

/** O relógio padrão (estável: entra nas dependências dos efeitos). */
const currentTime = () => new Date()

/**
 * O mundo aberto no editor: o estado dele, os pins, as estradas, as imagens enviadas dos pins, o
 * histórico de desfazer e o salvamento automático.
 */
type Session = { world: WorldStore; pins: PinsStore; roads: RoadsStore; images: PinImages; history: WorldHistory; autosave: Autosave }

/**
 * O app (mundos.md → Ações, AC-F4-04 a AC-F4-06, AC-F4-12): a Lista de mundos é a tela inicial;
 * clicar num cartão abre o mundo no editor, e o editor volta à lista pelo cabeçalho da sidebar.
 * "Novo mundo" abre o assistente sobre a lista: "Criar mundo" salva o mundo novo já e o abre no
 * editor; Cancelar fecha e a lista continua.
 *
 * Cada mundo aberto ganha um `worldStore`, um `pinsStore`, um histórico de desfazer (`history.ts`) e um
 * salvamento automático próprios, sobre o mesmo
 * gerador (o worker do editor). Voltar à lista grava o que esperava a pausa e lê a lista de novo
 * (cartões esqueleto enquanto isso); se a gravação falha ("Erro ao salvar"), o mundo não fecha:
 * o modal `UnsavedLeaveDialog` pergunta antes, para as mudanças não se perderem sem aviso. Ao
 * esconder ou sair da página, o mundo aberto é gravado já.
 * Sem WebGL2, a lista funciona e nada é gerado: abrir um mundo mostra o aviso no lugar do editor.
 * As preferências do editor (`ui`: camadas, sidebar recolhida) valem para todos os mundos.
 *
 * O menu "⋯" dos cartões (AC-F4-07) renomeia, duplica (a cópia, "<nome> (cópia)", vai para o topo)
 * e exclui pelo repositório; depois de cada um, a lista é lida de novo sem os cartões esqueleto.
 *
 * Exportar (AC-F4-09) baixa o arquivo do mundo (.json, `exportImport.ts`): pelo menu "⋯" do cartão, o
 * mundo salvo; no editor (a barra e o "Exportar .json" do Erro ao salvar), o mundo como está na
 * tela, mesmo sem ter sido gravado. Importar valida o arquivo e grava um mundo novo, com as imagens,
 * que vai para o topo da lista; um arquivo recusado volta com o motivo (o modal 03, AC-F4-10).
 * No editor, Exportar › Imagem (.png) baixa o mapa em PNG (`renderImage`, AC-F4-11), como
 * `<nome-do-mundo>-<escala>x.png`.
 */
export function WorldsApp({
  repo,
  generator,
  webgl2 = true,
  download = downloadFile,
  ui,
  createThumbnails,
  createRenderer,
  now = currentTime,
  newId = newWorldId,
  welcomeTips = false,
  renderImage,
}: {
  repo: Pick<WorldsRepo, 'list' | 'save' | 'rename' | 'duplicate' | 'remove' | 'importWorld' | 'saveImage' | 'getImage' | 'pruneImages'>
  generator: WorldGenerator
  webgl2?: boolean
  /** Baixa um arquivo (o Exportar); o padrão é o download do navegador. */
  download?: (blob: Blob, fileName: string) => void
  ui?: UiStore
  /** Miniaturas da lista e do assistente; sem ele (testes do jsdom), os cartões ficam sem imagem. */
  createThumbnails?: CreateThumbnails
  createRenderer?: CreateMapRenderer
  now?: () => Date
  newId?: () => string
  /** Mostra as dicas de boas-vindas no primeiro acesso ao editor (AC-F1-31); o app liga, os testes não. */
  welcomeTips?: boolean
  /** Monta o PNG do mapa aberto (Exportar › Imagem (.png), `renderMapImage`); sem ele (testes), o item fica desabilitado. */
  renderImage?: (source: MapImageSource, options: MapImageOptions) => Promise<Blob>
}) {
  const [uiStore] = useState(() => ui ?? createUiStore())
  const [session, setSession] = useState<Session | null>(null)
  const [worlds, setWorlds] = useState<World[] | null>(null)
  const [listedAt, setListedAt] = useState(now)
  const [wizardOpen, setWizardOpen] = useState(false)
  /** O modal "Mudanças não salvas" (voltar com erro ao salvar) e se "Tentar de novo" está gravando. */
  const [unsaved, setUnsaved] = useState<'closed' | 'open' | 'retrying'>('closed')
  /** Sobe depois de renomear, duplicar ou excluir: a lista é lida de novo. */
  const [listVersion, setListVersion] = useState(0)
  const refreshList = useCallback(() => setListVersion((v) => v + 1), [])

  // A lista é lida de novo a cada vez que ela aparece (`back` a esvazia, para os cartões esqueleto).
  useEffect(() => {
    if (session) return
    const job = { cancelled: false }
    void loadWorlds(repo).then((list) => {
      if (job.cancelled) return
      setListedAt(now())
      setWorlds(list)
    })
    return () => {
      job.cancelled = true
    }
  }, [session, repo, now, listVersion])

  // O que espera a pausa do salvamento é gravado ao esconder ou sair da página.
  useEffect(() => {
    if (!session) return
    const flush = () => void session.autosave.flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [session])

  const open = useCallback(
    (record: World): Session => {
      const world = createWorldStore(generator, worldStoreInitial(record), { newId, now })
      if (webgl2) world.getState().generate()
      // Um link fora da regra numa descrição salva vira texto ao abrir (AC-F3-07).
      const pins = createPinsStore(pinsWithCleanLinks(record.pins))
      // As imagens dos pins vêm do banco à parte; até chegarem, o pin mostra o círculo hachurado.
      // As que nenhum pin usa mais (trocadas, removidas, de pins excluídos) saem do banco.
      const images = createPinImages({ worldId: record.id, repo })
      const used = pinImageIds(record.pins)
      void images.load(used)
      void images.prune(used)
      // As estradas ouvem os pins antes do histórico: excluir um pin e as estradas dele é um passo só.
      const roads = createRoadsStore(record.roads, pins)
      const history = createWorldHistory({ world, pins, roads })
      const autosave = createAutosave({ world, pins, roads, repo, loaded: record, now })
      const session = { world, pins, roads, images, history, autosave }
      setSession(session)
      return session
    },
    [generator, repo, webgl2, newId, now],
  )

  const leave = useCallback(() => {
    if (!session) return
    session.autosave.dispose()
    session.history.dispose()
    session.roads.getState().dispose()
    session.images.dispose()
    setUnsaved('closed')
    setWorlds(null)
    setSession(null)
  }, [session])

  const back = useCallback(async () => {
    if (!session) return
    await session.autosave.flush()
    if (session.autosave.store.getState().status === 'error') setUnsaved('open')
    else leave()
  }, [session, leave])

  const retryAndLeave = useCallback(async () => {
    if (!session) return
    setUnsaved('retrying')
    await session.autosave.saveNow()
    if (session.autosave.store.getState().status === 'error') setUnsaved('open')
    else leave()
  }, [session, leave])

  const exportWorld = useCallback(
    async (world: World, images?: PinImages) => {
      const getImage = async (id: string) => images?.blob(id) ?? (await repo.getImage(id))?.blob
      const json = await exportWorldJson(world, getImage)
      download(new Blob([json], { type: 'application/json' }), worldFileName(world.name))
    },
    [repo, download],
  )

  const importWorld = useCallback(
    async (file: File): Promise<ImportFailureReason | null> => {
      let text: string
      try {
        text = await file.text()
      } catch {
        return 'unreadable'
      }
      const parsed = parseWorldFile(text)
      if (!parsed.ok) return parsed.reason
      const { world, images } = importedWorldRecord(parsed, { id: newId(), now: now(), newId })
      try {
        await repo.importWorld(world, images)
      } catch {
        return 'save-failed'
      }
      refreshList()
      return null
    },
    [repo, newId, now, refreshList],
  )

  if (session) {
    return (
      <>
        <App
          key={session.world.getState().id}
          world={session.world}
          pins={session.pins}
          roads={session.roads}
          images={session.images}
          history={session.history}
          ui={uiStore}
          save={session.autosave.store}
          webgl2={webgl2}
          createRenderer={createRenderer}
          onBack={() => void back()}
          onExport={() => exportWorld(session.autosave.record(), session.images)}
          onExportImage={
            renderImage &&
            (async (options) => {
              const blob = await renderImage({ world: session.world, pins: session.pins, roads: session.roads, images: session.images, ui: uiStore }, options)
              download(blob, mapImageFileName(session.world.getState().name, options.scale))
            })
          }
          welcomeTips={welcomeTips}
        />
        <UnsavedLeaveDialog
          open={unsaved !== 'closed'}
          retrying={unsaved === 'retrying'}
          onRetry={() => void retryAndLeave()}
          onLeave={leave}
          onStay={() => setUnsaved((state) => (state === 'retrying' ? state : 'closed'))}
        />
      </>
    )
  }

  return (
    <>
      <WorldList
        worlds={worlds}
        now={listedAt}
        onOpen={open}
        onNew={() => setWizardOpen(true)}
        onRename={async (world, name) => {
          await repo.rename(world.id, name, now())
          refreshList()
        }}
        onDuplicate={async (world) => {
          await repo.duplicate(world.id, { id: newId(), name: copyName(world.name), now: now(), newId })
          refreshList()
        }}
        onDelete={async (world) => {
          await repo.remove(world.id)
          refreshList()
        }}
        onExport={(world) => exportWorld(world)}
        onImport={importWorld}
        createThumbnails={createThumbnails}
      />
      <NewWorldWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={(values) => {
          const created = open(newWorldRecord({ ...values, id: newId() }, now()))
          void created.autosave.saveNow()
        }}
        createThumbnails={createThumbnails}
      />
    </>
  )
}
