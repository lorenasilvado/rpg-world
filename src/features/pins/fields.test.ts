import { describe, expect, it } from 'vitest'
import { FIELD_KEY_MAX, FIELD_VALUE_MAX, addField, removeField, renameField, setFieldValue } from './fields'

describe('campos livres do pin (AC-F3-10)', () => {
  it('um campo novo entra no fim, vazio, como "Campo" (ou "Campo 2"… se já existe)', () => {
    expect(addField({})).toEqual({ fields: { Campo: '' }, key: 'Campo' })
    const second = addField({ rei: 'Aldo', campo: 'x' })
    expect(second.key).toBe('Campo 2')
    expect(Object.keys(second.fields)).toEqual(['rei', 'campo', 'Campo 2'])
  })

  it('trocar a chave mantém o lugar e o valor', () => {
    const next = renameField({ a: '1', b: '2', c: '3' }, 'b', '  Governante ')
    expect(next).toEqual({ a: '1', Governante: '2', c: '3' })
    expect(Object.keys(next!)).toEqual(['a', 'Governante', 'c'])
  })

  it('a chave vazia ou repetida (sem diferenciar maiúsculas) não entra', () => {
    expect(renameField({ a: '1', b: '2' }, 'b', '   ')).toBeNull()
    expect(renameField({ Rei: '1', b: '2' }, 'b', 'rei')).toBeNull()
    expect(renameField({ a: '1' }, 'x', 'y')).toBeNull()
  })

  it('a chave só de dígitos não entra: o campo não muda de lugar', () => {
    expect(renameField({ a: '1', b: '2' }, 'b', '1200')).toBeNull()
    expect(renameField({ a: '1', b: '2' }, 'b', ' 42 ')).toBeNull()
    // Com outro caractere, vale e fica no lugar.
    expect(Object.keys(renameField({ a: '1', b: '2' }, 'b', 'Ano 1200')!)).toEqual(['a', 'Ano 1200'])
    expect(Object.keys(renameField({ a: '1', b: '2' }, 'b', '1200a')!)).toEqual(['a', '1200a'])
  })

  it('a mesma chave com outra grafia vale', () => {
    expect(renameField({ rei: 'Aldo' }, 'rei', 'Rei')).toEqual({ Rei: 'Aldo' })
  })

  it('a chave e o valor são cortados no limite', () => {
    expect(Object.keys(renameField({ a: '' }, 'a', 'x'.repeat(60))!)[0]).toHaveLength(FIELD_KEY_MAX)
    expect(setFieldValue({ a: '' }, 'a', 'y'.repeat(300)).a).toHaveLength(FIELD_VALUE_MAX)
  })

  it('remover tira só aquele campo', () => {
    expect(removeField({ a: '1', b: '2' }, 'a')).toEqual({ b: '2' })
  })
})
