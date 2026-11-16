import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { useStore } from 'zustand'
import type { WorldParams } from '../../core'
import type { LandShareKey } from '../../state/params'
import type { WorldStore } from '../../state/worldStore'
import { ParamSlider } from './ParamSlider'
import { SECTIONS, SECTIONS_OPEN_AT_START, type SectionDef, type SectionId } from './sliders'

/** Duração do flash âmbar do slider que recuou (design-system.md → Movimento). */
export const FLASH_MS = 700

/**
 * Conteúdo da sidebar "Gerar mundo", abaixo do cabeçalho: as seções recolhíveis Terreno, Biomas,
 * Relevo e Avançado, com os 9 sliders (AC-F1-21). Arrastar um slider pede a prévia
 * (`dragParams`); soltar, o mapa final (`releaseParams`). Se Desertos + Florestas passaria de
 * 100%, o outro slider recua (no `worldStore`) e pisca (AC-F1-14).
 *
 * Recolhida (`collapsed`, só a partir de 768 px), a sidebar vira um trilho de 48 px com o botão de
 * abrir e um ícone por seção: o ícone abre o painel com aquela seção aberta.
 */
export function GenerateSidebar({
  world,
  collapsed,
  canCollapse,
  onCollapsedChange,
}: {
  world: WorldStore
  collapsed: boolean
  /** O botão de recolher só existe a partir de 768 px (abaixo, o painel fecha pelo X). */
  canCollapse: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const params = useStore(world, (s) => s.params)
  const [open, setOpen] = useState(SECTIONS_OPEN_AT_START)
  const [flash, setFlash] = useState<{ key: LandShareKey; id: number } | null>(null)
  const focusAfter = useRef<SectionId | 'collapse' | 'expand' | null>(null)
  const collapseButton = useRef<HTMLButtonElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const sectionButtons = useRef(new Map<SectionId, HTMLButtonElement>())

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(timer)
  }, [flash])

  // Depois de recolher ou abrir pelo botão, o foco vai para o botão que faz o contrário (ou para a
  // seção escolhida no trilho), em vez de se perder no `body`. Recolhida pela tecla `[` com o foco
  // num slider (que some), o foco vai para o botão de abrir.
  useEffect(() => {
    const target = focusAfter.current
    focusAfter.current = null
    if (target === 'collapse') collapseButton.current?.focus()
    else if (target === 'expand') expandButton.current?.focus()
    else if (target) sectionButtons.current.get(target)?.focus()
    else if (collapsed && document.activeElement === document.body) expandButton.current?.focus()
  }, [collapsed])

  const showFlash = (key: LandShareKey | null) => {
    if (key) setFlash((prev) => ({ key, id: (prev?.id ?? 0) + 1 }))
  }
  const change = (key: keyof WorldParams, value: number) => {
    if (params[key] !== value) showFlash(world.getState().dragParams({ [key]: value }))
  }
  const commit = (key: keyof WorldParams, value: number) => showFlash(world.getState().releaseParams({ [key]: value }))

  if (collapsed) {
    return (
      <nav aria-label="Seções" className="flex flex-col items-center gap-1 py-1.5" data-testid="sidebar-rail">
        <RailButton
          ref={expandButton}
          label="Expandir painel"
          shortcut="["
          onClick={() => {
            focusAfter.current = 'collapse'
            onCollapsedChange(false)
          }}
        >
          <PanelLeftOpen size={20} aria-hidden="true" />
        </RailButton>
        <div className="my-1 h-px w-6 bg-line" />
        {SECTIONS.map((section) => (
          <RailButton
            key={section.id}
            label={section.label}
            onClick={() => {
              setOpen((o) => ({ ...o, [section.id]: true }))
              focusAfter.current = section.id
              onCollapsedChange(false)
            }}
          >
            <section.icon size={20} aria-hidden="true" />
          </RailButton>
        ))}
      </nav>
    )
  }

  return (
    <>
      <div className="flex h-11 shrink-0 items-center border-b border-line pr-2 pl-4">
        <h2 className="flex-1 text-xs font-extrabold tracking-[0.08em] text-ink-2 uppercase">Gerar mundo</h2>
        {canCollapse && (
          <button
            ref={collapseButton}
            type="button"
            aria-label="Recolher painel"
            title="Recolher painel ( [ )"
            onClick={() => {
              focusAfter.current = 'expand'
              onCollapsedChange(true)
            }}
            className="grid size-9 place-items-center rounded-control text-ink hover:bg-hover active:bg-press"
          >
            <PanelLeftClose size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto" data-testid="sidebar-sections">
        {SECTIONS.map((section) => (
          <Section
            key={section.id}
            section={section}
            open={open[section.id]}
            buttonRef={(el) => {
              if (el) sectionButtons.current.set(section.id, el)
              else sectionButtons.current.delete(section.id)
            }}
            onToggle={() => setOpen((o) => ({ ...o, [section.id]: !o[section.id] }))}
          >
            {section.sliders.map((def) => (
              <ParamSlider
                key={def.key}
                def={def}
                value={params[def.key]}
                flash={flash?.key === def.key ? flash.id : null}
                onChange={(v) => change(def.key, v)}
                onCommit={(v) => commit(def.key, v)}
              />
            ))}
          </Section>
        ))}
      </div>
    </>
  )
}

/** Seção recolhível: cabeçalho em caixa alta (overline) com chevron, e o conteúdo logo abaixo. */
function Section({
  section,
  open,
  buttonRef,
  onToggle,
  children,
}: {
  section: SectionDef
  open: boolean
  buttonRef: (el: HTMLButtonElement | null) => void
  onToggle: () => void
  children: ReactNode
}) {
  const contentId = useId()
  const Icon = section.icon
  return (
    <section className="border-b border-line" data-testid={`section-${section.id}`}>
      <h3>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
          className="flex h-11 w-full items-center gap-2.5 px-4 text-xs font-extrabold tracking-[0.08em] text-ink uppercase hover:bg-hover"
        >
          <Icon size={18} aria-hidden="true" className="text-ink-2" />
          <span className="flex-1 text-left">{section.label}</span>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`text-ink-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      <div
        id={contentId}
        role="group"
        aria-label={section.label}
        hidden={!open}
        data-testid={`section-content-${section.id}`} className="flex flex-col gap-3.5 px-4 pt-0.5 pb-4">
        {children}
      </div>
    </section>
  )
}

function RailButton({
  ref,
  label,
  shortcut,
  onClick,
  children,
}: {
  ref?: Ref<HTMLButtonElement>
  label: string
  shortcut?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={shortcut ? `${label} ( ${shortcut} )` : label}
      onClick={onClick}
      className="grid h-10 w-9 place-items-center rounded-control text-ink-2 hover:bg-hover hover:text-ink active:bg-press"
    >
      {children}
    </button>
  )
}
