import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('mostra a tela inicial sem erro', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'RPG World Builder' })).toBeTruthy()
  })
})
