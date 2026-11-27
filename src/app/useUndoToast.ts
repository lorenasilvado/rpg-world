import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorldHistory } from '../state/history'

/**
 * O toast de uma ação no histórico ("Pin excluído", "Estrada excluída", "Rota criada" e o resultado
 * de "Conectar cidades"): a mensagem, se tem "Desfazer", e quando abriu.
 *
 * - `open` muda a cada `show`, mesmo sem passo novo no histórico ("Conectar cidades" sem estrada
 *   nova): o toast recomeça o tempo dele. `null`: fechado.
 * - Outra mudança no histórico (um passo novo, desfeito ou refeito) depois do `show` fecha o toast.
 */
export function useUndoToast(history: WorldHistory) {
  const [state, setState] = useState<{ open: number; at: number; message: string; undo: boolean } | null>(null)
  const seq = useRef(0)
  const show = useCallback(
    (message: string, { undo = true }: { undo?: boolean } = {}) => {
      seq.current += 1
      setState({ open: seq.current, at: history.version.getState().value, message, undo })
    },
    [history],
  )
  const close = useCallback(() => setState(null), [])
  useEffect(
    () => history.version.subscribe(({ value }) => setState((s) => (s !== null && s.at !== value ? null : s))),
    [history],
  )
  return { open: state?.open ?? null, message: state?.message ?? '', undo: state?.undo ?? true, show, close }
}
