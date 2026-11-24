import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { addTag, removeTag, TAG_MAX } from './tags'

/**
 * As tags do pin (pins.md → E2, AC-F3-08): os chips, cada um com o botão de remover; o campo
 * "+ tag" (Enter ou vírgula adiciona; uma tag repetida não entra); e as sugestões "Usadas no
 * mundo", as tags dos outros pins (clicar adiciona). Cada mudança é um passo do histórico.
 */
export function PinTags({
  tags,
  suggestions,
  onChange,
}: {
  tags: readonly string[]
  suggestions: readonly string[]
  onChange: (tags: readonly string[]) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState('')

  const commit = () => {
    const next = addTag(tags, draft)
    if (next !== tags) onChange(next)
    setDraft('')
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-2.5" data-testid="pin-tags">
      <h3 id={`${id}-titulo`} className="text-[12px]/4 font-extrabold tracking-[.08em] text-ink-2 uppercase">
        Tags
      </h3>
      <ul className="flex flex-wrap items-center gap-1.5" aria-label="Tags do pin">
        {tags.map((tag) => (
          <li
            key={tag}
            data-testid="pin-tag"
            className="flex h-7 items-center gap-1 rounded-pill border border-amber bg-amber-soft pr-1 pl-3 text-[13px] font-bold text-amber-ink"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remover a tag ${tag}`}
              title="Remover"
              onClick={() => onChange(removeTag(tags, tag))}
              className="grid size-5 place-items-center rounded-pill hover:bg-press focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </li>
        ))}
        <li>
          <label htmlFor={`${id}-nova`} className="sr-only">
            Nova tag
          </label>
          <input
            id={`${id}-nova`}
            value={draft}
            placeholder="+ tag"
            maxLength={TAG_MAX}
            onChange={(e) => {
              const text = e.target.value
              // A vírgula fecha a tag, como o Enter.
              if (text.includes(',')) {
                const next = text
                  .split(',')
                  .slice(0, -1)
                  .reduce<readonly string[]>((acc, t) => addTag(acc, t), tags)
                if (next !== tags) onChange(next)
                setDraft(text.slice(text.lastIndexOf(',') + 1))
              } else {
                setDraft(text)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
            }}
            onBlur={commit}
            className="h-7 w-24 rounded-pill border border-dashed border-line-2 bg-transparent px-3 text-[13px] text-ink placeholder:text-ink-3 max-md:text-[16px] focus:w-36 focus:border-solid focus:border-amber focus:bg-field focus:outline-none"
          />
        </li>
      </ul>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="pin-tag-suggestions">
          <span id={`${id}-usadas`} className="text-[12px] text-ink-3">
            Usadas no mundo:
          </span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-label={`Adicionar a tag ${tag}`}
              aria-describedby={`${id}-usadas`}
              onClick={() => onChange(addTag(tags, tag))}
              className="h-[26px] rounded-pill border border-line bg-sunken px-2.5 text-[12px] font-semibold text-ink-2 hover:border-line-2 hover:text-ink active:bg-press focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
