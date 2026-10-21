import { useId } from 'react'
import { cn } from '../../lib/cn'
import { SCALE_WORDS } from '../../lib/constants'

/** Read-only 1–5 meter: five short segments, with the value spoken for screen readers. */
export function ScaleMeter({
  label,
  value,
  low,
  high,
  compact,
}: {
  label: string
  value: number | null
  low?: string
  high?: string
  compact?: boolean
}) {
  const text = value == null ? 'Not rated' : `${value} of 5, ${SCALE_WORDS[value].toLowerCase()}`
  return (
    <div className={cn('min-w-0', compact ? 'space-y-1' : 'space-y-1.5')}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="text-ink-3">{value == null ? '—' : SCALE_WORDS[value]}</span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${label}: ${text}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cn('h-1.5 flex-1 rounded-full', value != null && n <= value ? 'bg-accent' : 'bg-sunken')}
          />
        ))}
      </div>
      {!compact && (low || high) && (
        <div className="flex justify-between text-[0.6875rem] text-ink-3">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  )
}

/** 1–5 picker built on native radios (arrow keys work), with a "not set" option. */
export function ScaleInput({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  low?: string
  high?: string
}) {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 flex w-full items-baseline justify-between text-sm font-medium text-ink">
        <span>{label}</span>
        <span className="text-xs font-normal text-ink-3">{value == null ? 'Not set' : SCALE_WORDS[value]}</span>
      </legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex-1">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex h-9 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                value != null && n <= value
                  ? 'border-accent bg-accent-soft text-ink'
                  : 'border-line bg-surface text-ink-3 hover:border-line-strong',
              )}
            >
              {n}
            </span>
          </label>
        ))}
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={value == null}
          className="h-9 rounded-md px-2 text-xs text-ink-3 hover:text-ink disabled:opacity-40"
          aria-label={`Clear ${label}`}
        >
          Clear
        </button>
      </div>
      {(low || high) && (
        <div className="mt-1 flex justify-between pr-12 text-[0.6875rem] text-ink-3">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </fieldset>
  )
}

/** Bottle fill indicator. */
export function BottleLevel({
  percent,
  low,
  className,
}: {
  percent: number | null
  low?: boolean
  className?: string
}) {
  if (percent == null) return null
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Bottle remaining"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', low ? 'bg-warning' : 'bg-accent')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn('w-9 text-right text-xs tabular-nums', low ? 'font-medium text-warning' : 'text-ink-3')}>
        {percent}%
      </span>
    </div>
  )
}
