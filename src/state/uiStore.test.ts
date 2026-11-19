import { describe, expect, it, vi } from 'vitest'
import { createUiStore } from './uiStore'

describe('uiStore', () => {
  it('abre com a camada de decoração ligada', () => {
    expect(createUiStore().getState().layers.decor).toBe(true)
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
})
