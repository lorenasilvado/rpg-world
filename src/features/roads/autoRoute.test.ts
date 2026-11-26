import { describe, expect, it } from 'vitest'
import { routeHint, routeName } from './autoRoute'

describe('Rota automática: dica e nome (AC-F5-12)', () => {
  it('a dica guia cada passo', () => {
    expect(routeHint('from')).toBe('Clique no pin de origem')
    expect(routeHint('to')).toBe('Agora clique no pin de destino')
    expect(routeHint('calculating')).toBe('Calculando a rota…')
  })

  it('o nome é "Rota de A a B"', () => {
    expect(routeName('Vila Alta', 'Porto Sul')).toBe('Rota de Vila Alta a Porto Sul')
  })
})
