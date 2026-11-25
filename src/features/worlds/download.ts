/**
 * Baixa um arquivo pelo navegador: um link temporário com `download`, clicado e removido. O
 * endereço do blob é liberado depois, para o navegador terminar de ler.
 */
export function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
