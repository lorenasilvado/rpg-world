import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/**
 * Tema da interface: aplica `data-theme` no elemento raiz (tokens em styles/tokens.css). Começa no
 * tema que já está aplicado, para a troca entre a Lista de mundos e o editor não voltar ao claro.
 */
export function useTheme(initial: Theme = 'light') {
  const [theme, setTheme] = useState<Theme>(() => {
    const applied = document.documentElement.dataset.theme
    return applied === 'light' || applied === 'dark' ? applied : initial
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, toggle }
}
