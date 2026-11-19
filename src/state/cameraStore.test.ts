import { describe, expect, it, vi } from 'vitest'
import { createCameraStore } from './cameraStore'

const view = { zoom: 1, scale: 0.7, view: { x: 0, y: 0, width: 1024, height: 1280 } }

describe('cameraStore', () => {
  it('fica pronto na primeira vista e só avisa quando algo muda', () => {
    const camera = createCameraStore()
    expect(camera.getState().ready).toBe(false)
    const listener = vi.fn()
    camera.subscribe(listener)
    camera.getState().update(view)
    camera.getState().update({ ...view, view: { ...view.view } })
    expect(camera.getState().ready).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    camera.getState().update({ ...view, zoom: 1.25 })
    expect(camera.getState().zoom).toBe(1.25)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('sem os comandos do renderer, deixa de estar pronto', () => {
    const camera = createCameraStore()
    const controls = { zoomIn: vi.fn(), zoomOut: vi.fn(), center: vi.fn(), centerOn: vi.fn() }
    camera.getState().setControls(controls)
    camera.getState().update(view)
    expect(camera.getState().controls).toBe(controls)
    camera.getState().setControls(null)
    expect(camera.getState().controls).toBeNull()
    expect(camera.getState().ready).toBe(false)
  })
})
