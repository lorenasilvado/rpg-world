import { useEffect, useState, type RefObject } from 'react'

/** Quanto tempo o botão copiar mostra o check depois de copiar. */
export const COPIED_MS = 1500

/**
 * Copiar a seed: põe a seed na área de transferência e conta as cópias (`copied`, 0 quando o check
 * some, 1,5 s depois da última). Sem acesso à área de transferência, a seed fica selecionada no
 * campo `input`, para o Ctrl+C.
 */
export function useCopySeed(seed: string, input: RefObject<HTMLInputElement | null>) {
  /** Quantas vezes a seed foi copiada (0: nenhuma, ou o check já sumiu); cada cópia reinicia o check. */
  const [copied, setCopied] = useState(0)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(0), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])
  const copy = () => {
    const done = () => setCopied((n) => n + 1)
    const fallback = () => input.current?.select()
    if (navigator.clipboard) navigator.clipboard.writeText(seed).then(done, fallback)
    else fallback()
  }
  return { copied, copy }
}
