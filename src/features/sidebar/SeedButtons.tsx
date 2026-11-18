import { Check, Copy } from 'lucide-react'
import type { ReactNode } from 'react'

/** O botão copiar, com o check depois de copiar e o aviso "Seed copiada" para o leitor de tela. */
export function CopySeedButton({ copied, onClick }: { copied: number; onClick: () => void }) {
  return (
    <>
      <SeedButton label="Copiar seed" onClick={onClick}>
        {copied ? <Check size={18} aria-hidden="true" className="text-ok" /> : <Copy size={18} aria-hidden="true" />}
      </SeedButton>
      <span role="status" className="sr-only">
        {copied ? 'Seed copiada' : ''}
      </span>
    </>
  )
}

export function SeedButton({
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
