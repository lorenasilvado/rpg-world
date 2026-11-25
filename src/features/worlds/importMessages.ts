import type { ImportRefusal } from '../../persistence/exportImport'

/** Por que a importação não deu certo: a recusa do arquivo ou a gravação no banco. */
export type ImportFailureReason = ImportRefusal | 'save-failed'

/** O arquivo que não entrou: o nome, o tamanho e o motivo. */
export type ImportFailure = { fileName: string; size: number; reason: ImportFailureReason }

/** O título do alerta e o texto de cada motivo: a causa e o passo para corrigir. */
export function importMessage(reason: ImportFailureReason): { title: string; text: string } {
  const invalid = 'Este arquivo não é um mundo válido'
  const reexport = 'Abra o mundo de origem, use Exportar › Arquivo do mundo (.json) e tente de novo.'
  switch (reason) {
    case 'not-json':
      return { title: invalid, text: `O arquivo não está em JSON: pode ser de outro tipo ou estar corrompido. ${reexport}` }
    case 'not-world':
      return { title: invalid, text: `O arquivo é um JSON, mas não é um mundo do RPG World Builder. ${reexport}` }
    case 'no-terrain':
      return { title: invalid, text: `Falta a parte do terreno. ${reexport}` }
    case 'newer-version':
      return {
        title: invalid,
        text: 'O mundo foi criado numa versão mais nova do gerador. Recarregue a página para atualizar o app e tente de novo.',
      }
    case 'save-failed':
      return {
        title: 'Não foi possível importar o mundo',
        text: 'O navegador não conseguiu gravar o mundo. Tente de novo; se continuar, libere espaço no navegador.',
      }
  }
}

/** O tamanho do arquivo, como no explorador: "512 B", "48 KB", "1,2 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}
