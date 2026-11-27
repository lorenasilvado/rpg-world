import { useCallback, useEffect, useRef, useState } from 'react'
import type { Road } from '../../persistence/types'
import type { PinsStore } from '../../state/pinsStore'
import type { RoadsStore } from '../../state/roadsStore'
import { seaRouteName } from './autoRoute'
import type { WorldRouter } from './worldRouter'

/**
 * O toast Sem caminho (estradas.md, AC-F5-13): os dois pins da Rota automática sem caminho por
 * terra (ids e nomes) e o passo da rota marítima: oferecida, calculando ou sem caminho nem pela
 * água (ex.: dois lagos). Os nomes são os da hora do toast: mudar um nome é um passo no histórico,
 * que fecha o toast.
 */
export type NoPath = { from: string; to: string; fromName: string; toName: string; sea: 'offer' | 'calculating' | 'none' }

/**
 * O estado do toast Sem caminho e a ação "Criar rota marítima" (AC-F5-13). `open` recebe os pins da
 * Rota automática sem caminho por terra; `createSea` pede ao worker a mesma busca só pela água
 * (`mode: 'sea'`), que vira a estrada "Rota marítima de A a B", tipo Rota marítima, ligada aos dois,
 * sem ficar selecionada (um passo no Desfazer), e `onCreated` mostra o toast "Rota criada". Sem
 * caminho nem pela água, o toast passa a dizer "Não há caminho entre A e B.", sem a ação. Se um dos
 * pins sai no meio do cálculo, nada é criado e o toast fecha; com o worker em falha, a ação volta.
 * `close` fecha o toast e cancela o cálculo (o resultado é descartado).
 */
export function useNoPath({
  pins,
  roads,
  router,
  onCreated,
}: {
  pins: PinsStore
  roads: RoadsStore | undefined
  router: WorldRouter
  onCreated?: (road: Road) => void
}) {
  const [noPath, setNoPath] = useState<NoPath | null>(null)
  const job = useRef<AbortController | null>(null)
  const onCreatedRef = useRef(onCreated)
  useEffect(() => {
    onCreatedRef.current = onCreated
  }, [onCreated])
  useEffect(() => () => job.current?.abort(), [])

  const cancel = () => {
    job.current?.abort()
    job.current = null
  }
  const close = useCallback(() => {
    cancel()
    setNoPath(null)
  }, [])
  const open = useCallback(
    (from: string, to: string) => {
      cancel()
      const list = pins.getState().pins
      const a = list.find((p) => p.id === from)
      const b = list.find((p) => p.id === to)
      setNoPath(a && b ? { from, to, fromName: a.name, toName: b.name, sea: 'offer' } : null)
    },
    [pins],
  )
  const createSea = useCallback(() => {
    if (!noPath || noPath.sea !== 'offer' || !roads) return
    const { from, to } = noPath
    const list = pins.getState().pins
    const a = list.find((p) => p.id === from)
    const b = list.find((p) => p.id === to)
    if (!a || !b) return close()
    const current = new AbortController()
    job.current = current
    setNoPath({ ...noPath, sea: 'calculating' })
    router.route({ from: a.pos, to: b.pos, mode: 'sea' }, { signal: current.signal }).then(
      (res) => {
        if (job.current !== current) return
        job.current = null
        // Um dos pins pode ter saído no meio do cálculo: nada é criado.
        const now = pins.getState().pins
        const A = now.find((p) => p.id === from)
        const B = now.find((p) => p.id === to)
        if (!A || !B) return setNoPath(null)
        if (!res.route) return setNoPath({ ...noPath, sea: 'none' })
        setNoPath(null)
        const road = roads
          .getState()
          .addRoad({ points: res.route.points, from, to, name: seaRouteName(A.name, B.name), kind: 'sea' }, { select: false })
        if (road) onCreatedRef.current?.(road)
      },
      (error: unknown) => {
        if (job.current !== current) return
        job.current = null
        setNoPath({ ...noPath, sea: 'offer' })
        if (!(error instanceof DOMException && error.name === 'AbortError')) console.error('A rota marítima falhou.', error)
      },
    )
  }, [noPath, pins, roads, router, close])

  return { noPath, open, close, createSea }
}
