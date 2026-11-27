import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_PARAMS } from '../core'
import { PIN_DELETED_TOAST_MS, PinDeletedToast } from '../features/pins/PinDeletedToast'
import { createWorldHistory } from '../state/history'
import { createPinsStore } from '../state/pinsStore'
import { createWorldStore, type WorldGenerator } from '../state/worldStore'
import { useUndoToast } from './useUndoToast'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

function setup() {
  const world = createWorldStore(idleGenerator, { params: DEFAULT_WORLD_PARAMS })
  const pins = createPinsStore([])
  const history = createWorldHistory({ world, pins })
  let api: ReturnType<typeof useUndoToast> | undefined
  function Harness() {
    api = useUndoToast(history)
    return <PinDeletedToast open={api.open} message={api.message} onUndo={api.undo ? () => {} : undefined} onClose={api.close} />
  }
  render(<Harness />)
  return { pins, show: (message: string, options?: { undo?: boolean }) => act(() => api!.show(message, options)) }
}

const toast = () => screen.queryByTestId('pin-deleted-toast')

describe('useUndoToast', () => {
  it('um toast novo sem passo no histórico (Conectar cidades sem estrada nova) recomeça o tempo', () => {
    vi.useFakeTimers()
    const { show } = setup()
    show('3 estradas criadas')
    act(() => vi.advanceTimersByTime(PIN_DELETED_TOAST_MS - 1000))
    show('Nenhuma estrada nova: as cidades já estão ligadas', { undo: false })
    act(() => vi.advanceTimersByTime(PIN_DELETED_TOAST_MS - 1000))
    expect(toast()?.textContent).toBe('Nenhuma estrada nova: as cidades já estão ligadas')
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
    act(() => vi.advanceTimersByTime(1000))
    expect(toast()).toBeNull()
  })

  it('fecha com outra mudança no histórico depois de aberto', () => {
    const { pins, show } = setup()
    show('Rota criada')
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeTruthy()
    act(() => {
      pins.getState().addPin({ u: 0.5, v: 0.5 })
    })
    expect(toast()).toBeNull()
  })
})
