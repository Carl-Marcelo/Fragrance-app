import { ArrowLeft, Info, SearchX, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AddToJournal, DiscoverCard, discoverMeta, useDiscoverBase } from '../../components/discover/DiscoverBits'
import { AccordList } from '../../components/fragrance/FragranceBits'
import { FragranceImage } from '../../components/fragrance/FragranceImage'
import { FragranceProfile, ProfileSection } from '../../components/fragrance/FragranceProfile'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { CardSkeletons, EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/States'
import { useDiscoverSimilar, useDiscoveredFragrance } from '../../hooks/discover'
import { useSettings } from '../../hooks/queries'
import { previewFragrance } from '../../lib/discover/toFragrance'
import { useIsOwner } from '../../providers/AuthProvider'

export default function DiscoverFragrancePage() {
  const { ref } = useParams()
  const [params] = useSearchParams()
  const base = useDiscoverBase()
  const owner = useIsOwner()
  const { settings } = useSettings()
  const found = useDiscoveredFragrance(ref, params.get('q'))
  const d = found.data
  const preview = useMemo(() => (d ? previewFragrance(d) : null), [d])
  const [showSimilar, setShowSimilar] = useState(false)
  const similar = useDiscoverSimilar(showSimilar && d ? `${d.brand} ${d.name}` : null)

  if (found.isPending) return <LoadingBlock label="Loading fragrance" />
  if (found.isError) return <ErrorState error={found.error} onRetry={() => found.refetch()} />
  if (!d || !preview) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="Fragrance not found"
        description="This link may be out of date. Try searching for it instead."
        action={
          <ButtonLink to={base} variant="secondary">
            Back to Discover
          </ButtonLink>
        }
      />
    )
  }

  const similarResults = similar.data?.results.filter((r) => r.ref !== d.ref) ?? []

  return (
    <article className="space-y-12">
      <Link to={base} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Discover
      </Link>

      <header className="grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-12">
        <FragranceImage fragrance={preview} sizes="hero" className="card aspect-[4/5]" />
        <div className="flex flex-col justify-center">
          <p className="eyebrow">{d.brand}</p>
          <h1 className="mt-2 text-5xl leading-[1.05]">{d.name}</h1>
          {discoverMeta(d) && <p className="mt-3 text-sm text-ink-3">{discoverMeta(d)}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {d.country && <Badge>{d.country}</Badge>}
            {d.rating != null && <Badge tone="accent">Community rating {d.rating}</Badge>}
            <Badge tone="info">From the Fragella database</Badge>
          </div>
          {d.accords.length > 0 && (
            <div className="mt-6">
              <AccordList accords={d.accords.map((a) => a.name)} limit={8} />
            </div>
          )}
          {owner ? (
            <div className="mt-8">
              <AddToJournal d={d} />
            </div>
          ) : (
            <p className="mt-8 text-sm text-ink-3">
              <Link to="/spray-guide" className="link">
                Spray guide
              </Link>{' '}
              tips for this fragrance are below.
            </p>
          )}
        </div>
      </header>

      <Notice icon={<Info />}>
        Notes, accords, year and concentration come from the database and are marked unverified until checked against
        the brand. Character scales are worked out from the main accords; performance, season and occasion ratings come
        from community votes.
      </Notice>

      <FragranceProfile
        fragrance={preview}
        sprayProfile={owner ? settings.spray_profile : undefined}
        showLookup
      />

      <ProfileSection title="Similar fragrances">
        {!showSimilar ? (
          <Button variant="secondary" icon={<Sparkles />} onClick={() => setShowSimilar(true)}>
            Show similar fragrances
          </Button>
        ) : similar.isError ? (
          <ErrorState error={similar.error} onRetry={() => similar.refetch()} />
        ) : similar.isPending ? (
          <CardSkeletons count={3} />
        ) : similarResults.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {similarResults.map((s) => (
              <DiscoverCard key={s.ref} d={s} base={base} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-3">No similar fragrances found.</p>
        )}
      </ProfileSection>

      <p className="border-t border-line pt-6 text-xs text-ink-3">
        Data and image from{' '}
        <a href="https://fragella.com" target="_blank" rel="noopener noreferrer" className="link">
          Fragella
        </a>
        .
      </p>
    </article>
  )
}
