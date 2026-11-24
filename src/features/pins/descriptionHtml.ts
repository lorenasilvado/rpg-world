import type { Editor } from '@tiptap/react'

/** O texto da descrição vazia. */
export const DESCRIPTION_PLACEHOLDER = 'Escreva sobre este lugar…'

/**
 * O HTML salvo da descrição (AC-F3-07): sem os parágrafos vazios do fim (o TipTap deixa um depois
 * de uma lista ou de um título, para o cursor poder sair deles), e vazia como `''`.
 */
export function descriptionHtml(editor: Pick<Editor, 'isEmpty' | 'getHTML'>): string {
  return editor.isEmpty ? '' : trimEmptyParagraphs(editor.getHTML())
}

/** Tira os `<p></p>` do fim do HTML. */
export function trimEmptyParagraphs(html: string): string {
  return html.replace(/(?:<p><\/p>)+$/, '')
}
