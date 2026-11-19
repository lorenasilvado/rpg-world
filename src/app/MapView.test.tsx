import { act, cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapRenderer } from '../render/MapRenderer'
import { createCameraStore } from '../state/cameraStore'
import { createUiStore } from '../state/uiStore'
import { createWorldStore, type WorldGenerator } from '../state/worldStore'
import { MapView, type CreateMapRenderer } from './MapView'

const idleGenerator: WorldGenerator = { request: () => new Promise(() => {}), latestVersion: () => 0 }

function fakeRenderer() {
  return {
    refit() {},
    destroy: vi.fn<() => void>(),
    controls: { zoomIn: vi.fn(), zoomOut: vi.fn(), center: vi.fn(), centerOn: vi.fn() },
  }
}

const originalMatchMedia = window.matchMedia
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
})

describe('MapView', () => {
  it('registra os comandos só do renderer que guardou, mesmo se o descartado termina depois (StrictMode)', async () => {
    window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    const camera = createCameraStore()
    const pending: Array<(r: MapRenderer) => void> = []
    const createRenderer: CreateMapRenderer = () => new Promise((resolve) => pending.push(resolve))
    const view = render(
      <StrictMode>
        <MapView world={createWorldStore(idleGenerator)} ui={createUiStore()} camera={camera} inert={false} createRenderer={createRenderer} />
      </StrictMode>,
    )
    // O StrictMode monta, desmonta e monta de novo: dois renderers pedidos, o primeiro descartado.
    expect(pending).toHaveLength(2)
    const [discarded, kept] = [fakeRenderer(), fakeRenderer()]
    await act(async () => pending[1](kept))
    await act(async () => pending[0](discarded))
    expect(discarded.destroy).toHaveBeenCalled()
    expect(camera.getState().controls).toBe(kept.controls)

    view.unmount()
    expect(kept.destroy).toHaveBeenCalled()
    expect(camera.getState().controls).toBeNull()
  })
})
