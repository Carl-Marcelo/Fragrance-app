import { Columns3, Plus, X } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FragranceRow } from '../../components/fragrance/FragranceCard'
import { FragranceImage } from '../../components/fragrance/FragranceImage'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useEntries } from '../../hooks/queries'
import {
  CHARACTER_SCALES,
  OCCASION_SUITABILITY,
  PERFORMANCE_SCALES,
  STATUSES,
  WEATHER_SUITABILITY,
  concentrationLabel,
  statusLabel,
} from '../../lib/constants'
import { cn } from '../../lib/cn'
import { normalize } from '../../lib/filters'
import { formatMoney, formatRating, pricePerMl } from '../../lib/format'
import { compareWishlist, similarity } from '../../lib/similarity'
import type { CollectionEntry } from '../../lib/types'

const MAX = 4

export default function ComparePage() {
  const [params, setParams] = useSearchParams()
  const entries = useEntries()
  const tab = params.get('tab') === 'wishlist' ? 'wishlist' : 'side'

  const setTab = (t: 'side' | 'wishlist') =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (t === 'wishlist') n.set('tab', 'wishlist')
      else n.delete('tab')
      return n
    })

  return (
    <div>
      <PageHeader
        eyebrow="Tools"
        title="Compare"
        description="Put perfumes side by side, or see how wishlist items relate to what you already own."
      />
      <div className="mb-6 flex gap-1 border-b border-line" role="group" aria-label="Comparison type">
        {(
          [
            ['side', 'Side by side'],
            ['wishlist', 'Wishlist vs collection'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors',
              tab === key ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {entries.isPending ? (
        <LoadingBlock />
      ) : entries.isError ? (
        <ErrorState error={entries.error} onRetry={() => entries.refetch()} />
      ) : tab === 'side' ? (
        <SideBySide entries={entries.data} />
      ) : (
        <WishlistVsCollection entries={entries.data} />
      )}
    </div>
  )
}

function SideBySide({ entries }: { entries: CollectionEntry[] }) {
  const [params, setParams] = useSearchParams()
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, MAX)
  const selected = ids.map((id) => entries.find((e) => e.id === id)).filter((e): e is CollectionEntry => Boolean(e))

  const setIds = (next: string[]) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (next.length) n.set('ids', next.join(','))
        else n.delete('ids')
        return n
      },
      { replace: true },
    )

  // Values that appear in two or more selected perfumes get highlighted.
  const shared = useMemo(() => {
    const count = (lists: string[][]) => {
      const c = new Map<string, number>()
      lists.forEach((l) => new Set(l.map(normalize)).forEach((v) => c.set(v, (c.get(v) ?? 0) + 1)))
      return new Set([...c.entries()].filter(([, n]) => n > 1).map(([v]) => v))
    }
    return {
      accords: count(selected.map((e) => e.fragrance.accords)),
      notes: count(selected.map((e) => [...e.fragrance.notes_top, ...e.fragrance.notes_middle, ...e.fragrance.notes_base])),
    }
  }, [selected])

  const available = entries.filter((e) => !ids.includes(e.id))

  if (!entries.length) {
    return <EmptyState icon={<Columns3 />} title="Nothing to compare yet" description="Add a few perfumes first." />
  }

  const tags = (values: string[], highlight: Set<string>) =>
    values.length ? (
      <span className="flex flex-wrap gap-1">
        {values.map((v) => (
          <span
            key={v}
            className={cn(
              'rounded-full px-2 py-0.5 text-xs capitalize',
              highlight.has(normalize(v)) ? 'bg-accent-soft text-ink' : 'bg-sunken text-ink-2',
            )}
          >
            {v}
          </span>
        ))}
      </span>
    ) : (
      <span className="text-ink-3">—</span>
    )

  const row = (label: string, render: (e: CollectionEntry) => ReactNode) => (
    <tr key={label}>
      <th scope="row" className="sticky left-0 z-10 w-36 bg-surface py-2.5 pr-4 text-left align-top text-xs font-medium text-ink-3">
        {label}
      </th>
      {selected.map((e) => (
        <td key={e.id} className="min-w-[11rem] py-2.5 pr-4 align-top text-sm text-ink">
          {render(e)}
        </td>
      ))}
    </tr>
  )

  const scale = (v: number | null) => (v == null ? <span className="text-ink-3">—</span> : `${v} / 5`)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((e) => (
          <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1 pl-3 text-sm">
            {e.fragrance.name}
            <button
              type="button"
              onClick={() => setIds(ids.filter((x) => x !== e.id))}
              className="rounded-full p-0.5 text-ink-3 hover:bg-sunken hover:text-ink"
              aria-label={`Remove ${e.fragrance.name}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {selected.length < MAX && available.length > 0 && (
          <label className="inline-flex items-center gap-2">
            <Plus className="size-4 text-ink-3" aria-hidden />
            <span className="sr-only">Add a perfume to compare</span>
            <select
              className="field-input h-9 w-auto"
              value=""
              onChange={(ev) => ev.target.value && setIds([...ids, ev.target.value])}
            >
              <option value="">Add a perfume…</option>
              {STATUSES.map((s) => (
                <optgroup key={s.value} label={s.plural}>
                  {available
                    .filter((e) => e.status === s.value)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fragrance.name} · {e.fragrance.brand}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
      </div>

      {selected.length < 2 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-8 text-center text-sm text-ink-2">
          Choose at least two perfumes. Shared notes and accords are highlighted.
        </p>
      ) : (
        <div className="card overflow-x-auto p-4">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <td className="sticky left-0 z-10 bg-surface" />
                {selected.map((e) => (
                  <th key={e.id} scope="col" className="pr-4 pb-4 text-left align-bottom font-normal">
                    <Link to={`/app/perfume/${e.id}`} className="block">
                      <FragranceImage
                        fragrance={e.fragrance}
                        bottlePhotoPath={e.bottle_image_path}
                        className="mb-3 aspect-square w-full max-w-[9rem] rounded-md border border-line"
                      />
                      <span className="eyebrow block">{e.fragrance.brand}</span>
                      <span className="mt-0.5 block font-display text-xl leading-tight text-ink">{e.fragrance.name}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr]:border-t [&_tr]:border-line [&_td]:border-t [&_td]:border-line [&_th[scope=row]]:border-t [&_th[scope=row]]:border-line">
              {row('Status', (e) => <Badge>{statusLabel(e.status)}</Badge>)}
              {row(`Similarity to ${selected[0].fragrance.name}`, (e) =>
                e.id === selected[0].id ? (
                  <span className="text-ink-3">Reference</span>
                ) : (
                  `${Math.round(similarity(selected[0].fragrance, e.fragrance) * 100)}%`
                ),
              )}
              {row('Concentration', (e) => concentrationLabel(e.fragrance.concentration) || '—')}
              {row('Year', (e) => e.fragrance.release_year ?? '—')}
              {row('Family', (e) => e.fragrance.family ?? '—')}
              {row('Accords', (e) => tags(e.fragrance.accords, shared.accords))}
              {row('Top notes', (e) => tags(e.fragrance.notes_top, shared.notes))}
              {row('Heart notes', (e) => tags(e.fragrance.notes_middle, shared.notes))}
              {row('Base notes', (e) => tags(e.fragrance.notes_base, shared.notes))}
              {[...CHARACTER_SCALES, ...PERFORMANCE_SCALES].map((s) => row(s.label, (e) => scale(e.fragrance[s.key])))}
              {[...WEATHER_SUITABILITY, ...OCCASION_SUITABILITY].map((s) => row(s.label, (e) => scale(e.fragrance[s.key])))}
              {row('My rating', (e) => formatRating(e.personal_rating))}
              {row('Price', (e) => formatMoney(e.purchase_price, e.currency))}
              {row('Price per ml', (e) => {
                const p = pricePerMl(e.purchase_price, e.bottle_size_ml)
                return p == null ? '—' : formatMoney(p, e.currency)
              })}
              {row('Bottle', (e) => (e.bottle_size_ml ? `${e.bottle_size_ml} ml` : '—'))}
              {row('Remaining', (e) => (e.status === 'owned' && e.remaining_percent != null ? `${e.remaining_percent}%` : '—'))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function WishlistVsCollection({ entries }: { entries: CollectionEntry[] }) {
  const wishlist = entries.filter((e) => e.status === 'wishlist')
  const owned = entries.filter((e) => e.status === 'owned')
  const results = useMemo(() => compareWishlist(wishlist, owned), [wishlist, owned])

  if (!wishlist.length) {
    return (
      <EmptyState
        title="Your wishlist is empty"
        description="Add perfumes you’re considering to see how they relate to what you own."
        action={
          <ButtonLink to="/app/perfume/new?status=wishlist" icon={<Plus />}>
            Add to wishlist
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        Similarity is calculated from saved accords, notes, family and character ratings. Records with more detail
        compare more accurately.
      </p>
      {results.map(({ wish, closest, newAccords, verdict }) => (
        <section key={wish.id} className="card grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div>
            <FragranceRow fragrance={wish.fragrance} item={wish} to={`/app/perfume/${wish.id}`} />
            {wish.want_reason && <p className="mt-2 text-sm text-ink-2 italic">“{wish.want_reason}”</p>}
            <p className="mt-3 text-sm font-medium text-ink">{verdict}</p>
            {newAccords.length > 0 && owned.length > 0 && (
              <p className="mt-2 text-xs text-ink-3">
                Adds accords you don’t have yet:{' '}
                <span className="text-ink-2 capitalize">{newAccords.join(', ')}</span>
              </p>
            )}
          </div>
          <div>
            <p className="eyebrow mb-2">Closest in your collection</p>
            {closest.length ? (
              <ul className="space-y-1">
                {closest.map(({ target, score }) => (
                  <li key={target.id}>
                    <FragranceRow
                      fragrance={target.fragrance}
                      item={target}
                      to={`/app/compare?ids=${wish.id},${target.id}`}
                      trailing={
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-sunken">
                            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(score * 100)}%` }} />
                          </span>
                          <span className="w-9 text-xs text-ink-3 tabular-nums">{Math.round(score * 100)}%</span>
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">Nothing similar enough in your collection.</p>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
