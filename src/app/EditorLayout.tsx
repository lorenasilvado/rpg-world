import { CircleHelp, Compass, Moon, PanelLeftOpen, PanelRightOpen, Redo2, Search, Sun, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { useStore } from 'zustand'
import { BAR_BOTTOM, BAR_GAP, BAR_SIDE, TOAST_HEIGHT, ZOOM_SIDE, bottomBarLayout } from '../features/map/bottomBarLayout'
import { MapToolbar } from '../features/map/MapToolbar'
import { MeasureTool } from '../features/map/MeasureTool'
import { ShortcutsDialog } from '../features/help/ShortcutsDialog'
import { Minimap } from '../features/map/Minimap'
import { useCoarsePointer } from '../features/map/useCoarsePointer'
import { ZoomControls } from '../features/map/ZoomControls'
import { PinDeletedToast } from '../features/pins/PinDeletedToast'
import { PinsOnWaterToast } from '../features/pins/PinsOnWaterToast'
import { pinsOnWater } from '../features/pins/place'
import { CENTER_PIN_ZOOM, PinDrawer } from '../features/pins/PinDrawer'
import { PinTool } from '../features/pins/PinTool'
import { SearchDialog } from '../features/search/SearchDialog'
import { GenerateSidebar } from '../features/sidebar/GenerateSidebar'
import { ExportMenu } from '../features/worlds/ExportMenu'
import { SaveIndicator } from '../features/worlds/SaveIndicator'
import type { SaveStore } from '../persistence/autosave'
import { pinToWorld } from '../render/layers/pinMath'
import { createCameraStore } from '../state/cameraStore'
import type { WorldHistory } from '../state/history'
import type { PinImages } from '../state/pinImages'
import type { PinsStore } from '../state/pinsStore'
import { MAP_SIZE } from '../state/sizes'
import type { UiStore } from '../state/uiStore'
import type { WorldStore } from '../state/worldStore'
import { GenerationErrorToast } from './GenerationErrorToast'
import { inDialog, isFieldTarget } from '../render/camera'
import { focusMap } from './focusMap'
import { MapView, type CreateMapRenderer } from './MapView'
import { DESKTOP_QUERY, SHORT_QUERY } from './panelInsets'
import { useTheme } from './useTheme'

/**
 * Casca vazia do editor (design-system.md → Layout do Editor):
 * mapa em tela cheia atrás dos painéis, sidebar à esquerda (320 px) e drawer à direita (400 px).
 * Abaixo de 768 px, sidebar e drawer viram painéis sobrepostos, abertos pelos botões da barra:
 * o scrim cobre o mapa e a barra de ações, Esc fecha o painel, o foco vai para o botão de fechar
 * do painel ao abrir e volta ao botão que o abriu ao fechar. Com um painel aberto, o resto da tela
 * fica `inert` (o Tab não sai do painel). Ao passar para 768 px ou mais, os painéis fecham.
 *
 * O cabeçalho da sidebar mostra o logo, que volta à Lista de mundos (`onBack`, AC-F4-06), o nome do
 * mundo e, abaixo dele, o indicador de salvamento
 * (`SaveIndicator`, com o `save`). A sidebar tem as seções e os sliders de geração (`GenerateSidebar`). A partir de 768 px, ela
 * recolhe a 48 px e abre de novo pelo botão ou pela tecla `[`; abaixo disso, a tecla abre e fecha o
 * painel sobreposto. A tecla não vale com o foco num campo de texto nem com Ctrl, Alt ou Meta.
 *
 * O `world` é o estado do mundo (`worldStore.ts`): o mapa desenha o campo dele (`MapView`), a
 * sidebar muda os parâmetros dele, o toast mostra o erro da geração, e o status dela fica em
 * `data-generation-status` (os testes esperam por ele). O `ui` guarda as camadas do mapa ligadas e
 * a sidebar recolhida (`uiStore.ts`). `createRenderer` troca o
 * renderer do mapa (os testes do jsdom, sem WebGL, passam um falso).
 *
 * O drawer, a partir de 768 px, fica fora da tela sem pin selecionado, e entra deslizando (200 ms)
 * quando um pin é selecionado (AC-F3-19); a linha inferior e a barra do topo vão até a borda direita
 * sem ele, e até a borda esquerda dele com ele. A área livre do mapa (`panelInsets`) não conta o drawer.
 *
 * A linha inferior, entre a sidebar e o drawer (ou a borda direita), 16 px da base: o minimapa à esquerda e o controle
 * de zoom à direita, com o toast de erro da geração. A largura da linha (a da área livre) é medida
 * num elemento invisível sem transição: o layout vale pela largura final, e não muda no meio do
 * deslize da sidebar ou do drawer. `bottomBarLayout` decide onde ficam o minimapa (ao lado do zoom, ou acima dele quando não cabem
 * lado a lado: tablet com a sidebar aberta) e o toast. O minimapa e o zoom leem a câmera do
 * renderer (`cameraStore.ts`). A toolbar de ferramentas (`MapToolbar`) fica no centro da linha, numa
 * segunda linha acima dela ou em pé acima do zoom, conforme a largura (`bottomBarLayout`). A
 * ferramenta Medir distância (`MeasureTool`, tecla M) desenha a medida por cima do mapa.
 *
 * Os pins (`pins`, pins.md): o renderer os desenha, e o `PinTool` cria (Adicionar pin, tecla P) e
 * seleciona pelo clique. O drawer mostra o pin selecionado (`PinDrawer`); abaixo de 768 px, selecionar
 * um pin abre o drawer sobreposto, e fechá-lo (Esc, o botão ou o scrim) tira a seleção.
 *
 * Delete, ou Excluir no rodapé do drawer, exclui o pin selecionado (AC-F3-05): o toast "Pin excluído" oferece "Desfazer", e fecha
 * quando outra coisa muda no histórico (um passo novo, desfeito ou refeito). Com o toast de erro da
 * geração à vista, ele fica empilhado acima dele.
 *
 * Quando um mapa final regerado (não o primeiro, ao abrir o mundo) deixa pins sobre a água, o aviso
 * "N pins ficaram sobre a água" (`PinsOnWaterToast`, AC-F1-30) oferece "Mostrar", que leva a câmera
 * até o primeiro deles (`focusOn`, como o Centralizar do drawer) e o foco ao mapa. Os pins não se movem. Ele fica
 * empilhado acima dos outros toasts à vista.
 *
 * Desfazer e Refazer (AC-F4-08) usam o histórico do mundo (`history`), pelos botões da barra (cada um
 * habilitado quando há o que desfazer ou refazer) e por Ctrl+Z e Ctrl+Shift+Z (⌘ no Mac). As teclas
 * não valem com o foco num campo de texto (aí o desfazer é do campo), num modal, com um painel
 * sobreposto aberto nem durante o arrasto de um pin ou de um slider.
 *
 * A barra de ações do topo (navegacao.md → Elementos do editor, AC-F2-10): Buscar (ou Ctrl K) abre o
 * modal de busca dos pins (`SearchDialog`, AC-F3-16): escolher um resultado seleciona o pin e leva a
 * câmera até ele, como o Centralizar do drawer. Exportar abre o menu com "Arquivo do mundo (.json)"
 * (`ExportMenu`, `onExport`, AC-F4-09), também no menu do Erro ao salvar; o tema alterna, e Ajuda
 * (ou a tecla ?) abre o modal "Atalhos de teclado" (`ShortcutsDialog`). Buscar mostra o rótulo e o
 * atalho só a partir de 768 px e com a área livre de pelo menos `SEARCH_LABEL_FROM`; senão, só o
 * ícone. Abaixo de 768 px, os botões da barra ficam sem folga entre si, para caber no celular.
 */
export function EditorLayout({
  world,
  pins,
  images,
  ui,
  history,
  save,
  createRenderer,
  onBack,
  onExport,
}: {
  world: WorldStore
  pins: PinsStore
  /** As imagens enviadas dos pins (o ícone do Personalizado). */
  images: PinImages
  ui: UiStore
  /** O histórico de desfazer e refazer do mundo (`createWorldHistory`). */
  history: WorldHistory
  /** O status do salvamento automático (`createAutosave`); sem ele (testes), não há indicador. */
  save?: SaveStore
  createRenderer?: CreateMapRenderer
  /** Volta à Lista de mundos; sem ele (testes), o logo não é um botão. */
  onBack?: () => void
  /** Baixa o arquivo do mundo (.json); sem ele (testes), o Exportar fica desabilitado. */
  onExport?: () => Promise<void>
}) {
  const { theme, toggle } = useTheme()
  const generationStatus = useStore(world, (s) => s.status)
  // O toast de erro da geração à vista: o "Pin excluído" fica acima dele, sem cobri-lo.
  const errorToast = generationStatus === 'error'
  const worldName = useStore(world, (s) => s.name)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  /** A partir de 768 px, o drawer só fica à vista com um pin selecionado (AC-F3-19). */
  const pinSelected = useStore(pins, (s) => s.selectedId !== null)
  const [helpOpen, setHelpOpen] = useState(false)
  /** Quem tinha o foco ao abrir a Ajuda: recebe o foco de volta ao fechar. */
  const helpReturn = useRef<HTMLElement | null>(null)
  const openHelp = () => {
    helpReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setHelpOpen(true)
  }
  const [searchOpen, setSearchOpen] = useState(false)
  const searchButton = useRef<HTMLButtonElement>(null)
  /**
   * Quem recebe o foco ao fechar a busca: quem tinha o foco ao abrir (sem ninguém, o `body`, o Buscar
   * da barra) ou, escolhido um pin abaixo de 768 px, o fechar do drawer sobreposto.
   */
  const searchReturn = useRef<HTMLElement | null>(null)
  const openSearch = useCallback(() => {
    const active = document.activeElement
    searchReturn.current = active instanceof HTMLElement && active !== document.body ? active : searchButton.current
    setSearchOpen(true)
  }, [])
  const desktop = useDesktop()
  const sidebarCollapsed = useStore(ui, (s) => s.sidebarCollapsed) && desktop
  /** O drawer à vista: a partir de 768 px, com um pin selecionado; abaixo, o painel sobreposto aberto. */
  const drawerShown = desktop ? pinSelected : drawerOpen
  /** Os lados da linha inferior a partir de 768 px: da sidebar até a borda direita, ou até o drawer aberto. */
  const barInset = [
    pinSelected ? 'desk:right-[var(--drawer-width)]' : 'desk:right-0',
    sidebarCollapsed ? 'desk:left-[var(--sidebar-collapsed-width)]' : 'desk:left-[var(--sidebar-width)]',
  ].join(' ')
  const [camera] = useState(createCameraStore)
  /** Tela baixa (celular deitado, AC-F2-15): o minimapa tem um aberto próprio, que começa recolhido. */
  const short = useMedia(SHORT_QUERY)
  const [shortMinimapOpen, setShortMinimapOpen] = useState(false)
  const uiMinimapOpen = useStore(ui, (s) => s.minimapOpen)
  const minimapOpen = short ? shortMinimapOpen : uiMinimapOpen
  /** A largura final da linha inferior, num medidor sem transição (ver `barInset`). */
  const barSizer = useRef<HTMLDivElement>(null)
  const barWidth = useWidth(barSizer)
  const layout = bottomBarLayout(barWidth, minimapOpen, useCoarsePointer(), short)
  const minimap = (
    <Minimap
      world={world}
      ui={ui}
      camera={camera}
      {...(short ? { open: shortMinimapOpen, onOpenChange: setShortMinimapOpen } : {})}
    />
  )
  // O minimapa só desliza entre ao lado e acima do zoom depois da primeira medição da linha: ao
  // abrir o editor numa área estreita, ele já aparece no lugar, sem subir animado.
  const barAnimated = useAnimatedAfterMeasure(barWidth)
  const anyOpen = sidebarOpen || drawerOpen
  const searchLabel = desktop && (barWidth === null || barWidth >= SEARCH_LABEL_FROM)
  const sidebarOpener = useRef<HTMLButtonElement>(null)
  const sidebarClose = useRef<HTMLButtonElement>(null)
  const drawerOpener = useRef<HTMLButtonElement>(null)
  const drawerClose = useRef<HTMLButtonElement>(null)
  const undoButton = useRef<HTMLButtonElement>(null)
  /** Excluir no rodapé do drawer lateral: o foco vai para o Desfazer da barra quando ele habilitar. */
  const focusUndo = useRef(false)
  usePanelFocus(sidebarOpen, sidebarClose, sidebarOpener)
  usePanelFocus(drawerOpen, drawerClose, drawerOpener)
  const canUndo = useStore(history.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(history.temporal, (s) => s.futureStates.length > 0)
  /** O toast "Pin excluído": a versão do histórico logo depois da exclusão (`null`: fechado). */
  const [deletedAt, setDeletedAt] = useState<number | null>(null)
  const closeDeleted = useCallback(() => setDeletedAt(null), [])
  const deletePin = useCallback(
    (id: string) => {
      if (!pins.getState().removePin(id)) return
      setDeletedAt(history.version.getState().value)
    },
    [pins, history],
  )

  /** O aviso de pins sobre a água: a versão do mapa, quantos e o primeiro deles (`null`: fechado). */
  const [onWater, setOnWater] = useState<{ at: number; count: number; firstId: string } | null>(null)
  const closeOnWater = useCallback(() => setOnWater(null), [])
  useEffect(() => {
    // O primeiro mapa final (o do mundo que abriu) não é uma regeração: não avisa.
    let hadFinal = (world.getState().field?.width ?? 0) >= MAP_SIZE
    return world.subscribe((state, prev) => {
      if (state.field === prev.field || !state.field || state.field.width < MAP_SIZE) return
      if (!hadFinal) {
        hadFinal = true
        return
      }
      const wet = pinsOnWater(state.field, pins.getState().pins)
      setOnWater(wet.length > 0 ? { at: state.fieldVersion, count: wet.length, firstId: wet[0].id } : null)
    })
  }, [world, pins])
  const mapRef = useRef<HTMLElement | null>(null)
  const showOnWater = () => {
    const pin = onWater && pins.getState().pins.find((p) => p.id === onWater.firstId)
    setOnWater(null)
    // O toast some com o clique: o foco vai para o mapa, não para o começo da página.
    focusMap(mapRef.current)
    if (!pin) return
    const p = pinToWorld(pin.pos)
    camera.getState().controls?.focusOn(p.x, p.y, CENTER_PIN_ZOOM)
  }

  // Excluir pelo rodapé tira o botão com o foco (o drawer fecha, sem pin): a partir de 768 px, o foco
  // vai para o Desfazer da barra, que acabou de habilitar. Abaixo, o painel sobreposto devolve o
  // foco a quem o abriu.
  const deleteFromDrawer = useCallback(
    (id: string) => {
      focusUndo.current = !drawerOpen && pins.getState().pins.some((p) => p.id === id)
      deletePin(id)
    },
    [deletePin, drawerOpen, pins],
  )
  useEffect(() => {
    if (!focusUndo.current || !canUndo || deletedAt === null) return
    focusUndo.current = false
    undoButton.current?.focus()
  }, [canUndo, deletedAt])

  // Outra mudança no histórico (passo novo, desfeito ou refeito) fecha o toast "Pin excluído".
  useEffect(
    () => history.version.subscribe(({ value }) => setDeletedAt((at) => (at !== null && at !== value ? null : at))),
    [history],
  )

  useEffect(() => {
    if (anyOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'z') return
      if (e.defaultPrevented || isTextField(e.target) || inDialog(e.target)) return
      e.preventDefault()
      // No meio de um arrasto (de um pin ou de um slider), o histórico espera o soltar.
      if (pins.getState().dragging || world.getState().paramsDragging) return
      if (e.shiftKey) history.redo()
      else history.undo()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [anyOpen, history, pins, world])

  /** O aperto que começou no scrim (ver o `onClick` dele). */
  const scrimPress = useRef(false)
  const closeAll = () => {
    setSidebarOpen(false)
    setDrawerOpen(false)
    pins.getState().select(null)
  }
  const closeDrawer = () => {
    setDrawerOpen(false)
    pins.getState().select(null)
  }

  // Abaixo de 768 px, o pin selecionado abre o drawer sobreposto; sem seleção, ele fecha.
  useEffect(
    () =>
      pins.subscribe((state, prev) => {
        if (state.selectedId === prev.selectedId) return
        if (state.selectedId === null) setDrawerOpen(false)
        else if (!window.matchMedia(DESKTOP_QUERY).matches) {
          setSidebarOpen(false)
          setDrawerOpen(true)
        }
      }),
    [pins],
  )

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY)
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setSidebarOpen(false)
        setDrawerOpen(false)
      }
    }
    desktop.addEventListener('change', onChange)
    return () => desktop.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented || isTextField(e.target) || inDialog(e.target)) return
      e.preventDefault()
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        const { sidebarCollapsed, setSidebarCollapsed } = ui.getState()
        setSidebarCollapsed(!sidebarCollapsed)
      } else {
        setDrawerOpen(false)
        setSidebarOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ui])

  // Ctrl K (⌘ K no Mac) abre a busca, mesmo com o foco num campo; num modal ou com um painel
  // sobreposto aberto, não.
  useEffect(() => {
    if (anyOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return
      if (e.defaultPrevented || inDialog(e.target)) return
      e.preventDefault()
      openSearch()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [anyOpen, openSearch])

  const chooseSearchResult = (id: string) => {
    const pin = pins.getState().pins.find((p) => p.id === id)
    setSearchOpen(false)
    if (!pin) return
    // Abaixo de 768 px, o drawer sobreposto abre com a ficha (também com o pin que já estava
    // selecionado, com o painel fechado pelo Centralizar), e o foco vai para o fechar dele.
    if (!window.matchMedia(DESKTOP_QUERY).matches) {
      searchReturn.current = drawerClose.current
      setSidebarOpen(false)
      setDrawerOpen(true)
    } else if (!searchReturn.current?.isConnected) searchReturn.current = searchButton.current
    pins.getState().select(id)
    const p = pinToWorld(pin.pos)
    camera.getState().controls?.focusOn(p.x, p.y, CENTER_PIN_ZOOM)
  }

  useEffect(() => {
    if (anyOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented || isFieldTarget(e.target) || inDialog(e.target)) return
      e.preventDefault()
      openHelp()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [anyOpen])

  useEffect(() => {
    if (!anyOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setSidebarOpen(false)
      setDrawerOpen(false)
      pins.getState().select(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [anyOpen, pins])

  return (
    <div className="relative h-full overflow-hidden bg-map-canvas" data-testid="editor" data-generation-status={generationStatus}>
      <MapView ref={mapRef} world={world} pins={pins} ui={ui} camera={camera} inert={anyOpen} images={images} createRenderer={createRenderer} />
      <MeasureTool ui={ui} world={world} camera={camera} disabled={anyOpen} />
      <PinTool ui={ui} pins={pins} camera={camera} disabled={anyOpen} onDelete={deletePin} />

      <div ref={barSizer} aria-hidden="true" data-testid="bottom-bar-sizer" className={`pointer-events-none invisible absolute right-0 left-0 h-0 ${barInset}`} />
      <div
        data-testid="bottom-bar"
        data-stacked={layout.stacked}
        inert={anyOpen}
        style={{ bottom: BAR_BOTTOM }}
        className={[
          'pointer-events-none absolute right-0 left-0 z-10',
          'transition-[left,right] duration-200 ease-[var(--ease-panel)]',
          barInset,
        ].join(' ')}
      >
        <div
          data-testid="minimap-slot"
          data-animated={barAnimated}
          style={{ left: BAR_SIDE, bottom: layout.minimapBottom }}
          className={`pointer-events-auto absolute ${barAnimated ? 'transition-[bottom] duration-200 ease-[var(--ease-panel)]' : ''}`}
        >
          {layout.minimapPlace === 'row' && minimap}
        </div>
        <div
          data-testid="toolbar-slot"
          data-place={layout.toolbar}
          style={
            layout.toolbar === 'vertical'
              ? { right: ZOOM_SIDE, bottom: layout.toolbarBottom }
              : { left: layout.toolbarLeft ?? '50%', bottom: layout.toolbarBottom }
          }
          className={[
            'pointer-events-auto absolute',
            layout.toolbar === 'vertical' || layout.toolbarLeft !== null ? '' : '-translate-x-1/2',
            // Na segunda linha, ela sobe e desce junto com o minimapa (abrir e recolher), deslizando.
            barAnimated ? 'transition-[bottom] duration-200 ease-[var(--ease-panel)]' : '',
          ].join(' ')}
        >
          <MapToolbar ui={ui} vertical={layout.toolbar === 'vertical'} />
        </div>
        <div style={{ right: ZOOM_SIDE }} className="pointer-events-auto absolute bottom-0">
          <ZoomControls world={world} camera={camera} areaWidth={barWidth} />
        </div>
        <GenerationErrorToast world={world} beside={layout.toastBeside} bottom={layout.toastBottom} right={layout.toastRight} />
        <PinDeletedToast
          open={deletedAt}
          onUndo={() => history.undo()}
          onClose={closeDeleted}
          beside={layout.toastBeside}
          bottom={layout.toastBottom + (errorToast ? TOAST_HEIGHT + BAR_GAP : 0)}
          right={layout.toastRight}
        />
        <PinsOnWaterToast
          open={onWater?.at ?? null}
          count={onWater?.count ?? 0}
          onShow={showOnWater}
          onClose={closeOnWater}
          beside={layout.toastBeside}
          bottom={layout.toastBottom + (errorToast ? TOAST_HEIGHT + BAR_GAP : 0) + (deletedAt !== null ? TOAST_HEIGHT + BAR_GAP : 0)}
          right={layout.toastRight}
        />
      </div>

      {/* Tela baixa sem lugar na linha (AC-F2-15): o minimapa fica no canto superior esquerdo. */}
      {layout.minimapPlace === 'top' && (
        <div data-testid="minimap-top" inert={anyOpen} style={{ left: BAR_SIDE }} className="absolute top-3 z-10">
          {minimap}
        </div>
      )}

      {anyOpen && (
        <div
          aria-hidden="true"
          data-testid="scrim"
          className="absolute inset-0 z-[15] bg-scrim desk:hidden"
          // Só fecha o clique que começou no scrim: o toque num pin abre o drawer antes do clique que
          // o navegador gera depois dele, e esse clique cairia no scrim (o drawer não cobre a tela
          // toda, como no celular deitado) e fecharia o drawer na hora (AC-F2-15).
          onPointerDown={() => (scrimPress.current = true)}
          onClick={() => {
            if (scrimPress.current) closeAll()
            scrimPress.current = false
          }}
        />
      )}

      <aside
        aria-label="Gerar mundo"
        data-testid="sidebar"
        data-open={sidebarOpen}
        data-collapsed={sidebarCollapsed}
        inert={drawerOpen}
        className={[
          'absolute inset-y-0 left-0 z-20 flex w-[min(var(--sidebar-width),100vw)] flex-col overflow-hidden',
          'bg-paper-solid shadow-[4px_0_24px_rgba(43,30,15,0.18)]',
          'transition-[transform,width] duration-200 ease-[var(--ease-panel)]',
          sidebarOpen ? 'translate-x-0' : 'invisible -translate-x-full',
          'desk:visible desk:translate-x-0',
          sidebarCollapsed ? 'desk:w-[var(--sidebar-collapsed-width)]' : 'desk:w-[var(--sidebar-width)]',
        ].join(' ')}
      >
        <header
          className={`flex h-[var(--editor-header-height)] shrink-0 items-center gap-3 border-b border-line ${sidebarCollapsed ? 'px-2' : 'px-3'}`}
        >
          {onBack ? (
            <button
              type="button"
              aria-label="Voltar à lista de mundos"
              title="Voltar à lista de mundos"
              onClick={onBack}
              className="grid size-8 shrink-0 place-items-center rounded-control bg-amber text-on-amber hover:bg-[var(--amber-hover)] active:bg-[var(--amber-press)] focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none"
            >
              <Compass size={20} aria-hidden="true" />
            </button>
          ) : (
            <span className="grid size-8 shrink-0 place-items-center rounded-control bg-amber text-on-amber">
              <Compass size={20} aria-hidden="true" />
            </span>
          )}
          {!sidebarCollapsed && (
            <div className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="max-w-full min-w-0 truncate px-1.5 font-title text-base/5 font-semibold" data-testid="world-name" title={worldName}>
                {worldName}
              </span>
              {save && <SaveIndicator save={save} onExport={onExport} />}
            </div>
          )}
          <IconButton
            ref={sidebarClose}
            label="Fechar painel"
            className="ml-auto desk:hidden"
            onClick={() => setSidebarOpen(false)}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </header>
        <GenerateSidebar
          world={world}
          collapsed={sidebarCollapsed}
          canCollapse={desktop}
          onCollapsedChange={(collapsed) => ui.getState().setSidebarCollapsed(collapsed)}
        />
      </aside>

      <div
        data-testid="actions"
        inert={anyOpen}
        className={[
          'absolute top-3 right-3 z-10 flex h-14 items-center rounded-panel bg-paper px-1 shadow-md backdrop-blur-[14px] desk:gap-0.5 desk:px-1.5',
          'transition-[right] duration-200 ease-[var(--ease-panel)]',
          pinSelected ? 'desk:right-[calc(var(--drawer-width)+12px)]' : '',
        ].join(' ')}
      >
        <IconButton ref={sidebarOpener} label="Abrir painel" className="desk:hidden" onClick={() => setSidebarOpen(true)}>
          <PanelLeftOpen size={20} aria-hidden="true" />
        </IconButton>
        <IconButton ref={drawerOpener} label="Abrir detalhes" className="desk:hidden" onClick={() => setDrawerOpen(true)}>
          <PanelRightOpen size={20} aria-hidden="true" />
        </IconButton>
        <SearchButton ref={searchButton} label={searchLabel} onClick={openSearch} />
        <IconButton ref={undoButton} label="Desfazer" title="Desfazer (Ctrl+Z)" keyShortcuts="Control+Z" disabled={!canUndo} onClick={() => history.undo()}>
          <Undo2 size={20} aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Refazer"
          title="Refazer (Ctrl+Shift+Z)"
          keyShortcuts="Control+Shift+Z"
          disabled={!canRedo}
          onClick={() => history.redo()}
        >
          <Redo2 size={20} aria-hidden="true" />
        </IconButton>
        <ExportMenu onExportJson={onExport} />
        <IconButton
          label={theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'}
          onClick={toggle}
        >
          {theme === 'light' ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
        </IconButton>
        <IconButton label="Ajuda" title="Ajuda ( ? )" keyShortcuts="?" onClick={openHelp}>
          <CircleHelp size={20} aria-hidden="true" />
        </IconButton>
      </div>

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocus={helpReturn} />
      <SearchDialog
        open={searchOpen}
        pins={pins}
        images={images}
        onChoose={chooseSearchResult}
        onClose={() => setSearchOpen(false)}
        returnFocus={searchReturn}
      />

      <aside
        aria-label="Detalhes"
        data-testid="drawer"
        data-open={drawerOpen}
        inert={sidebarOpen}
        className={[
          'absolute inset-y-0 right-0 z-20 flex w-[min(var(--drawer-width),100vw)] flex-col',
          'bg-paper-solid shadow-lg',
          // Ao fechar, a visibilidade entra na transição: o drawer some só depois de deslizar. Ao abrir,
          // não: ele fica visível na hora, e o foco pode ir para dentro dele (o nome do pin novo).
          drawerShown ? 'transition-transform' : 'transition-[transform,visibility]',
          'duration-200 ease-[var(--ease-panel)]',
          drawerOpen ? 'translate-x-0' : 'invisible translate-x-full',
          // A partir de 768 px: à vista só com um pin; sem ele, fora da tela, sombra incluída.
          pinSelected ? 'desk:visible desk:translate-x-0' : 'desk:invisible desk:translate-x-[calc(100%+32px)]',
          'desk:w-[var(--drawer-width)]',
        ].join(' ')}
      >
        <div className="flex h-14 shrink-0 items-center justify-end px-3 desk:hidden">
          <IconButton ref={drawerClose} label="Fechar detalhes" onClick={closeDrawer}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <PinDrawer
          pins={pins}
          images={images}
          world={world}
          camera={camera}
          onDelete={deleteFromDrawer}
          // Abaixo de 768 px, o painel sobreposto cobre o mapa: fecha para a câmera aparecer (o pin continua selecionado).
          onCentered={() => setDrawerOpen(false)}
        />
      </aside>
    </div>
  )
}

/** Largura do elemento, acompanhada pelo `ResizeObserver` (`null` antes de medir, ou sem ele, como no jsdom). */
function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/**
 * Fica `true` dois quadros depois de a largura ser medida (`width` deixa de ser `null`): até lá, as
 * transições da linha inferior ficam desligadas, para o primeiro layout não aparecer animado.
 */
function useAnimatedAfterMeasure(width: number | null) {
  const [animated, setAnimated] = useState(false)
  const measured = width !== null
  useEffect(() => {
    if (!measured || animated) return
    // Dois quadros: o primeiro desenha a posição medida; só no seguinte a transição liga (num quadro só,
    // a posição nova e a transição podem entrar no mesmo cálculo de estilo e animar mesmo assim).
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setAnimated(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [measured, animated])
  return animated
}

/** Se a tela tem 768 px ou mais de largura e 500 px ou mais de altura (sidebar e drawer fixos, AC-F2-14). */
function useDesktop() {
  return useMedia(DESKTOP_QUERY)
}

/** Se a media query vale agora, acompanhando a troca (o giro do celular, por exemplo). */
function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = (e: { matches: boolean }) => setMatches(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Tipos de `input` que não recebem texto: neles a tecla `[` continua sendo o atalho. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file', 'image'])

/** Foco num campo de texto: aí a tecla `[` é do campo. */
function isTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest('textarea, select')) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)
}


/**
 * Ao abrir o painel, foca o botão de fechar (se o foco já não está dentro dele: o nome do pin novo,
 * em edição); ao fechar, devolve o foco a quem o abriu.
 */
function usePanelFocus(
  open: boolean,
  closeButton: RefObject<HTMLButtonElement | null>,
  opener: RefObject<HTMLButtonElement | null>,
) {
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) {
      if (!closeButton.current?.closest('aside')?.contains(document.activeElement)) closeButton.current?.focus()
    }
    else if (wasOpen.current) opener.current?.focus()
    wasOpen.current = open
  }, [open, closeButton, opener])
}

/** A partir desta largura da área livre (e de 768 px de tela), Buscar mostra o rótulo e o atalho. */
const SEARCH_LABEL_FROM = 420

/**
 * Buscar (Ctrl K): abre o modal de busca dos pins. Com `label`, parece um campo com o rótulo e a
 * tecla; sem, só o ícone (área livre estreita e celular).
 */
function SearchButton({ ref, label, onClick }: { ref?: Ref<HTMLButtonElement>; label: boolean; onClick: () => void }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Buscar"
      aria-keyshortcuts="Control+K"
      aria-haspopup="dialog"
      title="Buscar (Ctrl+K)"
      onClick={onClick}
      data-testid="search-button"
      data-label={label}
      className={
        label
          ? 'mr-1.5 flex h-10 shrink-0 items-center gap-2 rounded-control border border-line bg-field pr-2 pl-2.5 text-[13px] font-semibold text-ink-2 hover:border-ink-3 active:bg-press'
          : 'grid size-11 shrink-0 place-items-center rounded-control text-ink hover:bg-hover active:bg-press'
      }
    >
      <Search size={label ? 18 : 20} aria-hidden="true" />
      {label && (
        <>
          <span aria-hidden="true">Buscar</span>
          <kbd aria-hidden="true" className="rounded-[4px] border border-line bg-sunken px-[5px] font-sans text-[11px]/[18px] font-bold">
            Ctrl K
          </kbd>
        </>
      )}
    </button>
  )
}

/**
 * Botão de ícone da barra (44 × 44). `title` é o texto do tooltip (o rótulo, se não vier). Com
 * `disabled`, a função ainda não existe: opacidade .4 (design system → Botão de ícone).
 */
function IconButton({
  ref,
  label,
  title = label,
  keyShortcuts,
  disabled = false,
  className = '',
  onClick,
  children,
}: {
  ref?: Ref<HTMLButtonElement>
  label: string
  title?: string
  keyShortcuts?: string
  disabled?: boolean
  className?: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-keyshortcuts={keyShortcuts}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-11 shrink-0 place-items-center rounded-control text-ink enabled:hover:bg-hover enabled:active:bg-press disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}
