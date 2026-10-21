import { Compass, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDiscoverSearch, useDiscoverStatus } from '../../hooks/discover'
import type { DiscoveredFragrance } from '../../lib/discover/types'
import { errorMessage } from '../../lib/format'
import { FragranceImage } from '../fragrance/FragranceImage'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/States'
import { discoverMeta } from './DiscoverBits'

/** Search the fragrance database and hand the chosen result to the form. */
export function DatabasePrefill({ onPick, picked }: { onPick: (d: DiscoveredFragrance) => void; picked: string | null }) {
  const status = useDiscoverStatus()
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const search = useDiscoverSearch(q, null, 1)

  useEffect(() => {
    const t = window.setTimeout(() => setQ(draft), 450)
    return () => window.clearTimeout(t)
  }, [draft])

  if (status.isPending) return null
  if (!status.data?.available) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-ink-3">
        <Compass className="size-4 shrink-0" aria-hidden />
        The fragrance database isn’t connected, so fill in the details by hand below.
      </p>
    )
  }

  const results = q.trim().length >= 3 ? (search.data?.results ?? []) : []

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="prefill-heading">
      <h2 id="prefill-heading" className="text-2xl">
        Find it in the database
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Search by name or brand to fill in notes, accords, image and performance. You can still change everything
        before saving.
      </p>
      <label className="relative mt-4 block">
        <span className="sr-only">Search the fragrance database</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          className="field-input h-11 pl-9"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Lattafa Khamrah, Dior Sauvage, HMNS Orgasm"
          autoComplete="off"
          autoFocus
        />
      </label>

      <div className="mt-3" aria-live="polite">
        {q.trim().length >= 3 && search.isFetching && !results.length && <Spinner label="Searching" />}
        {search.isError && <p className="text-sm text-danger">{errorMessage(search.error)}</p>}
        {q.trim().length >= 3 && search.isSuccess && !results.length && (
          <p className="text-sm text-ink-3">No matches. Try another spelling, or fill in the form by hand.</p>
        )}
        {results.length > 0 && (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto rounded-md border border-line">
            {results.map((d) => (
              <li key={d.ref} className="flex items-center gap-3 p-2.5">
                <FragranceImage
                  fragrance={{ name: d.name, brand: d.brand, image_url: d.imageUrl, image_path: null }}
                  sizes="thumb"
                  className="size-12 shrink-0 rounded-md border border-line"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                  <p className="truncate text-xs text-ink-3">
                    {d.brand}
                    {discoverMeta(d) && ` · ${discoverMeta(d)}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={picked === d.ref ? 'primary' : 'secondary'}
                  onClick={() => {
                    onPick(d)
                    setDraft('')
                    setQ('')
                  }}
                >
                  {picked === d.ref ? 'Selected' : 'Use this'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
