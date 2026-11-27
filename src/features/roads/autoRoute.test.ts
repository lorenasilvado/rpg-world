import { describe, expect, it } from 'vitest'
import { noPathMessage, routeHint, routeName, seaRouteName } from './autoRoute'

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

describe('Sem caminho e rota marítima: textos (AC-F5-13)', () => {
  it('o toast diz que não há caminho por terra, ou nenhum caminho', () => {
    expect(noPathMessage('Porto', 'Ilha')).toBe('Não há caminho por terra entre Porto e Ilha.')
    expect(noPathMessage('Lago Norte', 'Lago Sul', { sea: true })).toBe('Não há caminho entre Lago Norte e Lago Sul.')
  })

  it('o nome é "Rota marítima de A a B"', () => {
    expect(seaRouteName('Porto', 'Ilha')).toBe('Rota marítima de Porto a Ilha')
  })
})
