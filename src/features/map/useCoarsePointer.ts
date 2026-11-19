import { useEffect, useState } from 'react'

const COARSE = '(pointer: coarse)'

/**
 * Se o ponteiro principal é de toque (`pointer: coarse`): aí os alvos usam a área de toque mínima
 * (44 px). Acompanha a mudança (ex.: um tablet que ganha teclado e mouse). Sem `matchMedia` (jsdom),
 * é mouse.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(COARSE).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(COARSE)
    const onChange = (e: { matches: boolean }) => setCoarse(e.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])
  return coarse
}
