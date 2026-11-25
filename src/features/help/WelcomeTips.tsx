import { X } from 'lucide-react'
import { useId } from 'react'
import { WELCOME_TIPS } from './welcome'

/**
 * Cartão das dicas de boas-vindas (geracao-terreno.md → Regras, AC-F1-31): um passo por vez (os
 * sliders, a toolbar e o adicionar pin), com "1 de 3", Pular e Próxima (no último, Começar). Não é
 * modal: o mapa e os painéis continuam usáveis, e o foco não é tirado de onde está. O `EditorLayout`
 * destaca no editor o que o passo apresenta e grava a marca de vistas ao Pular ou Começar.
 *
 * Fica no alto da área livre do mapa, abaixo da barra de ações: a partir de 768 px, centrado entre a
 * sidebar e a borda direita; abaixo, na largura da tela, com 12 px de cada lado (até 360 px; na tela
 * baixa, até 480). Segue o design
 * system: `--paper-solid`, `--shadow-lg`, botão primário âmbar.
 */
export function WelcomeTips({
  step,
  mobile,
  onNext,
  onSkip,
}: {
  /** O passo à vista (0 a `WELCOME_TIPS.length - 1`). */
  step: number
  /** Abaixo de 768 px: os textos de toque (os sliders atrás do botão Abrir painel, tocar no mapa). */
  mobile: boolean
  onNext: () => void
  onSkip: () => void
}) {
  const titleId = useId()
  const textId = useId()
  const tip = WELCOME_TIPS[step]
  const last = step === WELCOME_TIPS.length - 1
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={textId}
      data-testid="welcome-tips"
      data-step={step}
      className="toast-in flex w-full flex-col gap-2 rounded-panel border border-line bg-paper-solid p-4 pt-3 text-ink shadow-lg"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px]/4 font-extrabold tracking-[.08em] text-amber-ink uppercase">
          Boas-vindas · {step + 1} de {WELCOME_TIPS.length}
        </span>
        <button
          type="button"
          aria-label="Fechar dicas"
          title="Fechar dicas"
          onClick={onSkip}
          className="-mr-2 ml-auto grid size-9 place-items-center rounded-control text-ink-2 hover:bg-hover active:bg-press pointer-coarse:size-11"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <h2 id={titleId} className="font-title text-lg/6 font-semibold">
        {tip.title}
      </h2>
      <p id={textId} className="text-sm/5 text-ink-2">
        {mobile && tip.mobileText ? tip.mobileText : tip.text}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span aria-hidden="true" className="flex gap-1.5">
          {WELCOME_TIPS.map((t, i) => (
            <span key={t.target} className={`size-2 rounded-full ${i === step ? 'bg-amber' : 'bg-line-2'}`} />
          ))}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="ml-auto h-11 rounded-control px-3 text-sm font-bold text-ink-2 hover:bg-hover active:bg-press"
        >
          Pular
        </button>
        <button
          type="button"
          onClick={onNext}
          className="h-11 rounded-control bg-amber px-4 text-sm font-bold text-on-amber hover:bg-[var(--amber-hover)] hover:shadow-md active:translate-y-px active:bg-[var(--amber-press)]"
        >
          {last ? 'Começar' : 'Próxima'}
        </button>
      </div>
    </section>
  )
}
