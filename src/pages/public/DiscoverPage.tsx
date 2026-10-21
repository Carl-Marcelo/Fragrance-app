import { CircleAlert, Compass, PenLine, Search, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DiscoverCard, useDiscoverBase } from '../../components/discover/DiscoverBits'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeletons, EmptyState, Notice } from '../../components/ui/States'
import { DiscoverError } from '../../api/discover'
import { useDiscoverBrand, useDiscoverSearch, useDiscoverStatus } from '../../hooks/discover'
import { cn } from '../../lib/cn'
import { BRAND_SHELVES, shelfById } from '../../lib/discover/brands'
import type { DiscoverGender, DiscoveredFragrance } from '../../lib/discover/types'
import { useIsOwner } from '../../providers/AuthProvider'

const GENDERS: { value: DiscoverGender | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'unisex', label: 'Unisex' },
]

function ResultGrid({ results, base }: { results: DiscoveredFragrance[]; base: string }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {results.map((d) => (
        <DiscoverCard key={d.ref} d={d} base={base} />
      ))}
    </div>
  )
}

function DiscoverErrorNotice({ error, owner }: { error: unknown; owner: boolean }) {
  const code = error instanceof DiscoverError ? error.code : 'provider_error'
  const message = error instanceof Error ? error.message : 'The fragrance database is unavailable right now.'
  return (
    <Notice tone="warning" icon={<CircleAlert />}>
      <p className="font-medium text-ink">{message}</p>
      {owner && (code === 'provider_auth' || code === 'limits_unavailable') && (
        <p className="mt-1">See “Fragrance database” in docs/DEPLOYMENT.md to finish setup.</p>
      )}
      {owner && code === 'monthly_cap' && (
        <p className="mt-1">Raise DISCOVER_MONTHLY_CAP in your Vercel settings if you want more searches this month.</p>
      )}
    </Notice>
  )
}

