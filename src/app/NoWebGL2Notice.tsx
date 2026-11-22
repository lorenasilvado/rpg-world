import { ArrowLeft, Compass, Moon, Sun, TriangleAlert } from 'lucide-react'
import { useTheme } from './useTheme'
import { SUPPORTED_BROWSERS } from './webgl2'

/**
 * Aviso no lugar do editor quando o navegador não tem WebGL2 (AC-F1-20): o mapa não teria como ser
 * desenhado, então o editor nem abre. Diz por quê e lista os navegadores suportados. Tem o mesmo
 * botão de tema claro e escuro do editor e, com `onBack`, o de voltar à Lista de mundos, que
 * funciona sem WebGL2 (AC-F4-12).
 */
export function NoWebGL2Notice({ onBack }: { onBack?: () => void }) {
  const { theme, toggle } = useTheme()
  const themeLabel = theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'
  return (
    <main
      aria-labelledby="no-webgl2-title"
      data-testid="no-webgl2"
      className="grid h-full place-items-center overflow-y-auto bg-map-canvas p-4"
    >
      <section className="flex w-full max-w-[480px] flex-col gap-4 rounded-panel bg-paper-solid p-6 text-ink shadow-lg">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-control bg-amber text-on-amber">
            <Compass size={20} aria-hidden="true" />
          </span>
          <span className="flex-1 font-title text-base/5 font-semibold">RPG World Builder</span>
          <button
            type="button"
            aria-label={themeLabel}
            title={themeLabel}
            onClick={toggle}
            className="-my-2 -mr-2 grid size-11 place-items-center rounded-control text-ink hover:bg-hover active:bg-press"
          >
            {theme === 'light' ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
          </button>
        </div>
        <h1 id="no-webgl2-title" className="flex items-center gap-2 text-lg/6 font-extrabold">
          <TriangleAlert size={20} aria-hidden="true" className="shrink-0 text-amber-ink" />
          Este navegador não tem WebGL2
        </h1>
        <p className="text-sm/5 text-ink-2">
          O editor desenha o mapa com WebGL2, que este navegador não oferece ou está desligado. Abra o RPG World
          Builder na versão atual de um destes navegadores:
        </p>
        <ul className="flex flex-col gap-1 text-sm/5 font-bold" aria-label="Navegadores suportados">
          {SUPPORTED_BROWSERS.map((name) => (
            <li key={name} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-amber" />
              {name}
            </li>
          ))}
        </ul>
        <p className="text-sm/5 text-ink-2">
          Se você já usa um deles, atualize-o e confira se a aceleração por hardware está ligada nas configurações.
        </p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 items-center gap-2 self-start rounded-control border border-line-2 bg-field px-4 text-sm font-bold text-ink hover:border-ink-3 hover:bg-sunken active:bg-press"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar à lista
          </button>
        )}
      </section>
    </main>
  )
}
