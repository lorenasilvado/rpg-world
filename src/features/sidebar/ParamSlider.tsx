import * as Slider from '@radix-ui/react-slider'
import { useEffect, useId, useRef, useState } from 'react'
import type { SliderDef } from './sliders'

/**
 * Um slider de geração (design-system.md → Componentes → Slider), sobre o Slider do Radix: trilho
 * de 6 px, preenchimento âmbar e thumb de 18 px; no hover, halo âmbar; durante o arrasto, thumb
 * âmbar maior e balão com o valor. Acima dele, o ícone, o rótulo, a amostra de cor (nos de bioma)
 * e a porcentagem.
 *
 * Funciona só com o teclado (o Radix: setas mudam 1, Shift + setas e PageUp/PageDown mudam 10,
 * Home e End vão a 0 e 100) e tem rótulo (AC-F1-13). `onChange` recebe cada valor durante o
 * arrasto com o ponteiro; `onCommit`, o valor ao soltar. Pelo teclado não há arrasto: cada tecla
 * chama só o `onCommit` (o Radix avisa o commit antes da mudança, e uma prévia pedida depois
 * tomaria o lugar do mapa final).
 *
 * `flash` muda a cada vez que este slider recua sozinho (Desertos ↔ Florestas, AC-F1-14): a linha
 * pisca em âmbar por 700 ms.
 */
export function ParamSlider({
  def,
  value,
  flash,
  onChange,
  onCommit,
}: {
  def: SliderDef
  value: number
  flash: number | null
  onChange: (value: number) => void
  onCommit: (value: number) => void
}) {
  const labelId = useId()
  const [dragging, setDragging] = useState(false)
  // O estado só muda no próximo render; o ref vale já no mesmo evento do ponteiro.
  const pointerDown = useRef(false)
  const Icon = def.icon

  // O Radix só chama `onValueCommit` se o valor mudou: soltar sem mudar também encerra o arrasto.
  useEffect(() => {
    if (!dragging) return
    const end = () => {
      pointerDown.current = false
      setDragging(false)
    }
    document.addEventListener('pointerup', end)
    document.addEventListener('pointercancel', end)
    return () => {
      document.removeEventListener('pointerup', end)
      document.removeEventListener('pointercancel', end)
    }
  }, [dragging])

  return (
    <div
      className="relative -mx-2 flex flex-col gap-1.5 rounded-control px-2 py-1"
      data-testid={`slider-${def.key}`}
      data-flash={flash !== null}
    >
      {flash !== null && (
        <span key={flash} aria-hidden="true" className="flash-row pointer-events-none absolute inset-0 rounded-control" />
      )}
      <div className="relative flex items-center gap-2">
        <Icon size={18} aria-hidden="true" className="shrink-0 text-ink-2" />
        <span id={labelId} className="flex-1 font-bold">
          {def.label}
        </span>
        {def.swatch && (
          <span
            aria-hidden="true"
            data-testid="swatch"
            className="size-3.5 shrink-0 rounded-[4px] shadow-[inset_0_0_0_1px_rgba(43,36,32,0.25)]"
            style={{ background: def.swatch }}
          />
        )}
        <span className="w-[38px] text-right text-[13px] font-bold tabular-nums">{value}%</span>
      </div>
      <Slider.Root
        className="relative flex h-6 cursor-pointer touch-none items-center select-none"
        min={0}
        max={100}
        step={1}
        value={[value]}
        onPointerDown={() => {
          pointerDown.current = true
          setDragging(true)
        }}
        onValueChange={([v]) => {
          if (pointerDown.current) onChange(v)
        }}
        onValueCommit={([v]) => {
          pointerDown.current = false
          setDragging(false)
          onCommit(v)
        }}
      >
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-sunken shadow-[inset_0_0_0_1px_var(--line)]">
          <Slider.Range className="absolute h-full rounded-full bg-amber" />
        </Slider.Track>
        <Slider.Thumb
          aria-labelledby={labelId}
          aria-valuetext={`${value}%`}
          data-dragging={dragging}
          className="group relative block size-[18px] rounded-full outline-none"
        >
          <span
            aria-hidden="true"
            className={[
              'block size-full rounded-full border-2 border-amber shadow-sm',
              'transition-[transform,background-color,box-shadow] duration-100',
              'group-hover:shadow-[0_0_0_6px_var(--amber-soft)]',
              dragging ? 'scale-[1.22] bg-amber' : 'bg-paper-solid',
            ].join(' ')}
          />
          {dragging && (
            <span
              aria-hidden="true"
              className="absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 rounded-[6px] bg-[#2B2420] px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#F7F1E3] tabular-nums"
            >
              {value}%
            </span>
          )}
        </Slider.Thumb>
      </Slider.Root>
    </div>
  )
}
