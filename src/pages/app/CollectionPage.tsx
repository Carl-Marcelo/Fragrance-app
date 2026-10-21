import { ArrowRightLeft, GalleryVerticalEnd, Heart, LayoutGrid, List, Plus, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlphabetBar, FilterLayout, SearchSortBar } from '../../components/filters/FilterPanel'
import { FragranceMeta } from '../../components/fragrance/FragranceBits'
import { FragranceCard } from '../../components/fragrance/FragranceCard'
import { FragranceImage } from '../../components/fragrance/FragranceImage'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { BottleLevel } from '../../components/ui/Scale'
import { CardSkeletons, EmptyState, ErrorState } from '../../components/ui/States'
import { useEntries, useSettings, useUpdateItem } from '../../hooks/queries'
import { useFilterState } from '../../hooks/useFilterState'
import { statusLabel } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { applyFilters, defaultFilters, facetValues } from '../../lib/filters'
import { errorMessage, formatDate, formatMoney, formatRating, totalsByCurrency } from '../../lib/format'
import type { CollectionEntry, CollectionStatus } from '../../lib/types'
import { useToast } from '../../providers/ToastProvider'

type View = CollectionStatus | 'favorites'

const VIEW_META: Record<View, { title: string; eyebrow: string; description: string; empty: string; addStatus: CollectionStatus }> = {
  owned: {
    eyebrow: 'Collection',
    title: 'My Collection',
    description: 'Bottles you own right now.',
    empty: 'Add the bottles on your shelf to track levels, value and how you wear them.',
    addStatus: 'owned',
  },
  wishlist: {
    eyebrow: 'Wishlist',
    title: 'My Wishlist',
    description: 'Fragrances you want, and why.',
    empty: 'Keep track of what you’d like to try or buy next, with a note on why.',
    addStatus: 'wishlist',
  },
  favorites: {
    eyebrow: 'Favourites',
    title: 'My Favourites',
    description: 'The ones you keep coming back to, owned or not.',
    empty: 'Tap the heart on any perfume to collect your favourites here.',
    addStatus: 'owned',
  },
  previously_owned: {
    eyebrow: 'Archive',
    title: 'Previously Owned',
    description: 'Finished, sold or given away, kept for memory.',
    empty: 'When you finish or part with a bottle, move it here to keep its notes.',
    addStatus: 'previously_owned',
  },
}

const LAYOUT_KEY = 'sillage.collectionLayout'

