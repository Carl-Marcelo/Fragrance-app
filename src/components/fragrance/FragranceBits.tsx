import { CircleHelp, ExternalLink, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import {
  CHARACTER_SCALES,
  INFO_STATUS,
  OCCASION_SUITABILITY,
  PERFORMANCE_SCALES,
  RATINGS_BASIS,
  SCALE_WORDS,
  SOURCE_KINDS,
  concentrationLabel,
} from '../../lib/constants'
import { cn } from '../../lib/cn'
import type { Fragrance, InfoStatus } from '../../lib/types'
import { Badge } from '../ui/Badge'
import { ScaleMeter } from '../ui/Scale'

export function InfoStatusBadge({ status }: { status: InfoStatus }) {
  const meta = INFO_STATUS[status]
  if (status === 'verified')
    return (
      <Badge tone="success" title={meta.description}>
        <ShieldCheck /> {meta.label}
      </Badge>
    )
  if (status === 'needs_review')
    return (
      <Badge tone="warning" title={meta.description}>
        <ShieldAlert /> {meta.label}
      </Badge>
    )
  return (
    <Badge tone="neutral" title={meta.description}>
      <CircleHelp /> {meta.label}
    </Badge>
  )
}

export function EstimateBadge({ basis }: { basis: Fragrance['ratings_basis'] }) {
  return (
    <Badge tone="info" title="Subjective ratings, not measured facts">
      {RATINGS_BASIS[basis]}
    </Badge>
  )
}

/** "EDP · 2019 · Woody" */
export function FragranceMeta({ fragrance, className }: { fragrance: Fragrance; className?: string }) {
  const parts = [concentrationLabel(fragrance.concentration, true), fragrance.release_year, fragrance.family].filter(
    Boolean,
  )
  if (!parts.length) return null
  return <p className={cn('text-xs text-ink-3', className)}>{parts.join(' · ')}</p>
}

export function NotesPyramid({ fragrance }: { fragrance: Fragrance }) {
  const tiers = [
    { label: 'Top', hint: 'First impression, first 15–30 min', notes: fragrance.notes_top },
    { label: 'Heart', hint: 'The core, after the opening fades', notes: fragrance.notes_middle },
    { label: 'Base', hint: 'The long dry-down', notes: fragrance.notes_base },
  ]
  if (tiers.every((t) => !t.notes.length)) {
    return <p className="text-sm text-ink-3">No notes recorded yet.</p>
  }
  // Some fragrances publish a flat note list. Show it once without tiers.
  const flat = !fragrance.notes_top.length && !fragrance.notes_base.length
  if (flat) {
    return <p className="text-[0.9375rem] leading-relaxed text-ink">{fragrance.notes_middle.join(' · ')}</p>
  }
  return (
    <dl className="divide-y divide-line">
      {tiers.map((t) => (
        <div key={t.label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[7rem_1fr] sm:gap-4">
          <dt>
            <span className="eyebrow">{t.label}</span>
            <span className="sr-only">: {t.hint}</span>
          </dt>
          <dd className="text-[0.9375rem] leading-relaxed text-ink">
            {t.notes.length ? t.notes.join(' · ') : <span className="text-ink-3">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function AccordList({ accords, limit }: { accords: string[]; limit?: number }) {
  if (!accords.length) return <p className="text-sm text-ink-3">No accords recorded.</p>
  const shown = limit ? accords.slice(0, limit) : accords
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Main accords">
      {shown.map((a, i) => (
        <li
          key={a}
          className={cn(
            'rounded-full border px-3 py-1 text-[0.8125rem] capitalize',
            i === 0 ? 'border-accent/40 bg-accent-soft text-ink' : 'border-line bg-surface text-ink-2',
          )}
        >
          {a}
        </li>
      ))}
      {limit && accords.length > limit && <li className="px-1 py-1 text-xs text-ink-3">+{accords.length - limit}</li>}
    </ul>
  )
}

export function CharacterScales({ fragrance }: { fragrance: Fragrance }) {
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {[...CHARACTER_SCALES, ...PERFORMANCE_SCALES].map((s) => (
        <ScaleMeter key={s.key} label={s.label} value={fragrance[s.key]} low={s.low} high={s.high} />
      ))}
    </div>
  )
}

const WEATHER_ROWS = [
  { key: 'suit_hot', label: 'Heat' },
  { key: 'suit_humid', label: 'Humidity' },
  { key: 'suit_rainy', label: 'Rainy days' },
  { key: 'suit_aircon', label: 'Air-conditioned' },
] as const

export function SuitabilityTable({ fragrance }: { fragrance: Fragrance }) {
  const groups = [
    { title: 'Weather', rows: WEATHER_ROWS },
    { title: 'Occasion', rows: OCCASION_SUITABILITY },
  ]
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="eyebrow mb-2">{g.title}</p>
          <ul className="space-y-1.5">
            {g.rows.map((r) => {
              const v = fragrance[r.key]
              return (
                <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-2">{r.label}</span>
                  <SuitDots value={v} label={r.label} />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function SuitDots({ value, label }: { value: number | null; label: string }) {
  return (
    <span
      className="flex items-center gap-1"
      role="img"
      aria-label={`${label}: ${value == null ? 'not rated' : `${value} of 5`}`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn('size-2 rounded-full', value != null && n <= value ? 'bg-accent' : 'bg-sunken ring-1 ring-line')}
        />
      ))}
      <span className="ml-1.5 w-16 text-right text-xs text-ink-3">{value == null ? '—' : SCALE_WORDS[value]}</span>
    </span>
  )
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function SourceLinks({ fragrance }: { fragrance: Fragrance }) {
  if (!fragrance.source_links.length) {
    return <p className="text-sm text-ink-3">No sources recorded. Treat details as unverified.</p>
  }
  return (
    <ul className="space-y-2">
      {fragrance.source_links.map((s, i) => (
        <li key={`${s.url}-${i}`} className="flex items-start gap-2 text-sm">
          <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
          <span className="min-w-0">
            <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="link break-words">
              {s.label || hostOf(s.url)}
            </a>
            <span className="ml-2 text-xs text-ink-3">{SOURCE_KINDS.find((k) => k.value === s.kind)?.label}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Opens searches in a new tab so the owner can verify details by hand. Nothing is scraped. */
export function LookupLinks({ name, brand }: { name: string; brand: string }) {
  if (!name.trim() && !brand.trim()) return null
  const q = `${brand} ${name}`.trim()
  const google = (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  const links = [
    { label: 'Official site', href: google(`${q} official site`) },
    { label: 'Fragrantica', href: google(`site:fragrantica.com ${q}`) },
    { label: 'Parfumo', href: google(`site:parfumo.com ${q}`) },
    { label: 'Basenotes', href: google(`site:basenotes.com ${q}`) },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      <span className="inline-flex items-center gap-1.5 text-ink-3">
        <Search className="size-3.5" aria-hidden /> Look up:
      </span>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="link">
          {l.label}
        </a>
      ))}
    </div>
  )
}
