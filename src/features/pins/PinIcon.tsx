import { useId } from 'react'
import { CUSTOM_CIRCLE, PIN_GLYPH, PIN_INK, PIN_SHAPES } from '../../render/style/pinShapes'
import type { PinType } from '../../state/pinTypes'

/**
 * O pin do `type` como `<svg>` (design-system.md → Pins), com `size` px de largura e 1,2× de altura:
 * o mesmo desenho do mapa (`drawPin`), para o drawer e as listas. O Personalizado com `image` (o
 * endereço da imagem enviada) a mostra no círculo, cobrindo-o; sem ela, o círculo hachurado.
 */
export function PinIcon({ type, size = 32, image, className }: { type: PinType; size?: number; image?: string; className?: string }) {
  // O id do React tem caracteres (`:`, `«`) que quebram o `url(#…)`.
  const id = `pin${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const s = PIN_SHAPES[type]
  const { cx, cy, r } = CUSTOM_CIRCLE
  return (
    <svg
      aria-hidden="true"
      data-pin-type={type}
      width={size}
      height={size * 1.2}
      viewBox="0 0 40 48"
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <clipPath id={`${id}b`}>
          <path d={s.body} />
        </clipPath>
        {type === 'custom' && (
          <clipPath id={`${id}c`}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        )}
        {type === 'custom' && (
          <pattern id={`${id}s`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill="#EFE6D2" />
            <rect width="1.6" height="4" fill="#D8C9A8" />
          </pattern>
        )}
      </defs>
      <ellipse cx="20" cy="45.5" rx="8" ry="2.2" fill={PIN_INK} opacity={0.26} />
      <path d={s.body} fill={s.shade} />
      {/* A base deslocada fica dentro do corpo (o recorte no grupo não anda com o deslocamento). */}
      <g clipPath={`url(#${id}b)`}>
        <path d={s.body} fill={s.base} transform="translate(-2.5 -2.5)" />
      </g>
      <path d={s.body} fill="none" stroke={PIN_INK} strokeWidth={1.5} strokeLinejoin="round" />
      {s.glyph.map((part, i) => (
        <path key={i} d={part.d} fill={part.dark ? PIN_INK : PIN_GLYPH} />
      ))}
      {type === 'custom' && (
        <>
          {image ? (
            <>
              <circle cx={cx} cy={cy} r={r} fill="#EFE6D2" />
              <image
                href={image}
                x={cx - r}
                y={cy - r}
                width={2 * r}
                height={2 * r}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${id}c)`}
                data-testid="pin-icon-image"
              />
            </>
          ) : (
            <circle cx={cx} cy={cy} r={r} fill={`url(#${id}s)`} />
          )}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={PIN_INK} strokeWidth={1.2} />
        </>
      )}
    </svg>
  )
}
