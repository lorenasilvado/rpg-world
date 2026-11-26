import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { BIOME, DEFAULT_WORLD_PARAMS, type CoreField } from './core'
import { BAR_GAP, TOAST_HEIGHT, ZOOM_BAR_HEIGHT } from './features/map/bottomBarLayout'
import { PIN_DELETED_TOAST_MS } from './features/pins/PinDeletedToast'
import { PINS_ON_WATER_TOAST_MS } from './features/pins/PinsOnWaterToast'
import { MAP_SIZE, PREVIEW_SIZE } from './state/sizes'
import type { Pin } from './persistence/types'
import { createPinsStore } from './state/pinsStore'
import type { CreateMapRenderer } from './app/MapView'
import { createWorldStore, type WorldGenerator } from './state/worldStore'

/** Um gerador que nunca responde: os testes de layout não dependem da geração. */
const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }
const world = () => createWorldStore(idleGenerator)
/** O jsdom não tem WebGL: o mapa não é desenhado nestes testes. */
const noRenderer: CreateMapRenderer = async () => ({ refit() {}, destroy() {} })

// jsdom não tem matchMedia: este stub guarda os ouvintes para simular a troca de largura.
let mediaListeners: Array<(e: { matches: boolean }) => void> = []
beforeEach(() => {
  mediaListeners = []
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: false,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => mediaListeners.push(fn),
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      mediaListeners = mediaListeners.filter((l) => l !== fn)
    },
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.theme
})

describe('Layout vazio do editor', () => {
  it('mostra a sidebar, o mapa e o drawer (AC-M0-01)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    expect(screen.getByRole('complementary', { name: 'Gerar mundo' })).toBeTruthy()
    expect(screen.getByRole('main', { name: 'Mapa' })).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'Detalhes' })).toBeTruthy()
  })

  it('alterna entre tema claro e escuro (AC-M0-03)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('abre e fecha a sidebar e o drawer pelos botões (AC-M0-02)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    const sidebar = screen.getByTestId('sidebar')
    const drawer = screen.getByTestId('drawer')
    expect(sidebar.dataset.open).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel' }))
    expect(sidebar.dataset.open).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    expect(sidebar.dataset.open).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes' }))
    expect(drawer.dataset.open).toBe('true')
    // O clique que não começou no scrim (o que o navegador gera depois do toque que abriu o drawer,
    // AC-F2-15) não fecha; o que começou nele, fecha.
    fireEvent.click(screen.getByTestId('scrim'))
    expect(drawer.dataset.open).toBe('true')
    fireEvent.pointerDown(screen.getByTestId('scrim'))
    fireEvent.click(screen.getByTestId('scrim'))
    expect(drawer.dataset.open).toBe('false')
  })

  it('um aperto no scrim que não virou clique não vale para o próximo painel', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    const drawer = screen.getByTestId('drawer')
    // Aperta no scrim e fecha pelo botão (o aperto fica pela metade).
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes' }))
    fireEvent.pointerDown(screen.getByTestId('scrim'))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }))
    expect(drawer.dataset.open).toBe('false')
    // O painel abre de novo: o clique que não começou no scrim não o fecha.
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes' }))
    fireEvent.click(screen.getByTestId('scrim'))
    expect(drawer.dataset.open).toBe('true')
    // Um aperto cancelado também não vale.
    fireEvent.pointerDown(screen.getByTestId('scrim'))
    fireEvent.pointerCancel(screen.getByTestId('scrim'))
    fireEvent.click(screen.getByTestId('scrim'))
    expect(drawer.dataset.open).toBe('true')
  })

  it('Esc fecha o painel aberto e o foco volta ao botão que o abriu', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    const opener = screen.getByRole('button', { name: 'Abrir painel' })
    opener.focus()
    fireEvent.click(opener)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar painel' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('sidebar').dataset.open).toBe('false')
    expect(document.activeElement).toBe(opener)

    const drawerOpener = screen.getByRole('button', { name: 'Abrir detalhes' })
    fireEvent.click(drawerOpener)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar detalhes' }))
    fireEvent.pointerDown(screen.getByTestId('scrim'))
    fireEvent.click(screen.getByTestId('scrim'))
    expect(document.activeElement).toBe(drawerOpener)
  })

  it('com um painel aberto, o resto da tela fica inert', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel' }))
    expect(screen.getByTestId('actions').hasAttribute('inert')).toBe(true)
    expect(screen.getByTestId('map').hasAttribute('inert')).toBe(true)
    expect(screen.getByTestId('drawer').hasAttribute('inert')).toBe(true)
    expect(screen.getByTestId('sidebar').hasAttribute('inert')).toBe(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('actions').hasAttribute('inert')).toBe(false)
  })

  it('ao passar para 768 px ou mais, os painéis abertos fecham', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes' }))
    expect(screen.getByTestId('drawer').dataset.open).toBe('true')
    act(() => mediaListeners.forEach((fn) => fn({ matches: true })))
    expect(screen.getByTestId('drawer').dataset.open).toBe('false')
  })
})

