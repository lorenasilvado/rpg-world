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
 * de uma pausa na digitação, ou já no Enter ou ao sair do campo. Uma seed vazia não gera nada: ao
 * sair do campo, ele volta para a seed atual.
 */
export function SeedField({ seed, onSeed }: { seed: string; onSeed: (seed: string) => void }) {
  const [draft, setDraft] = useState(seed)
  const [shownSeed, setShownSeed] = useState(seed)
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // A seed mudou por fora (sorteio, assistente): o campo passa a mostrá-la.
  if (seed !== shownSeed) {
    setShownSeed(seed)
    setDraft(seed)
  }

  useEffect(() => () => clearTimeout(typingTimer.current), [])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  /** Regera com o texto do campo, se ele não está vazio e é diferente da seed atual. */
  const commit = (value: string) => {
    clearTimeout(typingTimer.current)
    if (value.trim() !== '' && value !== seed) onSeed(value)
  }

  const roll = () => {
    clearTimeout(typingTimer.current)
    onSeed(randomSeed())
  }

  const copy = () => {
    const done = () => setCopied(true)
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
          if (e.key === 'Enter') commit(draft)
        }}
        onBlur={() => {
          if (draft.trim() === '') {
            clearTimeout(typingTimer.current)
            setDraft(seed)
          } else commit(draft)
        }}
        className="h-10 min-w-0 flex-1 rounded-control border border-line-2 bg-field px-2.5 font-mono text-[13px] font-medium text-ink outline-none focus:border-amber focus:shadow-[0_0_0_3px_var(--amber-soft)]"
      />
      <SeedButton label="Seed aleatória" onClick={roll}>
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

function SeedButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-10 flex-none place-items-center rounded-control border border-line-2 bg-field text-ink hover:bg-sunken active:bg-press"
    >
      {children}
    </button>
  )
}
