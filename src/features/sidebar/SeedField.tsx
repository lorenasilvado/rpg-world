import { Check, Copy, Dices } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { randomSeed } from '../../state/seed'

/** Espera depois da última tecla na seed antes de regerar o mapa (Enter ou sair do campo regeram já). */
export const SEED_TYPING_MS = 400
/** Quanto tempo o botão copiar mostra o check depois de copiar. */
export const COPIED_MS = 1500

/**
 * Seção Seed da sidebar (AC-F1-15): o campo da seed, em JetBrains Mono, com os botões sortear
 * (`dices`) e copiar (`copy`). Não há botão "Gerar": editar a seed regenera o mapa (`onSeed`) depois
 * de uma pausa na digitação, ou já no Enter ou ao sair do campo. A seed vale sem os espaços das
 * pontas; uma seed vazia não gera nada, e ao sair do campo ele volta para a seed atual. Se a seed
 * muda por fora (sorteio, assistente) durante a pausa, o texto digitado é descartado.
 */
export function SeedField({ seed, onSeed }: { seed: string; onSeed: (seed: string) => void }) {
  const [draft, setDraft] = useState(seed)
  const [shownSeed, setShownSeed] = useState(seed)
  /** Quantas vezes a seed foi copiada (0: nenhuma, ou o check já sumiu); cada cópia reinicia o check. */
  const [copied, setCopied] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  /** A seed atual, para o timer da digitação comparar com ela e não com a da renderização dele. */
  const seedRef = useRef(seed)

  // A seed mudou: o campo passa a mostrá-la. Se ela veio do próprio texto (só sem os espaços das
  // pontas), o texto fica, para um espaço digitado antes da pausa não sumir no meio da palavra.
  if (seed !== shownSeed) {
    setShownSeed(seed)
    if (draft.trim() !== seed) setDraft(seed)
  }

  useEffect(() => () => clearTimeout(typingTimer.current), [])
  // A seed mudou (por fora, ou pelo próprio campo): um texto ainda esperando a pausa não vale mais.
  useEffect(() => {
    seedRef.current = seed
    clearTimeout(typingTimer.current)
  }, [seed])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(0), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  /**
   * Regera com o texto do campo (sem os espaços das pontas), se não está vazio e muda a seed. No
   * Enter e ao sair do campo (`tidy`), o campo também perde os espaços das pontas.
   */
  const commit = (value: string, tidy = false) => {
    clearTimeout(typingTimer.current)
    const next = value.trim()
    if (next === '') return
    if (next !== seedRef.current) onSeed(next)
    if (tidy) setDraft(next)
  }

  const roll = () => {
    clearTimeout(typingTimer.current)
    onSeed(randomSeed())
  }

  const copy = () => {
    const done = () => setCopied((n) => n + 1)
    // Sem acesso à área de transferência, a seed fica selecionada no campo para o Ctrl+C.
    const fallback = () => input.current?.select()
    if (navigator.clipboard) navigator.clipboard.writeText(seed).then(done, fallback)
    else fallback()
  }

  return (
    <div className="flex gap-1.5">
      <input
        ref={input}
        value={draft}
        aria-label="Seed"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          const value = e.target.value
          setDraft(value)
          clearTimeout(typingTimer.current)
          typingTimer.current = setTimeout(() => commit(value), SEED_TYPING_MS)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft, true)
        }}
        onBlur={() => {
          if (draft.trim() === '') {
            clearTimeout(typingTimer.current)
            setDraft(seed)
          } else commit(draft, true)
        }}
        className="h-10 min-w-0 flex-1 rounded-control border border-line-2 bg-field px-2.5 font-mono text-[13px] font-medium text-ink outline-none focus:border-amber focus:shadow-[0_0_0_3px_var(--amber-soft)]"
      />
      {/* Sem tirar o foco do campo: o sorteio não gera antes o mapa do texto digitado (no blur). */}
      <SeedButton label="Seed aleatória" onClick={roll} keepFocus>
        <Dices size={18} aria-hidden="true" />
      </SeedButton>
      <SeedButton label="Copiar seed" onClick={copy}>
        {copied ? <Check size={18} aria-hidden="true" className="text-ok" /> : <Copy size={18} aria-hidden="true" />}
      </SeedButton>
      <span role="status" className="sr-only">
        {copied ? 'Seed copiada' : ''}
      </span>
    </div>
  )
}

function SeedButton({
  label,
  onClick,
  keepFocus,
  children,
}: {
  label: string
  onClick: () => void
  keepFocus?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
      className="grid size-10 flex-none place-items-center rounded-control border border-line-2 bg-field text-ink hover:bg-sunken active:bg-press"
    >
      {children}
    </button>
  )
}
