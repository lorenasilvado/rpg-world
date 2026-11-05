import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/** Tema da interface: aplica `data-theme` no elemento raiz (tokens em styles/tokens.css). */
export function useTheme(initial: Theme = 'light') {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, toggle }
}