function readLayout(): 'grid' | 'list' {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export default function CollectionPage({ view }: { view: View }) {
  const meta = VIEW_META[view]
  const entries = useEntries()
  const { settings } = useSettings()
  const update = useUpdateItem()
  const toast = useToast()
  const navigate = useNavigate()
  const [layout, setLayout] = useState(readLayout)

  const base = useMemo(() => defaultFilters(), [])
  const filters = useFilterState(base)

  const inView = useMemo(
    () =>
      (entries.data ?? []).filter((e) => (view === 'favorites' ? e.is_favorite : e.status === view)),
    [entries.data, view],
  )
  const rows = useMemo(() => inView.map((e) => ({ fragrance: e.fragrance, item: e, entry: e })), [inView])
  const facets = useMemo(() => facetValues(rows), [rows])
  const results = useMemo(() => applyFilters(rows, filters.state), [rows, filters.state])
  const totals = useMemo(() => totalsByCurrency(inView.filter((e) => e.status === 'owned')), [inView])

  const changeLayout = (l: 'grid' | 'list') => {
    setLayout(l)
    try {
      localStorage.setItem(LAYOUT_KEY, l)
    } catch {
      /* ignore */
    }
  }

  const toggleFavorite = (e: CollectionEntry) =>
    update.mutate(
      { id: e.id, patch: { is_favorite: !e.is_favorite } },
      { onError: (err) => toast.error('Couldn’t update favourite', errorMessage(err)) },
    )

  const moveToCollection = (e: CollectionEntry) =>
    update.mutate(
      { id: e.id, patch: { status: 'owned', remaining_percent: e.remaining_percent ?? 100 } },
      {
        onSuccess: () => {
          toast.success(`${e.fragrance.name} moved to your collection`, 'Add the purchase price and date when you can.')
          navigate(`/app/perfume/${e.id}/edit`)
        },
        onError: (err) => toast.error('Couldn’t move it', errorMessage(err)),
      },
    )

  return (
    <div>
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={
          <>
            {meta.description}
            {view === 'owned' && totals.length > 0 && (
              <span className="mt-1 block text-ink-3">
                Recorded value {totals.map((t) => formatMoney(t.total, t.currency)).join(' + ')}
              </span>
            )}
          </>
        }
        actions={
          <>
            {view === 'wishlist' && inView.length > 0 && (
              <ButtonLink to="/app/compare?tab=wishlist" variant="secondary" icon={<ArrowRightLeft />}>
                Compare with collection
              </ButtonLink>
            )}
            <ButtonLink to={`/app/perfume/new?status=${meta.addStatus}`} icon={<Plus />}>
              Add perfume
            </ButtonLink>
          </>
        }
      />

      {entries.isError ? (
        <ErrorState error={entries.error} onRetry={() => entries.refetch()} />
      ) : entries.isPending ? (
        <CardSkeletons />
      ) : !inView.length ? (
        <EmptyState
          icon={view === 'favorites' ? <Heart /> : <GalleryVerticalEnd />}
          title="Nothing here yet"
          description={meta.empty}
          action={
            view !== 'favorites' && (
              <ButtonLink to={`/app/perfume/new?status=${meta.addStatus}`} icon={<Plus />}>
                Add perfume
              </ButtonLink>
            )
          }
        />
      ) : (
        <FilterLayout
          controls={{
            ...filters,
            facets,
            showStatus: view === 'favorites',
            showFavorites: view !== 'favorites',
          }}
          toolbar={(open, count) => (
            <>
              <SearchSortBar state={filters.state} update={filters.update} privateSorts onOpenFilters={open} filterCount={count} />
              <AlphabetBar state={filters.state} update={filters.update} available={facets.letters} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-3" aria-live="polite">
                  {results.length} of {inView.length}
                </p>
                <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="Layout">
                  {(['grid', 'list'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={layout === l}
                      onClick={() => changeLayout(l)}
                      className={cn('rounded p-1.5', layout === l ? 'bg-sunken text-ink' : 'text-ink-3 hover:text-ink')}
                      aria-label={l === 'grid' ? 'Grid view' : 'List view'}
                    >
                      {l === 'grid' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        >
          {!results.length ? (
            <EmptyState
              icon={<SearchX />}
              title="No matches"
              description="No perfumes match all of the selected filters."
              action={
                <Button variant="secondary" onClick={filters.clear}>
                  Clear all filters
                </Button>
              }
            />
          ) : layout === 'grid' ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map(({ entry: e }) => (
                <FragranceCard
                  key={e.id}
                  fragrance={e.fragrance}
                  item={e}
                  to={`/app/perfume/${e.id}`}
                  lowThreshold={settings.low_bottle_threshold}
                  onToggleFavorite={() => toggleFavorite(e)}
                  showStatus={view === 'favorites'}
                  footer={
                    e.status === 'wishlist' && (
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs text-ink-3" title={e.want_reason ?? undefined}>
                          {e.want_reason ?? 'No reason noted'}
                        </p>
                        <Button size="sm" variant="quiet" onClick={() => moveToCollection(e)} disabled={update.isPending}>
                          I bought it
                        </Button>
                      </div>
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <ListTable entries={results.map((r) => r.entry)} lowThreshold={settings.low_bottle_threshold} />
          )}
        </FilterLayout>
      )}
    </div>
  )
}

function ListTable({ entries, lowThreshold }: { entries: CollectionEntry[]; lowThreshold: number }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="border-b border-line text-xs text-ink-3">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Perfume</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Rating</th>
            <th scope="col" className="px-4 py-3 font-medium">Price</th>
            <th scope="col" className="w-36 px-4 py-3 font-medium">Remaining</th>
            <th scope="col" className="px-4 py-3 font-medium">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {entries.map((e) => {
            const low = e.status === 'owned' && e.remaining_percent != null && e.remaining_percent <= lowThreshold
            return (
              <tr key={e.id} className="hover:bg-sunken/60">
                <td className="px-4 py-2.5">
                  <Link to={`/app/perfume/${e.id}`} className="flex items-center gap-3">
                    <FragranceImage
                      fragrance={e.fragrance}
                      bottlePhotoPath={e.bottle_image_path}
                      sizes="thumb"
                      className="size-10 shrink-0 rounded border border-line"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {e.fragrance.name}
                        {e.is_favorite && <Heart className="ml-1.5 inline size-3 fill-danger text-danger" aria-label="Favourite" />}
                      </span>
                      <span className="block truncate text-xs text-ink-3">{e.fragrance.brand}</span>
                      <FragranceMeta fragrance={e.fragrance} className="sr-only" />
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <Badge>{statusLabel(e.status)}</Badge>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{formatRating(e.personal_rating)}</td>
                <td className="px-4 py-2.5 tabular-nums">{formatMoney(e.purchase_price, e.currency)}</td>
                <td className="px-4 py-2.5">
                  {e.status === 'owned' ? <BottleLevel percent={e.remaining_percent} low={low} /> : <span className="text-ink-3">—</span>}
                </td>
                <td className="px-4 py-2.5 text-ink-3">{formatDate(e.created_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