export default function DiscoverPage() {
  const [params, setParams] = useSearchParams()
  const base = useDiscoverBase()
  const owner = useIsOwner()
  const status = useDiscoverStatus()

  const q = params.get('q') ?? ''
  const genderParam = params.get('gender')
  const gender = (['men', 'women', 'unisex'].includes(genderParam ?? '') ? genderParam : null) as DiscoverGender | null
  const page = params.get('page') === '2' ? 2 : 1
  const shelf = shelfById(params.get('shelf'))
  const brand = params.get('brand')

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)))
        return n
      },
      { replace: true },
    )

  // Debounce typing so each keystroke doesn't spend a search.
  const [draft, setDraft] = useState(q)
  useEffect(() => {
    setDraft(q)
  }, [q])
  useEffect(() => {
    if (draft === q) return
    const t = window.setTimeout(() => set({ q: draft.trim() ? draft : null, page: null }), 450)
    return () => window.clearTimeout(t)
  }, [draft]) // only typing should restart the timer

  const searching = q.trim().length >= 3
  const search = useDiscoverSearch(q, gender, page)
  const brandQuery = useDiscoverBrand(!searching && brand ? brand : null)

  const available = status.data?.available

  return (
    <div>
      <PageHeader
        eyebrow="Discover"
        title="Find your next fragrance"
        description={
          <>
            Search a database of over 100,000 designer, niche, Middle Eastern and independent fragrances. Open any one
            for its notes, performance and a spray guide for Philippine weather
            {owner ? ', then add it to your collection or wishlist in one tap.' : '.'}
          </>
        }
      />

      {status.isSuccess && !available ? (
        <EmptyState
          icon={<Compass />}
          title="Live search isn’t connected yet"
          description={
            owner
              ? 'Add your Fragella API key (and the Supabase service key for search limits) in your environment settings. See “Fragrance database” in docs/DEPLOYMENT.md. You can still add perfumes by hand.'
              : 'The fragrance database is offline right now. You can still browse the curated catalog and use the spray guide.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/catalog" variant="secondary">
                Curated catalog
              </ButtonLink>
              {owner && (
                <ButtonLink to="/app/perfume/new" icon={<PenLine />}>
                  Add by hand
                </ButtonLink>
              )}
            </div>
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="relative block">
              <span className="sr-only">Search fragrances or brands</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search a fragrance or brand, e.g. “Khamrah” or “Aventus”"
                className="field-input h-12 pl-12 text-base"
                autoComplete="off"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {GENDERS.map((g) => (
                <Chip key={g.label} selected={gender === g.value} onClick={() => set({ gender: g.value, page: null })}>
                  {g.label}
                </Chip>
              ))}
              {draft.trim().length > 0 && draft.trim().length < 3 && (
                <span className="text-xs text-ink-3">Type at least 3 characters</span>
              )}
            </div>
          </div>

          {searching ? (
            <section aria-live="polite" aria-busy={search.isFetching}>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-2xl">Results for “{q.trim()}”</h2>
                {page === 2 && (
                  <Button size="sm" variant="ghost" onClick={() => set({ page: null })}>
                    Back to first page
                  </Button>
                )}
              </div>
              {search.isError ? (
                <DiscoverErrorNotice error={search.error} owner={owner} />
              ) : search.isPending ? (
                <CardSkeletons count={6} />
              ) : search.data.results.length ? (
                <>
                  <ResultGrid results={search.data.results} base={base} />
                  {page === 1 && search.data.results.length >= 10 && (
                    <div className="mt-6 text-center">
                      <Button variant="secondary" onClick={() => set({ page: '2' })} loading={search.isFetching}>
                        More results
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={<SearchX />}
                  title="No matches"
                  description="Try the brand name, a shorter name, or a different spelling."
                  action={
                    owner && (
                      <ButtonLink to="/app/perfume/new" variant="secondary" icon={<PenLine />}>
                        Add it by hand
                      </ButtonLink>
                    )
                  }
                />
              )}
            </section>
          ) : (
            <section aria-labelledby="shelves-heading">
              <h2 id="shelves-heading" className="sr-only">
                Browse by house
              </h2>
              <div
                role="group"
                aria-label="Category"
                className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
              >
                {BRAND_SHELVES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={s.id === shelf.id}
                    onClick={() => set({ shelf: s.id, brand: null })}
                    className={cn(
                      '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors sm:px-4',
                      s.id === shelf.id ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm text-ink-2">{shelf.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {shelf.brands.map((b) => (
                  <Chip key={b} selected={brand === b} onClick={() => set({ brand: brand === b ? null : b })}>
                    {b}
                  </Chip>
                ))}
              </div>

              <div className="mt-8" aria-live="polite">
                {!brand ? (
                  <p className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-2">
                    Pick a house to see its fragrances, or search above.
                  </p>
                ) : brandQuery.isError ? (
                  <DiscoverErrorNotice error={brandQuery.error} owner={owner} />
                ) : brandQuery.isPending ? (
                  <CardSkeletons count={6} />
                ) : brandQuery.data.results.length ? (
                  <>
                    <h2 className="mb-1 text-2xl">{brand}</h2>
                    <p className="mb-4 text-sm text-ink-3">
                      {brandQuery.data.fallback
                        ? `Closest matches for “${brand}”.`
                        : `${brandQuery.data.results.length} fragrances, most popular first.`}
                    </p>
                    <ResultGrid results={brandQuery.data.results} base={base} />
                  </>
                ) : (
                  <EmptyState
                    icon={<SearchX />}
                    title={`Nothing found for ${brand}`}
                    description="The database may not cover this house yet. Try searching a specific fragrance name."
                  />
                )}
              </div>
            </section>
          )}

          <p className="border-t border-line pt-6 text-xs text-ink-3">
            Fragrance data and images from{' '}
            <a href="https://fragella.com" target="_blank" rel="noopener noreferrer" className="link">
              Fragella
            </a>
            . Community ratings and notes can be incomplete. Check the brand’s official description before buying.
          </p>
        </div>
      )}
    </div>
  )
}
