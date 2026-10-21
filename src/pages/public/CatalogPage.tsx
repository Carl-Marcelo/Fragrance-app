import { GalleryVerticalEnd, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { AlphabetBar, FilterLayout, SearchSortBar } from '../../components/filters/FilterPanel'
import { FragranceCard } from '../../components/fragrance/FragranceCard'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeletons, EmptyState, ErrorState } from '../../components/ui/States'
import { useEntries, usePublicFragrances } from '../../hooks/queries'
import { useFilterState } from '../../hooks/useFilterState'
import { applyFilters, defaultFilters, facetValues } from '../../lib/filters'
import { statusLabel } from '../../lib/constants'
import { useIsOwner } from '../../providers/AuthProvider'

export default function CatalogPage() {
  const catalog = usePublicFragrances()
  const owner = useIsOwner()
  const entries = useEntries()
  const base = useMemo(() => defaultFilters({ sort: 'name', dir: 'asc' }), [])
  const { state, update, clear } = useFilterState(base)

  const rows = useMemo(() => (catalog.data ?? []).map((fragrance) => ({ fragrance })), [catalog.data])
  const facets = useMemo(() => facetValues(rows), [rows])
  const results = useMemo(() => applyFilters(rows, state), [rows, state])

  // Only the signed-in owner sees which catalog entries they own; visitors never do.
  const ownedStatus = useMemo(() => {
    const map = new Map<string, string>()
    if (owner) entries.data?.forEach((e) => map.set(e.fragrance_id, statusLabel(e.status)))
    return map
  }, [owner, entries.data])

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Fragrance catalog"
        description="A curated shelf of fragrances from this journal, with personal impressions of character, performance and how they behave in tropical weather. To search everything, use Discover."
      />

      {catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : catalog.isPending ? (
        <CardSkeletons />
      ) : !rows.length ? (
        <EmptyState
          icon={<GalleryVerticalEnd />}
          title="Nothing published yet"
          description={
            owner
              ? 'Fragrances you mark as “Show in public catalog” appear here. Everything else stays private.'
              : 'The owner hasn’t published any fragrance profiles yet.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/discover">Discover fragrances</ButtonLink>
              {owner && (
                <ButtonLink to="/app/library" variant="secondary">
                  Manage what’s published
                </ButtonLink>
              )}
            </div>
          }
        />
      ) : (
        <FilterLayout
          controls={{ state, update, clear, facets }}
          toolbar={(open, count) => (
            <>
              <SearchSortBar state={state} update={update} onOpenFilters={open} filterCount={count} />
              <AlphabetBar state={state} update={update} available={facets.letters} />
              <p className="text-sm text-ink-3" aria-live="polite">
                {results.length} of {rows.length} fragrance{rows.length === 1 ? '' : 's'}
              </p>
            </>
          )}
        >
          {results.length ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map(({ fragrance }) => (
                <FragranceCard
                  key={fragrance.id}
                  fragrance={fragrance}
                  to={`/fragrance/${fragrance.id}`}
                  footer={
                    ownedStatus.has(fragrance.id) && (
                      <Badge tone="accent">In your journal · {ownedStatus.get(fragrance.id)}</Badge>
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<SearchX />}
              title="No matches"
              description="Try removing a filter or searching for something broader."
              action={
                <Button variant="secondary" onClick={clear}>
                  Clear all filters
                </Button>
              }
            />
          )}
        </FilterLayout>
      )}
    </div>
  )
}
