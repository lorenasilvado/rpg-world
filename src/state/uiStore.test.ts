import { describe, expect, it, vi } from 'vitest'
import { createUiStore } from './uiStore'

describe('uiStore', () => {
  it('abre com a camada de decoração ligada', () => {
    expect(createUiStore().getState().layers.decor).toBe(true)
  })

  it('abre com os pins de todos os tipos à vista e esconde um tipo (AC-F3-15)', () => {
    const ui = createUiStore()
    expect(ui.getState().layers).toMatchObject({ cidade: true, vila: true, castelo: true, masmorra: true, npc: true, poi: true, custom: true })
    ui.getState().setLayer('cidade', false)
    expect(ui.getState().layers.cidade).toBe(false)
    expect(ui.getState().layers.vila).toBe(true)
  })

  it('liga e desliga a decoração, e só avisa quando muda', () => {
    const ui = createUiStore()
    const listener = vi.fn()
    ui.subscribe(listener)
    ui.getState().setLayer('decor', false)
    expect(ui.getState().layers.decor).toBe(false)
    ui.getState().setLayer('decor', false)
    expect(listener).toHaveBeenCalledTimes(1)
    ui.getState().setLayer('decor', true)
    expect(ui.getState().layers.decor).toBe(true)
  })

  it('abre com a sidebar aberta; recolhe e abre, e só avisa quando muda (AC-F1-21)', () => {
    const ui = createUiStore()
    expect(ui.getState().sidebarCollapsed).toBe(false)
    const listener = vi.fn()
    ui.subscribe(listener)
    ui.getState().setSidebarCollapsed(true)
    ui.getState().setSidebarCollapsed(true)
    expect(ui.getState().sidebarCollapsed).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    ui.getState().setSidebarCollapsed(false)
    expect(ui.getState().sidebarCollapsed).toBe(false)
  })

  it('abre com o minimapa aberto; recolhe e abre, e só avisa quando muda (AC-F2-08)', () => {
    const ui = createUiStore()
    expect(ui.getState().minimapOpen).toBe(true)
    const listener = vi.fn()
    ui.subscribe(listener)
    ui.getState().setMinimapOpen(false)
    ui.getState().setMinimapOpen(false)
    expect(ui.getState().minimapOpen).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('abre em Navegar e troca de ferramenta, só avisando quando muda', () => {
    const ui = createUiStore()
    expect(ui.getState().tool).toBe('nav')
    const listener = vi.fn()
    ui.subscribe(listener)
    ui.getState().setTool('measure')
    ui.getState().setTool('measure')
    expect(ui.getState().tool).toBe('measure')
    expect(listener).toHaveBeenCalledTimes(1)
    ui.getState().setTool('nav')
    expect(ui.getState().tool).toBe('nav')
  })
})
