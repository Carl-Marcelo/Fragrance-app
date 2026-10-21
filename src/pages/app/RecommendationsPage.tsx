import { Lightbulb, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { FragranceCard, FragranceRow } from '../../components/fragrance/FragranceCard'
import { PageHeader, SectionHeading } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useEntries, usePublicFragrances, useWearLogs } from '../../hooks/queries'
import { SCENARIO_LABELS, SCENARIO_ORDER } from '../../lib/constants'
import { relativeDays } from '../../lib/format'
import { bestForScenario, collectionInsights, recommendFromCatalog, unwornRecently } from '../../lib/similarity'

export default function RecommendationsPage() {
  const entries = useEntries()
  const catalog = usePublicFragrances()
  const logs = useWearLogs()

  const data = useMemo(() => {
    const all = entries.data ?? []
    const owned = all.filter((e) => e.status === 'owned')
    const wishlist = all.filter((e) => e.status === 'wishlist')
    return {
      owned,
      byScenario: SCENARIO_ORDER.map((s) => ({ scenario: s, picks: bestForScenario(owned, s, 3) })),
      fromCatalog: recommendFromCatalog(catalog.data ?? [], all, 6),
      insights: collectionInsights(owned),
      rediscover: logs.data?.length ? unwornRecently(owned, logs.data, 60).slice(0, 6) : [],
      topWishlist: wishlist
        .slice()
        .sort((a, b) => (a.wishlist_priority ?? 9) - (b.wishlist_priority ?? 9))
        .slice(0, 4),
    }
  }, [entries.data, catalog.data, logs.data])

  if (entries.isPending) return <LoadingBlock />
  if (entries.isError) return <ErrorState error={entries.error} onRetry={() => entries.refetch()} />

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Tools"
        title="Recommendations"
        description="Suggestions worked out from what you’ve saved: suitability ratings, character, notes, your scores and your wear log. Nothing is fetched from outside."
      />

      {!data.owned.length ? (
        <EmptyState icon={<Sparkles />} title="Add owned perfumes first" description="Recommendations need at least one bottle in your collection." />
      ) : (
        <>
          <section>
            <SectionHeading title="Best picks by occasion" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.byScenario.map(({ scenario, picks }) => (
                <div key={scenario} className="card p-4">
                  <p className="eyebrow mb-2">{SCENARIO_LABELS[scenario]}</p>
                  <ol className="space-y-0.5">
                    {picks.map(({ entry }) => (
                      <li key={entry.id}>
                        <FragranceRow fragrance={entry.fragrance} item={entry} to={`/app/perfume/${entry.id}`} />
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHeading title="About your collection" />
            {data.insights.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {data.insights.map((i) => (
                  <li key={i.title} className="card flex gap-3 p-4">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    <div>
                      <p className="text-sm font-medium text-ink">{i.title}</p>
                      <p className="mt-0.5 text-sm text-ink-2">{i.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">
                No gaps detected. Insights appear once at least three bottles have suitability and character ratings.
              </p>
            )}
          </section>

          {data.rediscover.length > 0 && (
            <section>
              <SectionHeading title="Rediscover" />
              <p className="-mt-2 mb-4 text-sm text-ink-3">Owned bottles you haven’t logged in the last 60 days.</p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.rediscover.map(({ entry, lastWorn }) => (
                  <li key={entry.id}>
                    <FragranceRow
                      fragrance={entry.fragrance}
                      item={entry}
                      to={`/app/perfume/${entry.id}`}
                      trailing={<span className="text-xs text-ink-3">{lastWorn ? relativeDays(lastWorn) : 'never logged'}</span>}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <SectionHeading title="From the catalog, close to your favourites" />
            {data.fromCatalog.length ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.fromCatalog.map(({ fragrance, score, because }) => (
                  <FragranceCard
                    key={fragrance.id}
                    fragrance={fragrance}
                    to={`/fragrance/${fragrance.id}`}
                    footer={
                      <span className="text-xs text-ink-3">
                        {Math.round(score * 100)}% similar to {because.fragrance.name}
                      </span>
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-3">
                Nothing yet. This needs favourites or bottles rated 8+ and catalog entries you don’t already have.
              </p>
            )}
          </section>

          {data.topWishlist.length > 0 && (
            <section>
              <SectionHeading title="Top of your wishlist" />
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.topWishlist.map((e) => (
                  <li key={e.id}>
                    <FragranceRow
                      fragrance={e.fragrance}
                      item={e}
                      to={`/app/perfume/${e.id}`}
                      trailing={
                        e.wishlist_priority ? (
                          <span className="text-xs text-ink-3">{['', 'High', 'Medium', 'Low'][e.wishlist_priority]} priority</span>
                        ) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
