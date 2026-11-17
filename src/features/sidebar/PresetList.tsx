import { Check } from 'lucide-react'
import { PRESETS, type Preset, type PresetId } from '../../state/presets'

/**
 * Seção Presets da sidebar (AC-F1-16): os 4 presets em cartões de duas colunas, com o nome e a
 * descrição. Escolher um aplica os 9 valores dele (`onPick`). O cartão do preset cujos valores são
 * os dos sliders agora (`selected`) tem a borda âmbar e o check; mexer num slider tira a marca.
 */
export function PresetList({ selected, onPick }: { selected: PresetId | null; onPick: (preset: Preset) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PRESETS.map((preset) => {
        const on = preset.id === selected
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(preset)}
            className={`relative flex flex-col gap-1 rounded-[10px] border-2 bg-field px-2.5 py-2 text-left text-ink hover:border-amber ${
              on ? 'border-amber' : 'border-line'
            }`}
          >
            <span className="pr-4 text-xs leading-[15px] font-bold">{preset.name}</span>
            <span className="text-[11px] leading-[14px] text-ink-3">{preset.description}</span>
            {on && (
              <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-amber text-on-amber">
                <Check size={11} strokeWidth={3} aria-hidden="true" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
