import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BAR_SIDE, TOAST_WIDTH } from '../map/bottomBarLayout'
import { PinsOnWaterToast } from './PinsOnWaterToast'

afterEach(cleanup)

describe('posição do aviso de pins sobre a água (AC-F1-30)', () => {
  const noop = () => {}

  it('ao lado do zoom: com a largura do toast, a `right` da linha', () => {
    render(<PinsOnWaterToast open={1} count={2} onShow={noop} onClose={noop} bottom={70} right={12} />)
    const toast = screen.getByTestId('pins-on-water-toast')
    expect(toast.style.width).toBe(`${TOAST_WIDTH}px`)
    expect(toast.style.left).toBe('')
    expect(toast.style.bottom).toBe('70px')
    expect(toast.style.right).toBe('12px')
  })

  it('na área estreita: na largura da área livre, de BAR_SIDE até a `right`, sem largura fixa', () => {
    render(<PinsOnWaterToast open={1} count={1} onShow={noop} onClose={noop} beside={false} bottom={220} right={12} />)
    const toast = screen.getByTestId('pins-on-water-toast')
    expect(toast.style.width).toBe('')
    expect(toast.style.left).toBe(`${BAR_SIDE}px`)
    expect(toast.style.right).toBe('12px')
    expect(toast.style.bottom).toBe('220px')
    expect(toast.textContent).toContain('1 pin ficou sobre a água')
  })

  it('fechado, não aparece', () => {
    render(<PinsOnWaterToast open={null} count={0} onShow={noop} onClose={noop} />)
    expect(screen.queryByTestId('pins-on-water-toast')).toBeNull()
  })
})
