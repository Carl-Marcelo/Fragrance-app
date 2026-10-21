import { CloudRain, Droplets, Pencil, RotateCcw, Snowflake, Sun } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SCENARIO_ORDER } from '../../lib/constants'
import { cn } from '../../lib/cn'
import {
  DEFAULT_SPRAY_PROFILE,
  ENV_LABELS,
  SCENARIOS,
  recommend,
  type EnvKey,
  type Environment,
  type SprayInput,
} from '../../lib/spray'
import type { Scenario, SprayOverrides, SprayProfile } from '../../lib/types'
import { Badge, type BadgeTone } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Field'

const ENV_ICONS: Record<EnvKey, typeof Sun> = { heat: Sun, humidity: Droplets, rain: CloudRain, aircon: Snowflake }
const ENV_KEYS: EnvKey[] = ['heat', 'humidity', 'rain', 'aircon']

const RISK_TONE: Record<string, BadgeTone> = { low: 'success', medium: 'warning', high: 'danger' }
const FIT_TONE: Record<string, BadgeTone> = { Good: 'success', Fair: 'neutral', 'Use caution': 'warning' }

interface SprayGuidePanelProps {
  input: SprayInput
  profile?: SprayProfile
  overrides?: SprayOverrides
  initialScenario?: Scenario
  onCustomize?: (scenario: Scenario) => void
}

export function SprayGuidePanel({
  input,
  profile = DEFAULT_SPRAY_PROFILE,
  overrides,
  initialScenario = 'hot_day',
  onCustomize,
}: SprayGuidePanelProps) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario)
  const [env, setEnv] = useState<Environment>(SCENARIOS[initialScenario].env)

  const selectScenario = (s: Scenario) => {
    setScenario(s)
    setEnv(SCENARIOS[s].env)
  }

  const envChanged = ENV_KEYS.some((k) => env[k] !== SCENARIOS[scenario].env[k])

  // Summary ranges use each scenario's default conditions.
  const summaries = useMemo(
    () =>
      SCENARIO_ORDER.map((s) => ({
        scenario: s,
        rec: recommend(input, s, { profile, override: overrides?.[s] }),
      })),
    [input, profile, overrides],
  )
  const rec = useMemo(
    () => recommend(input, scenario, { env, profile, override: overrides?.[scenario] }),
    [input, scenario, env, profile, overrides],
  )

  return (
    <div className="space-y-5">
      <div role="group" aria-label="Scenario" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {summaries.map(({ scenario: s, rec: r }) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === scenario}
            onClick={() => selectScenario(s)}
            className={cn(
              'rounded-lg border px-3 py-2.5 text-left transition-colors',
              s === scenario
                ? 'border-accent bg-accent-soft'
                : 'border-line bg-surface hover:border-line-strong',
              s === 'special' && 'col-span-2 sm:col-span-1',
            )}
          >
            <span className="block text-xs text-ink-2">{SCENARIOS[s].label}</span>
            <span className="mt-0.5 block font-display text-lg leading-tight text-ink">{r.rangeText}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-ink-3">Conditions</span>
        {ENV_KEYS.map((k) => {
          const Icon = ENV_ICONS[k]
          return (
            <Chip key={k} selected={env[k]} onClick={() => setEnv((e) => ({ ...e, [k]: !e[k] }))}>
              <Icon aria-hidden /> {ENV_LABELS[k]}
            </Chip>
          )
        })}
        {envChanged && (
          <button
            type="button"
            onClick={() => setEnv(SCENARIOS[scenario].env)}
            className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"
          >
            <RotateCcw className="size-3" aria-hidden /> Reset
          </button>
        )}
      </div>

      <section className="card p-5 sm:p-6" aria-live="polite">
        <div className="flex flex-col gap-5 md:flex-row md:gap-8">
          <div className="md:w-56 md:shrink-0">
            <p className="eyebrow">{SCENARIOS[scenario].label}</p>
            <p className="mt-1 font-display text-5xl leading-none text-ink">{rec.rangeText}</p>
            <p className="mt-2 text-xs text-ink-3">{SCENARIOS[scenario].description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {rec.customized && <Badge tone="accent">Your custom count</Badge>}
              <Badge tone={RISK_TONE[rec.overspray.level]}>Overspray risk: {rec.overspray.label}</Badge>
            </div>
            {rec.userNote && <p className="mt-3 rounded-md bg-sunken p-2.5 text-sm text-ink-2 italic">“{rec.userNote}”</p>}
            {onCustomize && (
              <Button variant="secondary" size="sm" className="mt-4" icon={<Pencil />} onClick={() => onCustomize(scenario)}>
                Customise
              </Button>
            )}
          </div>

          <div className="grid min-w-0 flex-1 gap-5 sm:grid-cols-2">
            <div>
              <h4 className="eyebrow mb-2">Where</h4>
              <ul className="space-y-1 text-sm text-ink">
                {rec.locations.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" aria-hidden />
                    {l}
                  </li>
                ))}
              </ul>
              <h4 className="eyebrow mt-4 mb-1.5">On</h4>
              <p className="text-sm text-ink-2">{rec.surfaceNote}</p>
            </div>
            <div>
              <h4 className="eyebrow mb-2">How</h4>
              <ul className="space-y-1.5 text-sm text-ink-2">
                {rec.technique.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="sm:col-span-2">
              <h4 className="eyebrow mb-1.5">Expected projection</h4>
              <p className="text-sm text-ink">{rec.projection.label}</p>
              <p className="mt-1 text-sm text-ink-2">{rec.overspray.note}</p>
            </div>
            <div className="sm:col-span-2">
              <h4 className="eyebrow mb-1.5">Why</h4>
              <p className="text-sm leading-relaxed text-ink-2">{rec.explanation}</p>
              {rec.adjustments.length > 0 && (
                <details className="mt-2 text-xs text-ink-3">
                  <summary className="cursor-pointer select-none hover:text-ink">How the range was adjusted</summary>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                    {rec.adjustments.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        </div>
      </section>

      <div>
        <h4 className="eyebrow mb-2">How it handles the weather</h4>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rec.environment.map((e) => {
            const Icon = ENV_ICONS[e.key]
            return (
              <li key={e.key} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                    <Icon className="size-4 text-ink-3" aria-hidden /> {e.label}
                  </span>
                  <Badge tone={FIT_TONE[e.verdict]}>{e.verdict}</Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{e.note}</p>
                <p className="mt-1 text-[0.6875rem] text-ink-3">
                  {e.source === 'saved' ? 'From saved rating' : 'Estimated from the scent profile'}
                </p>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-xs text-ink-3">
        Spray counts are practical starting points, not exact measurements. Skin type, clothing and atomiser output all
        vary, so adjust to what you notice.
      </p>
    </div>
  )
}