describe('Barras do editor e Ajuda', () => {
  it('a barra superior tem Exportar desabilitado, Desfazer e Refazer sem o que fazer, e Buscar, tema e Ajuda ativos (AC-F2-10)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    const actions = screen.getByTestId('actions')
    for (const name of ['Desfazer', 'Refazer', 'Exportar']) {
      const button = actions.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)
      expect(button?.disabled, name).toBe(true)
    }
    for (const name of ['Buscar', 'Usar tema escuro', 'Ajuda']) {
      expect(actions.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)?.disabled, name).toBe(false)
    }
    expect(screen.getByRole('toolbar', { name: 'Ferramentas' })).toBeTruthy()
  })

  it('Ajuda abre o modal "Atalhos de teclado" com os atalhos que funcionam, e Fechar o fecha (AC-F2-12)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajuda' }))
    const dialog = screen.getByRole('dialog', { name: 'Atalhos de teclado' })
    const rows = Array.from(dialog.querySelectorAll('dt')).map((dt) => `${dt.textContent} ${dt.nextElementSibling?.textContent}`)
    expect(rows).toEqual(['Navegar V', 'Adicionar pin P', 'Desenhar estrada R', 'Rota automática A', 'Medir distância M', 'Mover o mapa Setas / WASD', 'Zoom + / −', 'Centralizar mapa 0', 'Excluir pin Delete / Backspace', 'Buscar pins Ctrl K', 'Desfazer Ctrl Z', 'Refazer Ctrl Shift Z', 'Recolher painel [', 'Cancelar / fechar Esc', 'Atalhos ?'])
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog', { name: 'Atalhos de teclado' })).toBeNull()
  })

  it('a tecla ? abre o modal, menos com o foco num campo (AC-F2-12)', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    seed.focus()
    fireEvent.keyDown(seed, { key: '?' })
    expect(screen.queryByRole('dialog', { name: 'Atalhos de teclado' })).toBeNull()
    seed.blur()
    fireEvent.keyDown(document.body, { key: '?' })
    expect(screen.getByRole('dialog', { name: 'Atalhos de teclado' })).toBeTruthy()
  })

  it('com um painel aberto (celular), a tecla ? não abre o modal', () => {
    render(<App world={world()} createRenderer={noRenderer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel' }))
    fireEvent.keyDown(document.body, { key: '?' })
    expect(screen.queryByRole('dialog', { name: 'Atalhos de teclado' })).toBeNull()
  })
})

