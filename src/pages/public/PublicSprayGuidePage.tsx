import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { ScaleInput } from '../../components/ui/Scale'
import { SprayGuidePanel } from '../../components/spray/SprayGuidePanel'
import { usePublicFragrances } from '../../hooks/queries'
import { CONCENTRATIONS, SCENARIO_ORDER } from '../../lib/constants'
import { cn } from '../../lib/cn'
import type { SprayInput } from '../../lib/spray'
import type { Concentration, Scenario } from '../../lib/types'

const CHARACTERS = {
  fresh: { label: 'Fresh & airy', hint: 'Citrus, aquatic, green', values: { sweetness: 2, freshness: 5, darkness: 1 } },
  balanced: { label: 'Balanced', hint: 'Aromatic, soft woods, florals', values: { sweetness: 3, freshness: 3, darkness: 3 } },
  sweet: { label: 'Sweet & warm', hint: 'Vanilla, gourmand, amber', values: { sweetness: 5, freshness: 2, darkness: 3 } },
  dark: { label: 'Dark & dense', hint: 'Oud, leather, incense, tobacco', values: { sweetness: 3, freshness: 1, darkness: 5 } },
} as const
type CharacterKey = keyof typeof CHARACTERS

export default function PublicSprayGuidePage() {
  const [params, setParams] = useSearchParams()
  const catalog = usePublicFragrances()

  const scenarioParam = params.get('scenario') as Scenario | null
  const scenario = scenarioParam && SCENARIO_ORDER.includes(scenarioParam) ? scenarioParam : 'hot_day'
  const fragranceId = params.get('f')
  const concentration = (params.get('conc') as Concentration | null) ?? 'edp'
  const projection = Number(params.get('proj')) || 3
  const character = (params.get('char') as CharacterKey | null) ?? 'balanced'

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        Object.entries(patch).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)))
        return next
      },
      { replace: true },
    )

  const picked = fragranceId ? catalog.data?.find((f) => f.id === fragranceId) : undefined
  const input: SprayInput = useMemo(
    () =>
      picked ?? {
        concentration,
        projection,
        longevity: null,
        ...(CHARACTERS[character]?.values ?? CHARACTERS.balanced.values),
      },
    [picked, concentration, projection, character],
  )

  return (
    <div>
      <PageHeader
        eyebrow="Spray guide"
        title="How much to spray in Philippine weather"
        description="Pick a perfume from the catalog or describe yours. The guide adjusts for heat, humidity, rain and air-conditioning, and works without an internet connection once loaded."
      />

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr] lg:gap-10">
        <aside className="space-y-6">
          <div className="card space-y-5 p-5">
            <Field label="From the catalog" hint={catalog.isError ? 'Catalog unavailable. Describe your perfume instead.' : undefined}>
              <select
                className="field-input"
                value={fragranceId ?? ''}
                onChange={(e) => set({ f: e.target.value || null })}
                disabled={!catalog.data?.length}
              >
                <option value="">{catalog.data?.length ? 'Describe my own perfume…' : 'No catalog entries yet'}</option>
                {catalog.data
                  ?.slice()
                  .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.brand} · {f.name}
                    </option>
                  ))}
              </select>
            </Field>

            {picked ? (
              <p className="text-sm text-ink-2">
                Using the saved profile for{' '}
                <Link to={`/fragrance/${picked.id}`} className="link">
                  {picked.name}
                </Link>
                .
              </p>
            ) : (
              <>
                <Field label="Concentration">
                  <select className="field-input" value={concentration} onChange={(e) => set({ conc: e.target.value })}>
                    {CONCENTRATIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <ScaleInput
                  label="How strong does it project?"
                  value={projection}
                  onChange={(v) => set({ proj: v ? String(v) : null })}
                  low="Skin scent"
                  high="Room-filling"
                />
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-ink">Character</legend>
                  <div className="grid gap-1.5">
                    {(Object.keys(CHARACTERS) as CharacterKey[]).map((k) => (
                      <label
                        key={k}
                        className={cn(
                          'flex cursor-pointer items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                          character === k ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="character"
                            value={k}
                            checked={character === k}
                            onChange={() => set({ char: k })}
                            className="accent-[var(--accent)]"
                          />
                          {CHARACTERS[k].label}
                        </span>
                        <span className="text-xs text-ink-3">{CHARACTERS[k].hint}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
          </div>
          <p className="text-xs leading-relaxed text-ink-3">
            New to a perfume? Start at the low end of the range, wait 30 minutes, and ask someone you trust before adding
            more. Your nose gets used to your own scent quickly.
          </p>
        </aside>

        <SprayGuidePanel key={`${picked?.id ?? 'custom'}-${scenario}`} input={input} initialScenario={scenario} />
      </div>
    </div>
  )
}
