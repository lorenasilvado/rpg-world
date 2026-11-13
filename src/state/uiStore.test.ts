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
})
