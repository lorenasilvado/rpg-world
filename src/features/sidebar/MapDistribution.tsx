import { LoaderCircle } from 'lucide-react'
import { useMemo } from 'react'
import { useStore } from 'zustand'
import { isGenerating, type WorldStore } from '../../state/worldStore'
import { distribution, LEGEND_MIN_SHARE } from './distribution'

/**
 * Barra "Distribuição do mapa", no rodapé da sidebar (AC-F1-18): um segmento por bioma presente
 * no mapa exibido, com a largura da fração real dele, e a legenda dos biomas com 1,5% ou mais.
 * Durante a geração (`isGenerating`), o cabeçalho mostra "Gerando" e a barra acompanha a prévia
 * (os valores novos). O leitor de tela ouve a lista inteira pelo rótulo da barra.
 */
export function MapDistribution({ world }: { world: WorldStore }) {
  const field = useStore(world, (s) => s.field)
  const busy = useStore(world, isGenerating)
  const shares = useMemo(() => (field ? distribution(field.biome) : []), [field])
  const summary = shares.map((s) => `${s.label} ${s.text}`).join(', ')

  return (
    <div className="flex flex-col gap-2.5" data-testid="map-distribution" data-busy={busy}>
      <div className="flex h-4 items-center justify-between">
        <h3 className="text-[11px]/4 font-extrabold tracking-[0.08em] text-ink-2 uppercase">Distribuição do mapa</h3>
        {busy && (
          <span role="status" className="flex items-center gap-1.5 text-xs font-bold text-ink-2">
            <LoaderCircle size={14} aria-hidden="true" className="animate-spin [animation-duration:900ms] motion-reduce:animate-none" />
            Gerando
          </span>
        )}
      </div>
      <div
        role="img"
        aria-label={summary ? `Distribuição do mapa: ${summary}` : 'Distribuição do mapa: sem mapa'}
        className="flex h-3 overflow-hidden rounded-[6px] shadow-[inset_0_0_0_1px_var(--line)]"
      >
        {shares.map((s) => (
          <div
            key={s.biome}
            title={`${s.label} ${s.text}`}
            data-biome={s.biome}
            style={{ width: `${(s.share * 100).toFixed(2)}%`, background: s.color }}
            // Um fio entre os segmentos separa os tons claros (Neve, Praia) dos vizinhos.
            className="transition-[width] duration-200 not-first:shadow-[inset_1px_0_0_var(--line-2)]"
          />
        ))}
      </div>
      <ul aria-hidden="true" className="flex flex-wrap gap-x-2.5 gap-y-0.5" data-testid="distribution-legend">
        {shares
          .filter((s) => s.share >= LEGEND_MIN_SHARE)
          .map((s) => (
            <li key={s.biome} className="flex items-center gap-1 text-[11px]/4 font-semibold text-ink-2">
              {/* O contorno deixa a amostra dos tons claros (Neve) visível sobre o papel. */}
              <span className="size-2 rounded-[2px] shadow-[inset_0_0_0_1px_var(--line-2)]" style={{ background: s.color }} />
              {s.label} {s.text}
            </li>
          ))}
      </ul>
    </div>
  )
}
