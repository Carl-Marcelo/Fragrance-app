import { SlidersHorizontal, SprayCan } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FragranceImage } from '../../components/fragrance/FragranceImage'
import { SprayGuidePanel } from '../../components/spray/SprayGuidePanel'
import { ButtonLink } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { PageHeader, SectionHeading } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useEntries, useSettings } from '../../hooks/queries'
import { SCENARIO_LABELS, SCENARIO_ORDER } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { bestForScenario } from '../../lib/similarity'
import { SCENARIOS, recommend } from '../../lib/spray'
import type { Scenario } from '../../lib/types'

export default function SprayGuidePage() {
  const entries = useEntries()
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const scenarioParam = params.get('scenario') as Scenario | null
  const scenario: Scenario = scenarioParam && SCENARIO_ORDER.includes(scenarioParam) ? scenarioParam : 'hot_day'
  const owned = useMemo(() => (entries.data ?? []).filter((e) => e.status === 'owned'), [entries.data])
  const ranked = useMemo(() => bestForScenario(owned, scenario, 5), [owned, scenario])
  const itemId = params.get('item') ?? ranked[0]?.entry.id
  const current = entries.data?.find((e) => e.id === itemId)

  const set = (patch: Record<string, string>) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      Object.entries(patch).forEach(([k, v]) => n.set(k, v))
      return n
    }, { replace: true })

  if (entries.isPending) return <LoadingBlock />
  if (entries.isError) return <ErrorState error={entries.error} onRetry={() => entries.refetch()} />

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Tools"
        title="Spray guide"
        description="Pick the occasion, choose a bottle, and get a starting spray count tuned for Philippine heat, humidity, rain and air-conditioning."
        actions={
          <ButtonLink to="/app/settings#spray" variant="secondary" icon={<SlidersHorizontal />}>
            Spray preferences
          </ButtonLink>
        }
      />

      {!owned.length ? (
        <EmptyState
          icon={<SprayCan />}
          title="No owned bottles yet"
          description="Add perfumes you own to get personal recommendations. The public spray guide works for any perfume."
          action={
            <ButtonLink to="/spray-guide" variant="secondary">
              Open the public spray guide
            </ButtonLink>
          }
        />
      ) : (
        <>
          <section>
            <SectionHeading title="What should I wear?" />
            <div role="group" aria-label="Occasion" className="mb-4 flex flex-wrap gap-2">
              {SCENARIO_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={s === scenario}
                  onClick={() => set({ scenario: s })}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm transition-colors',
                    s === scenario ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2 hover:border-line-strong',
                  )}
                >
                  {SCENARIO_LABELS[s]}
                </button>
              ))}
            </div>
            <p className="mb-3 text-sm text-ink-3">{SCENARIOS[scenario].description}</p>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ranked.map(({ entry }, i) => {
                const rec = recommend(entry.fragrance, scenario, {
                  profile: settings.spray_profile,
                  override: entry.spray_overrides[scenario],
                })
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => set({ item: entry.id })}
                      aria-pressed={entry.id === itemId}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                        entry.id === itemId ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
                      )}
                    >
                      <span className="w-5 text-center font-display text-lg text-ink-3">{i + 1}</span>
                      <FragranceImage fragrance={entry.fragrance} bottlePhotoPath={entry.bottle_image_path} sizes="thumb" className="size-11 shrink-0 rounded-md border border-line" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{entry.fragrance.name}</span>
                        <span className="block truncate text-xs text-ink-3">{entry.fragrance.brand}</span>
                      </span>
                      <span className="shrink-0 font-display text-lg text-ink">{rec.rangeText}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="mt-3 text-xs text-ink-3">
              Ranked by the suitability, character and rating you’ve saved. Bottles with more details rank more reliably.
            </p>
          </section>

          <section>
            <SectionHeading title="Guide for a bottle" />
            <Field label="Perfume" className="mb-6 max-w-md">
              <select className="field-input" value={itemId ?? ''} onChange={(e) => set({ item: e.target.value })}>
                {owned
                  .slice()
                  .sort((a, b) => a.fragrance.name.localeCompare(b.fragrance.name))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fragrance.name} · {e.fragrance.brand}
                    </option>
                  ))}
              </select>
            </Field>
            {current ? (
              <>
                <p className="mb-4 text-sm text-ink-2">
                  <Link to={`/app/perfume/${current.id}`} className="link">
                    {current.fragrance.name}
                  </Link>
                  {Object.keys(current.spray_overrides).length > 0 && ' · includes your custom counts'}
                </p>
                <SprayGuidePanel
                  key={`${current.id}-${scenario}`}
                  input={current.fragrance}
                  profile={settings.spray_profile}
                  overrides={current.spray_overrides}
                  initialScenario={scenario}
                  onCustomize={() => navigate(`/app/perfume/${current.id}/edit#spray`)}
                />
              </>
            ) : (
              <p className="text-sm text-ink-3">Choose a perfume.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
