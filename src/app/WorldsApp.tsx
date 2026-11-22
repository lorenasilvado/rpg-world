import { useCallback, useEffect, useState } from 'react'
import App from '../App'
import { NewWorldWizard } from '../features/wizard/NewWorldWizard'
import type { CreateThumbnails } from '../features/wizard/thumbnails'
import { UnsavedLeaveDialog } from '../features/worlds/UnsavedLeaveDialog'
import { WorldList } from '../features/worlds/WorldList'
import { createAutosave, type Autosave } from '../persistence/autosave'
import type { World } from '../persistence/types'
import { copyName, loadWorlds, newWorldRecord, worldStoreInitial } from '../persistence/worldRecord'
import type { WorldsRepo } from '../persistence/worldsRepo'
import { createUiStore, type UiStore } from '../state/uiStore'
import { createWorldStore, newWorldId, type WorldGenerator, type WorldStore } from '../state/worldStore'
import type { CreateMapRenderer } from './MapView'

/** O relógio padrão (estável: entra nas dependências dos efeitos). */
const currentTime = () => new Date()

/** O mundo aberto no editor: o estado dele e o salvamento automático. */
type Session = { world: WorldStore; autosave: Autosave }

/**
 * O app (mundos.md → Ações, AC-F4-04 a AC-F4-06, AC-F4-12): a Lista de mundos é a tela inicial;
 * clicar num cartão abre o mundo no editor, e o editor volta à lista pelo cabeçalho da sidebar.
 * "Novo mundo" abre o assistente sobre a lista: "Criar mundo" salva o mundo novo já e o abre no
 * editor; Cancelar fecha e a lista continua.
 *
 * Cada mundo aberto ganha um `worldStore` e um salvamento automático próprios, sobre o mesmo
 * gerador (o worker do editor). Voltar à lista grava o que esperava a pausa e lê a lista de novo
 * (cartões esqueleto enquanto isso); se a gravação falha ("Erro ao salvar"), o mundo não fecha:
 * o modal `UnsavedLeaveDialog` pergunta antes, para as mudanças não se perderem sem aviso. Ao
 * esconder ou sair da página, o mundo aberto é gravado já.
 * Sem WebGL2, a lista funciona e nada é gerado: abrir um mundo mostra o aviso no lugar do editor.
 * As preferências do editor (`ui`: camadas, sidebar recolhida) valem para todos os mundos.
 *
 * O menu "⋯" dos cartões (AC-F4-07) renomeia, duplica (a cópia, "<nome> (cópia)", vai para o topo)
 * e exclui pelo repositório; depois de cada um, a lista é lida de novo sem os cartões esqueleto.
 */
export function WorldsApp({
  repo,
  generator,
  webgl2 = true,
  ui,
  createThumbnails,
  createRenderer,
  now = currentTime,
  newId = newWorldId,
}: {
  repo: Pick<WorldsRepo, 'list' | 'save' | 'rename' | 'duplicate' | 'remove'>
  generator: WorldGenerator
  webgl2?: boolean
  ui?: UiStore
  /** Miniaturas da lista e do assistente; sem ele (testes do jsdom), os cartões ficam sem imagem. */
  createThumbnails?: CreateThumbnails
  createRenderer?: CreateMapRenderer
  now?: () => Date
  newId?: () => string
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
      const autosave = createAutosave({ world, repo, loaded: record, now })
      setSession({ world, autosave })
      return { world, autosave }
    },
    [generator, repo, webgl2, newId, now],
  )

  const leave = useCallback(() => {
    if (!session) return
    session.autosave.dispose()
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

  if (session) {
    return (
      <>
        <App
          key={session.world.getState().id}
          world={session.world}
          ui={uiStore}
          save={session.autosave.store}
          webgl2={webgl2}
          createRenderer={createRenderer}
          onBack={() => void back()}
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
        onDuplicate={(world) => {
          void repo
            .duplicate(world.id, { id: newId(), name: copyName(world.name), now: now(), newId })
            .catch(() => undefined)
            .then(refreshList)
        }}
        onDelete={async (world) => {
          await repo.remove(world.id)
          refreshList()
        }}
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
