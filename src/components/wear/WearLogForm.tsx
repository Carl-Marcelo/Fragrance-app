import { Save } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useSaveWearLog, useSettings } from '../../hooks/queries'
import { SCENARIO_LABELS, SCENARIO_ORDER, WEAR_WEATHER } from '../../lib/constants'
import { errorMessage, todayIso } from '../../lib/format'
import { recommend } from '../../lib/spray'
import type { CollectionEntry, Scenario, WearLog, WearLogInput, WearWeather } from '../../lib/types'
import { fieldErrors, wearLogInputSchema } from '../../lib/validation'
import { useToast } from '../../providers/ToastProvider'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { NumberInput } from '../ui/Inputs'

export function WearLogForm({
  entries,
  initial,
  defaultItemId,
  onDone,
  onCancel,
}: {
  entries: CollectionEntry[]
  initial?: WearLog
  defaultItemId?: string
  onDone: () => void
  onCancel: () => void
}) {
  const save = useSaveWearLog()
  const toast = useToast()
  const { settings } = useSettings()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<WearLogInput>(() =>
    initial
      ? { ...initial }
      : {
          collection_item_id: defaultItemId ?? '',
          worn_on: todayIso(),
          scenario: null,
          weather: null,
          sprays: null,
          longevity_hours: null,
          rating: null,
          compliments: null,
          notes: null,
        },
  )
  const set = <K extends keyof WearLogInput>(k: K, v: WearLogInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const options = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => Number(b.status === 'owned') - Number(a.status === 'owned') || a.fragrance.name.localeCompare(b.fragrance.name)),
    [entries],
  )
  const selected = entries.find((e) => e.id === form.collection_item_id)
  const suggestion =
    selected && form.scenario
      ? recommend(selected.fragrance, form.scenario, {
          profile: settings.spray_profile,
          override: selected.spray_overrides[form.scenario],
        })
      : null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = wearLogInputSchema.safeParse(form)
    if (!result.success) {
      const errs = fieldErrors(result.error)
      for (const k of Object.keys(errs)) if (/NaN/.test(errs[k])) errs[k] = 'Enter a number'
      setErrors(errs)
      return
    }
    setErrors({})
    try {
      await save.mutateAsync({ ...(result.data as WearLogInput), id: initial?.id })
      toast.success(initial ? 'Wear entry updated' : 'Wear logged')
      onDone()
    } catch (err) {
      toast.error('Couldn’t save', errorMessage(err))
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Perfume" error={errors.collection_item_id}>
        <select className="field-input" value={form.collection_item_id} onChange={(e) => set('collection_item_id', e.target.value)}>
          <option value="">Choose…</option>
          {options.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fragrance.name} · {e.fragrance.brand}
              {e.status !== 'owned' ? ` (${e.status === 'wishlist' ? 'sample / wishlist' : 'previously owned'})` : ''}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" error={errors.worn_on}>
          <input type="date" className="field-input" value={form.worn_on} max={todayIso()} onChange={(e) => set('worn_on', e.target.value)} />
        </Field>
        <Field label="Scenario" optional>
          <select className="field-input" value={form.scenario ?? ''} onChange={(e) => set('scenario', (e.target.value || null) as Scenario | null)}>
            <option value="">Not set</option>
            {SCENARIO_ORDER.map((s) => (
              <option key={s} value={s}>
                {SCENARIO_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Weather" optional>
          <select className="field-input" value={form.weather ?? ''} onChange={(e) => set('weather', (e.target.value || null) as WearWeather | null)}>
            <option value="">Not set</option>
            {WEAR_WEATHER.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sprays" optional error={errors.sprays} hint={suggestion ? `Guide suggests ${suggestion.rangeText}` : undefined}>
          <NumberInput decimals={false} value={form.sprays} onChange={(v) => set('sprays', v)} />
        </Field>
        <Field label="Lasted (hours)" optional error={errors.longevity_hours}>
          <NumberInput value={form.longevity_hours} onChange={(v) => set('longevity_hours', v)} />
        </Field>
        <Field label="Compliments" optional error={errors.compliments}>
          <NumberInput decimals={false} value={form.compliments} onChange={(v) => set('compliments', v)} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">
          How did it go? <span className="font-normal text-ink-3">optional</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={form.rating === n}
              onClick={() => set('rating', form.rating === n ? null : n)}
              className={
                form.rating === n
                  ? 'h-9 min-w-9 rounded-md border border-accent bg-accent-soft px-3 text-sm text-ink'
                  : 'h-9 min-w-9 rounded-md border border-line px-3 text-sm text-ink-2 hover:border-line-strong'
              }
            >
              {n}
            </button>
          ))}
          <span className="self-center pl-2 text-xs text-ink-3">1 = regretted it · 5 = perfect choice</span>
        </div>
      </fieldset>
      <Field label="Notes" optional error={errors.notes}>
        <textarea
          className="field-input min-h-20"
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value || null)}
          placeholder="Where you went, how it performed, what people said"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending} icon={<Save />}>
          {initial ? 'Save' : 'Log wear'}
        </Button>
      </div>
    </form>
  )
}