describe('Sem WebGL2 (AC-F1-20)', () => {
  it('mostra o aviso com os navegadores suportados no lugar do editor', () => {
    render(<App world={world()} createRenderer={noRenderer} webgl2={false} />)
    expect(screen.queryByTestId('editor')).toBeNull()
    expect(screen.queryByRole('main', { name: 'Mapa' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Este navegador não tem WebGL2' })).toBeTruthy()
    const browsers = screen.getByRole('list', { name: 'Navegadores suportados' })
    expect(browsers.textContent).toContain('Google Chrome')
    expect(browsers.textContent).toContain('Microsoft Edge')
    expect(browsers.textContent).toContain('Mozilla Firefox')
    expect(browsers.textContent).toContain('Safari')
  })

  it('o aviso alterna entre tema claro e escuro, como o editor', () => {
    render(<App world={world()} createRenderer={noRenderer} webgl2={false} />)
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('Excluir, desfazer e refazer (AC-F3-05, AC-F4-08)', () => {
  const savedPin = (id: string): Pin => ({
    id,
    type: 'vila',
    name: `Pin ${id}`,
    pos: { u: 0.4, v: 0.6 },
    icon: { kind: 'builtin', key: 'vila' },
    description: '<p>A ficha</p>',
    tags: ['porto'],
    fields: { população: '300' },
  })

  // A partir de 768 px: o drawer é fixo, e selecionar um pin não abre o painel sobreposto.
  beforeEach(() => {
    const narrow = window.matchMedia
    window.matchMedia = ((query: string) => ({ ...narrow(query), matches: true })) as typeof window.matchMedia
  })

  function editor() {
    const w = world()
    const pins = createPinsStore([savedPin('a'), savedPin('b')])
    render(<App world={w} pins={pins} createRenderer={noRenderer} />)
    const button = (name: string) => screen.getByTestId('actions').querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!
    return { w, pins, button }
  }

  it('Delete exclui o pin selecionado na hora, sem confirmação, com o toast "Pin excluído"; Desfazer o devolve com a ficha inteira', () => {
    const { pins } = editor()
    const b = pins.getState().pins[1]
    act(() => pins.getState().select('b'))
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(pins.getState().pins.map((p) => p.id)).toEqual(['a'])
    expect(screen.queryByRole('dialog')).toBeNull()
    const toast = screen.getByTestId('pin-deleted-toast')
    expect(toast.textContent).toContain('Pin excluído')
    fireEvent.click(within(toast).getByRole('button', { name: 'Desfazer' }))
    expect(pins.getState().pins[1]).toEqual(b)
    expect(screen.queryByTestId('pin-deleted-toast')).toBeNull()
  })

  it('Delete sem pin selecionado, ou com o foco num campo, não exclui', () => {
    const { pins } = editor()
    fireEvent.keyDown(document.body, { key: 'Delete' })
    act(() => pins.getState().select('a'))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Nome do pin' }), { key: 'Delete' })
    expect(pins.getState().pins).toHaveLength(2)
  })

  it('o toast some sozinho depois de alguns segundos', () => {
    vi.useFakeTimers()
    try {
      const { pins } = editor()
      act(() => pins.getState().select('a'))
      fireEvent.keyDown(document.body, { key: 'Delete' })
      expect(screen.getByTestId('pin-deleted-toast')).toBeTruthy()
      act(() => vi.advanceTimersByTime(PIN_DELETED_TOAST_MS))
      expect(screen.queryByTestId('pin-deleted-toast')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('Ctrl+Z desfaz e Ctrl+Shift+Z refaz, e os botões da barra ficam habilitados quando há o que fazer', () => {
    const { pins, button } = editor()
    act(() => pins.getState().select('a'))
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(button('Desfazer').disabled).toBe(false)
    expect(button('Refazer').disabled).toBe(true)

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(pins.getState().pins).toHaveLength(2)
    expect(screen.queryByTestId('pin-deleted-toast')).toBeNull()
    expect(button('Desfazer').disabled).toBe(true)
    expect(button('Refazer').disabled).toBe(false)

    fireEvent.keyDown(document.body, { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(pins.getState().pins).toHaveLength(1)
    fireEvent.click(button('Desfazer'))
    expect(pins.getState().pins).toHaveLength(2)
    fireEvent.click(button('Refazer'))
    expect(pins.getState().pins).toHaveLength(1)
  })

  it('desfaz e refaz os parâmetros de geração no mesmo histórico dos pins', () => {
    const { w, pins } = editor()
    act(() => {
      w.getState().releaseParams({ ocean: 20 })
      pins.getState().removePin('a')
    })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(pins.getState().pins).toHaveLength(2)
    expect(w.getState().params.ocean).toBe(20)
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(w.getState().params.ocean).toBe(DEFAULT_WORLD_PARAMS.ocean)
  })

  it('com o toast de erro da geração à vista, o "Pin excluído" fica empilhado acima dele, sem cobri-lo', async () => {
    const failing: WorldGenerator = { request: () => Promise.reject(new Error('worker')), latestVersion: () => 1 }
    const w = createWorldStore(failing)
    const pins = createPinsStore([savedPin('a')])
    render(<App world={w} pins={pins} createRenderer={noRenderer} />)
    await act(async () => {
      w.getState().generate()
      await Promise.resolve()
    })
    const error = screen.getByTestId('generation-error-toast')
    act(() => pins.getState().select('a'))
    fireEvent.keyDown(document.body, { key: 'Delete' })
    const deleted = screen.getByTestId('pin-deleted-toast')
    const px = (el: HTMLElement) => Number.parseFloat(el.style.bottom)
    expect(px(deleted)).toBe(px(error) + TOAST_HEIGHT + BAR_GAP)

    // Sem o erro, o toast fica no lugar dos toasts.
    act(() => w.setState({ status: 'idle' }))
    expect(px(screen.getByTestId('pin-deleted-toast'))).toBe(ZOOM_BAR_HEIGHT + BAR_GAP)
  })

  it('desfazer e refazer um nome atualizam o campo do nome no drawer', () => {
    const { pins, button } = editor()
    act(() => pins.getState().select('a'))
    const field = screen.getByRole('textbox', { name: 'Nome do pin' }) as HTMLInputElement
    act(() => field.focus())
    fireEvent.change(field, { target: { value: 'Pin a Alta' } })
    act(() => field.blur())
    act(() => field.focus())
    fireEvent.change(field, { target: { value: 'Pin a Alta do Rio' } })
    act(() => field.blur())

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(pins.getState().pins[0].name).toBe('Pin a Alta')
    expect(field.value).toBe('Pin a Alta')
    fireEvent.click(button('Desfazer'))
    expect(field.value).toBe('Pin a')
    fireEvent.click(button('Refazer'))
    expect(field.value).toBe('Pin a Alta')

    // Uma tecla depois de desfazer parte do nome desfeito, não do que estava no campo antes.
    fireEvent.click(button('Desfazer'))
    act(() => field.focus())
    fireEvent.change(field, { target: { value: 'Pin a!' } })
    expect(pins.getState().pins[0].name).toBe('Pin a!')
  })

  it('Backspace também exclui o pin selecionado (a tecla "delete" do Mac), menos com o foco num campo', () => {
    const { pins } = editor()
    act(() => pins.getState().select('a'))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Nome do pin' }), { key: 'Backspace' })
    expect(pins.getState().pins).toHaveLength(2)
    fireEvent.keyDown(document.body, { key: 'Backspace' })
    expect(pins.getState().pins.map((p) => p.id)).toEqual(['b'])
    expect(screen.getByTestId('pin-deleted-toast')).toBeTruthy()
  })

  it('Ctrl+Z e Ctrl+Shift+Z não valem com um slider sendo arrastado: soltar não apaga o que havia para refazer', () => {
    const { w, pins, button } = editor()
    act(() => {
      pins.getState().removePin('a')
    })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(button('Refazer').disabled).toBe(false)

    act(() => {
      w.getState().dragParams({ ocean: 20 })
    })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(pins.getState().pins).toHaveLength(2)
    act(() => {
      w.getState().releaseParams()
    })
    // O arrasto entrou como um passo novo; desfazê-lo volta ao Oceano de antes, e o pin continua.
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(w.getState().params.ocean).toBe(DEFAULT_WORLD_PARAMS.ocean)
    expect(pins.getState().pins).toHaveLength(2)
  })

  it('Ctrl+Z com o foco num campo de texto é do campo, não do mundo', () => {
    const { pins } = editor()
    act(() => {
      pins.getState().removePin('b')
      pins.getState().select('a')
    })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Nome do pin' }), { key: 'z', ctrlKey: true })
    expect(pins.getState().pins).toHaveLength(1)
  })
})

describe('Buscar (Ctrl K, AC-F3-16)', () => {
  const searchPin = (id: string, name: string, tags: string[] = []): Pin => ({
    id,
    type: 'cidade',
    name,
    pos: { u: 0.5, v: 0.5 },
    icon: { kind: 'builtin', key: 'cidade' },
    description: '',
    tags,
    fields: {},
  })

  // A partir de 768 px: o drawer é fixo.
  beforeEach(() => {
    const narrow = window.matchMedia
    window.matchMedia = ((query: string) => ({ ...narrow(query), matches: true })) as typeof window.matchMedia
  })

  function editor(pinList = [searchPin('v', 'Valdora', ['capital', 'porto']), searchPin('p', 'Porto Velho'), searchPin('t', 'Torre do Mago', ['ruína'])]) {
    const pins = createPinsStore(pinList)
    render(<App world={world()} pins={pins} createRenderer={noRenderer} />)
    return { pins }
  }
  const input = () => screen.getByRole('combobox', { name: 'Buscar pins' })
  const options = () => screen.queryAllByRole('option').map((o) => o.textContent)

  it('o botão Buscar abre o modal com o campo vazio e o foco nele', () => {
    editor()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(screen.getByRole('dialog', { name: 'Buscar pins' })).toBeTruthy()
    expect(document.activeElement).toBe(input())
    expect(screen.getByTestId('search-status').textContent).toBe('Digite o nome ou uma tag do pin.')
  })

  it('Ctrl K abre o modal, mesmo com o foco num campo', () => {
    editor()
    const seed = screen.getByRole('textbox', { name: 'Seed' })
    seed.focus()
    fireEvent.keyDown(seed, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Buscar pins' })).toBeTruthy()
  })

  it('acha por nome e por tag, e mostra a tag que bateu', () => {
    editor()
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })
    fireEvent.change(input(), { target: { value: 'port' } })
    expect(options()).toEqual(['Porto VelhoCidade', 'ValdoraCidadeporto'])
    fireEvent.change(input(), { target: { value: 'ruina' } })
    expect(options()).toEqual(['Torre do MagoCidaderuína'])
    fireEvent.change(input(), { target: { value: 'xyz' } })
    expect(options()).toEqual([])
    expect(screen.getByTestId('search-status').textContent).toBe('Nenhum pin com “xyz”.')
  })

  it('as setas andam pela lista, e Enter seleciona o pin e fecha o modal', () => {
    const { pins } = editor()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.change(input(), { target: { value: 'port' } })
    const active = () => document.getElementById(input().getAttribute('aria-activedescendant') ?? '')?.textContent
    expect(active()).toBe('Porto VelhoCidade')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(active()).toBe('ValdoraCidadeporto')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(active()).toBe('Porto VelhoCidade')
    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(pins.getState().selectedId).toBe('v')
    expect(screen.queryByRole('dialog', { name: 'Buscar pins' })).toBeNull()
  })

  it('clicar num resultado seleciona o pin', () => {
    const { pins } = editor()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.change(input(), { target: { value: 'torre' } })
    fireEvent.click(screen.getByRole('option', { name: /Torre do Mago/ }))
    expect(pins.getState().selectedId).toBe('t')
  })

  it('Esc fecha o modal sem mudar a seleção', () => {
    const { pins } = editor()
    act(() => pins.getState().select('p'))
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Buscar pins' })).toBeNull()
    expect(pins.getState().selectedId).toBe('p')
  })

  it('num mundo sem pins, diz que não há pins', () => {
    editor([])
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(screen.getByTestId('search-status').textContent).toBe('Este mundo ainda não tem pins.')
  })
})

describe('Buscar no celular (AC-F3-16, AC-F3-18)', () => {
  it('escolher o pin que já está selecionado, com o painel fechado pelo Centralizar, abre o painel com a ficha e o foco no fechar', () => {
    const pins = createPinsStore([
      { id: 'v', type: 'cidade', name: 'Valdora', pos: { u: 0.5, v: 0.5 }, icon: { kind: 'builtin', key: 'cidade' }, description: '', tags: [], fields: {} },
    ])
    render(<App world={world()} pins={pins} createRenderer={noRenderer} />)
    const drawer = screen.getByTestId('drawer')
    act(() => pins.getState().select('v'))
    expect(drawer.dataset.open).toBe('true')
    fireEvent.click(within(drawer).getByRole('button', { name: 'Centralizar no pin' }))
    expect(drawer.dataset.open).toBe('false')
    expect(pins.getState().selectedId).toBe('v')

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Buscar pins' }), { target: { value: 'vald' } })
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Buscar pins' }), { key: 'Enter' })
    expect(pins.getState().selectedId).toBe('v')
    expect(drawer.dataset.open).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar detalhes' }))
  })
})

describe('Aviso de pins sobre a água (AC-F1-30)', () => {
  const waterPin = (id: string, u: number, v: number): Pin => ({
    id,
    type: 'cidade',
    name: `Pin ${id}`,
    pos: { u, v },
    icon: { kind: 'builtin', key: 'cidade' },
    description: '',
    tags: [],
    fields: {},
  })
  /** Um campo de `size`² com água (oceano) na metade de cima e campo na de baixo, até a linha `waterTo`. */
  const halfWater = (size: number, waterTo = 0.5) => {
    const biome = new Uint8Array(size * size).fill(BIOME.grassland)
    biome.fill(BIOME.deepOcean, 0, Math.floor(waterTo * size) * size)
    return { width: size, height: size, biome } as unknown as CoreField
  }

  beforeEach(() => {
    const narrow = window.matchMedia
    window.matchMedia = ((query: string) => ({ ...narrow(query), matches: true })) as typeof window.matchMedia
  })

  function editor() {
    const w = world()
    // Pins na costa: "a" e "b" ficam debaixo d'água quando a água sobe até 0,7; "c" fica em terra.
    const pins = createPinsStore([waterPin('a', 0.3, 0.6), waterPin('b', 0.7, 0.65), waterPin('c', 0.5, 0.9)])
    const focusOn = vi.fn()
    const withCamera: CreateMapRenderer = async (_host, _world, _insets, _ui, camera) => {
      camera.getState().setControls({ zoomIn() {}, zoomOut() {}, center() {}, centerOn() {}, focusOn })
      return { refit() {}, destroy() {} }
    }
    render(<App world={w} pins={pins} createRenderer={withCamera} />)
    let version = 0
    const deliver = (field: CoreField) => act(() => w.setState({ field, fieldVersion: ++version }))
    return { w, pins, focusOn, deliver }
  }
  const toast = () => screen.queryByTestId('pins-on-water-toast')

  it('o mapa regerado que deixa pins sobre a água mostra o toast; Mostrar centraliza no primeiro, e nenhum pin se move', async () => {
    const { pins, focusOn, deliver } = editor()
    await act(async () => {})
    const before = pins.getState().pins.map((p) => ({ ...p.pos }))
    deliver(halfWater(MAP_SIZE))
    expect(toast()).toBeNull()
    deliver(halfWater(MAP_SIZE, 0.7))
    expect(toast()?.textContent).toContain('2 pins ficaram sobre a água')
    fireEvent.click(within(toast()!).getByRole('button', { name: 'Mostrar' }))
    expect(focusOn).toHaveBeenCalledTimes(1)
    expect(focusOn.mock.calls[0][0]).toBeCloseTo(0.3 * 1024)
    expect(focusOn.mock.calls[0][1]).toBeCloseTo(0.6 * 1024)
    expect(toast()).toBeNull()
    expect(pins.getState().pins.map((p) => p.pos)).toEqual(before)
    // O botão some: o foco vai para o mapa (não para o body), que deixa de ser focável ao perder o foco.
    const mapEl = screen.getByTestId('map')
    expect(document.activeElement).toBe(mapEl)
    act(() => mapEl.blur())
    expect(mapEl.hasAttribute('tabindex')).toBe(false)
  })

  it('o primeiro mapa (ao abrir o mundo) e a prévia do arrasto não avisam; sem pins na água, nenhum toast', () => {
    const { deliver } = editor()
    deliver(halfWater(MAP_SIZE, 0.7))
    expect(toast()).toBeNull()
    deliver(halfWater(PREVIEW_SIZE, 0.7))
    expect(toast()).toBeNull()
    deliver(halfWater(MAP_SIZE, 0.2))
    expect(toast()).toBeNull()
  })

  it('o aviso some sozinho depois de alguns segundos', () => {
    vi.useFakeTimers()
    try {
      const { deliver } = editor()
      deliver(halfWater(MAP_SIZE))
      deliver(halfWater(MAP_SIZE, 0.7))
      expect(toast()).toBeTruthy()
      act(() => vi.advanceTimersByTime(PINS_ON_WATER_TOAST_MS))
      expect(toast()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('com o "Pin excluído" à vista, o aviso fica empilhado acima dele', () => {
    const { pins, deliver } = editor()
    deliver(halfWater(MAP_SIZE))
    act(() => pins.getState().select('c'))
    fireEvent.keyDown(document.body, { key: 'Delete' })
    deliver(halfWater(MAP_SIZE, 0.7))
    const px = (el: HTMLElement) => Number.parseFloat(el.style.bottom)
    expect(px(toast()!)).toBe(px(screen.getByTestId('pin-deleted-toast')) + TOAST_HEIGHT + BAR_GAP)
  })
})

describe('Fechar o drawer do pin a partir de 768 px (#189)', () => {
  const pin: Pin = {
    id: 'v',
    type: 'cidade',
    name: 'Valdora',
    pos: { u: 0.5, v: 0.5 },
    icon: { kind: 'builtin', key: 'cidade' },
    description: '',
    tags: [],
    fields: {},
  }

  beforeEach(() => {
    const narrow = window.matchMedia
    window.matchMedia = ((query: string) => ({ ...narrow(query), matches: true })) as typeof window.matchMedia
  })

  function editor() {
    const pins = createPinsStore([pin])
    render(<App world={world()} pins={pins} createRenderer={noRenderer} />)
    act(() => pins.getState().select('v'))
    return { pins }
  }

  it('pelo botão Fechar, o foco vai para o mapa, não para o body', () => {
    const { pins } = editor()
    const close = within(screen.getByTestId('pin-drawer')).getByRole('button', { name: 'Fechar' })
    close.focus()
    fireEvent.click(close)
    expect(pins.getState().selectedId).toBeNull()
    expect(screen.queryByTestId('pin-drawer')).toBeNull()
    expect(document.activeElement).toBe(screen.getByTestId('map'))
  })

  it('pelo Esc no nome, o foco vai para o mapa, que deixa de ser focável ao perder o foco', () => {
    const { pins } = editor()
    const name = screen.getByRole('textbox', { name: 'Nome do pin' })
    name.focus()
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(pins.getState().selectedId).toBeNull()
    const mapEl = screen.getByTestId('map')
    expect(document.activeElement).toBe(mapEl)
    act(() => mapEl.blur())
    expect(mapEl.hasAttribute('tabindex')).toBe(false)
  })
})

describe('Fechar o drawer do pin abaixo de 768 px (#189)', () => {
  const pin: Pin = {
    id: 'v',
    type: 'cidade',
    name: 'Valdora',
    pos: { u: 0.5, v: 0.5 },
    icon: { kind: 'builtin', key: 'cidade' },
    description: '',
    tags: [],
    fields: {},
  }

  // Sem o override do matchMedia: abaixo de 768 px, selecionar o pin abre o painel sobreposto.
  function editor() {
    const pins = createPinsStore([pin])
    render(<App world={world()} pins={pins} createRenderer={noRenderer} />)
    act(() => pins.getState().select('v'))
    expect(screen.getByTestId('drawer').dataset.open).toBe('true')
    // O mapa fica inerte com o painel aberto (o jsdom não aplica o inert): ele não recebe o foco nem de passagem.
    const mapFocus = vi.fn()
    screen.getByTestId('map').addEventListener('focus', mapFocus)
    return { pins, mapFocus }
  }

  it('pelo Esc no nome, o painel fecha e o foco vai para o Abrir detalhes, não para o mapa', () => {
    const { pins, mapFocus } = editor()
    const name = screen.getByRole('textbox', { name: 'Nome do pin' })
    name.focus()
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(pins.getState().selectedId).toBeNull()
    expect(screen.getByTestId('drawer').dataset.open).toBe('false')
    expect(mapFocus).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir detalhes' }))
    expect(screen.getByTestId('map').hasAttribute('tabindex')).toBe(false)
  })

  it('pelo Fechar detalhes do painel, o foco vai para o Abrir detalhes, não para o mapa', () => {
    const { pins, mapFocus } = editor()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }))
    expect(pins.getState().selectedId).toBeNull()
    expect(screen.getByTestId('drawer').dataset.open).toBe('false')
    expect(mapFocus).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir detalhes' }))
    expect(screen.getByTestId('map').hasAttribute('tabindex')).toBe(false)
  })
})
