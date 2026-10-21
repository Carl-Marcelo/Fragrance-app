import { ArrowLeft, CircleAlert, Eye, Lock, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { DatabasePrefill } from '../../components/discover/DatabasePrefill'
import { LookupLinks } from '../../components/fragrance/FragranceBits'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field, Switch } from '../../components/ui/Field'
import { ImagePicker, NumberInput } from '../../components/ui/Inputs'
import { ScaleInput } from '../../components/ui/Scale'
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/States'
import { TagInput } from '../../components/ui/TagInput'
import {
  useEntries,
  useFragrance,
  useMyFragrances,
  useSaveEntry,
  useSaveFragrance,
  useSettings,
  useSignedUrl,
} from '../../hooks/queries'
import { useScrollToHash } from '../../hooks/useScrollToHash'
import {
  CHARACTER_SCALES,
  COMMON_ACCORDS,
  COMMON_NOTES,
  CONCENTRATIONS,
  CURRENCIES,
  FAMILIES,
  INFO_STATUS,
  OCCASION_SUITABILITY,
  PERFORMANCE_SCALES,
  RATINGS_BASIS,
  SCENARIO_ORDER,
  SOURCE_KINDS,
  STATUSES,
  WEATHER_SUITABILITY,
} from '../../lib/constants'
import { blankFragrance, blankItem } from '../../lib/defaults'
import { toFragranceInput } from '../../lib/discover/toFragrance'
import type { DiscoveredFragrance } from '../../lib/discover/types'
import { normalize } from '../../lib/filters'
import { errorMessage, todayIso } from '../../lib/format'
import { SCENARIOS, recommend } from '../../lib/spray'
import type {
  CollectionStatus,
  FragranceInput,
  InfoStatus,
  ItemInput,
  RatingsBasis,
  Scenario,
  SourceKind,
  SprayOverride,
} from '../../lib/types'
import { fieldErrors, fragranceInputSchema, itemInputSchema } from '../../lib/validation'
import { useAuth } from '../../providers/AuthProvider'
import { useToast } from '../../providers/ToastProvider'

type Mode = 'new-entry' | 'edit-entry' | 'new-fragrance' | 'edit-fragrance'

function Section({ title, description, children, id }: { title: string; description?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5 sm:p-6">
      <h2 className="text-2xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

export default function PerfumeFormPage({ mode }: { mode: Mode }) {
  const params = useParams()
  const [search] = useSearchParams()
  const entries = useEntries()
  const isEntry = mode === 'new-entry' || mode === 'edit-entry'
  const editingEntry = mode === 'edit-entry' ? entries.data?.find((e) => e.id === params.id) : undefined
  const fragranceQuery = useFragrance(mode === 'edit-fragrance' ? params.fragranceId : undefined)
  const { user } = useAuth()

  if (mode === 'edit-entry') {
    if (entries.isPending) return <LoadingBlock />
    if (entries.isError) return <ErrorState error={entries.error} onRetry={() => entries.refetch()} />
    if (!editingEntry) return <NotFound />
  }
  if (mode === 'edit-fragrance') {
    if (fragranceQuery.isPending) return <LoadingBlock />
    if (fragranceQuery.isError) return <ErrorState error={fragranceQuery.error} onRetry={() => fragranceQuery.refetch()} />
    if (!fragranceQuery.data || fragranceQuery.data.owner_id !== user?.id) return <NotFound />
  }

  const initialStatus = (search.get('status') as CollectionStatus | null) ?? 'owned'
  const initialFragrance: FragranceInput = editingEntry?.fragrance ?? fragranceQuery.data ?? blankFragrance()
  const initialItem: ItemInput | null = isEntry
    ? editingEntry ?? blankItem(STATUSES.some((s) => s.value === initialStatus) ? initialStatus : 'owned')
    : null

  return (
    <PerfumeForm
      key={editingEntry?.id ?? fragranceQuery.data?.id ?? mode}
      mode={mode}
      initialFragrance={initialFragrance}
      initialItem={initialItem}
    />
  )
}

function NotFound() {
  return (
    <EmptyState
      title="Not found"
      description="This record doesn’t exist or you can’t edit it."
      action={
        <ButtonLink to="/app" variant="secondary">
          Back to the dashboard
        </ButtonLink>
      }
    />
  )
}

function PerfumeForm({
  mode,
  initialFragrance,
  initialItem,
}: {
  mode: Mode
  initialFragrance: FragranceInput
  initialItem: ItemInput | null
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { settings } = useSettings()
  const entries = useEntries()
  const library = useMyFragrances()
  const saveEntry = useSaveEntry()
  const saveFragrance = useSaveFragrance()

  const [f, setF] = useState<FragranceInput>(() => structuredClone(initialFragrance))
  const [item, setItem] = useState<ItemInput | null>(() =>
    initialItem ? { ...structuredClone(initialItem), currency: initialItem.currency || settings.currency } : null,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [uploading, setUploading] = useState<'reference' | 'bottle' | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  useScrollToHash()

  const isEdit = mode === 'edit-entry' || mode === 'edit-fragrance'
  const saving = saveEntry.isPending || saveFragrance.isPending

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const setFrag = <K extends keyof FragranceInput>(key: K, value: FragranceInput[K]) => {
    setF((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }
  const setIt = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) => {
    setItem((prev) => (prev ? { ...prev, [key]: value } : prev))
    setDirty(true)
  }

  // Possible duplicate when creating something new.
  // Fill the fragrance fields from a database result. If it's already in the
  // library, reuse that record so the same fragrance isn't stored twice.
  const applyDiscovered = (d: DiscoveredFragrance) => {
    const existing = library.data?.find((x) => x.external_source === d.source && x.external_id === d.ref)
    setF((prev) => (existing ? { ...existing } : { ...toFragranceInput(d), is_public: prev.is_public }))
    setErrors({})
    setDirty(true)
    toast.success(
      existing ? 'Using the details already in your library' : 'Details filled in from the database',
      'Review them, add your own notes, then save.',
    )
  }

  const duplicate = useMemo(() => {
    if (isEdit || !f.name.trim() || !f.brand.trim()) return null
    const key = `${normalize(f.brand)}|${normalize(f.name)}`
    const entry = entries.data?.find((e) => `${normalize(e.fragrance.brand)}|${normalize(e.fragrance.name)}` === key)
    if (entry) return { label: `${entry.fragrance.name} is already in your journal`, to: `/app/perfume/${entry.id}` }
    const frag = library.data?.find((x) => `${normalize(x.brand)}|${normalize(x.name)}` === key)
    if (frag) return { label: `${frag.name} is already in your fragrance library`, to: `/fragrance/${frag.id}` }
    return null
  }, [isEdit, f.name, f.brand, entries.data, library.data])

  const referencePreview = f.image_url || (f.image_path ? api.publicUrl(f.image_path) : null)
  const bottlePreview = useSignedUrl(item?.bottle_image_path).data ?? null

  const upload = async (kind: 'reference' | 'bottle', file: File) => {
    if (!user) return
    setUploading(kind)
    try {
      const { path } = await api.uploadImage(kind === 'reference' ? 'fragrance-images' : 'bottle-photos', file, user.id)
      if (kind === 'reference') {
        setF((prev) => ({ ...prev, image_path: path, image_url: null }))
      } else {
        setIt('bottle_image_path', path)
      }
      setDirty(true)
      toast.success('Image uploaded', 'Save to keep it.')
    } catch (e) {
      toast.error('Upload failed', errorMessage(e))
    } finally {
      setUploading(null)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const fragResult = fragranceInputSchema.safeParse(f)
    const itemResult = item ? itemInputSchema.safeParse(item) : null
    const errs: Record<string, string> = {}
    if (!fragResult.success) Object.assign(errs, fieldErrors(fragResult.error))
    if (itemResult && !itemResult.success) {
      for (const [k, v] of Object.entries(fieldErrors(itemResult.error))) errs[`item.${k}`] = v
    }
    // Friendlier text for non-numeric input.
    for (const k of Object.keys(errs)) if (/expected number, received NaN/i.test(errs[k])) errs[k] = 'Enter a number'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Please check the highlighted fields')
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }

    try {
      const fragranceInput = { ...fragResult.data!, id: f.id } as FragranceInput
      if (item && itemResult?.success) {
        const saved = await saveEntry.mutateAsync({
          fragrance: fragranceInput,
          item: { ...(itemResult.data as ItemInput), id: item.id },
        })
        setDirty(false)
        toast.success(isEdit ? 'Changes saved' : `${saved.fragrance.name} added`)
        navigate(`/app/perfume/${saved.id}`)
      } else {
        const saved = await saveFragrance.mutateAsync(fragranceInput)
        setDirty(false)
        toast.success(isEdit ? 'Changes saved' : `${saved.name} added to your library`)
        navigate('/app/library')
      }
    } catch (err) {
      toast.error('Couldn’t save', errorMessage(err))
    }
  }

  const title =
    mode === 'new-entry'
      ? 'Add a perfume'
      : mode === 'edit-entry'
        ? `Edit ${initialFragrance.name}`
        : mode === 'new-fragrance'
          ? 'New catalog entry'
          : `Edit ${initialFragrance.name}`

  const backTo = mode === 'edit-entry' && initialItem?.id ? `/app/perfume/${initialItem.id}` : mode.endsWith('fragrance') ? '/app/library' : '/app/collection'

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="pb-28">
      <Link to={backTo} className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Link>
      <header className="mb-8">
        <p className="eyebrow mb-2">{item ? 'Journal entry' : 'Fragrance library'}</p>
        <h1 className="text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          {isEdit
            ? 'Only name and brand are required. Every other field can stay blank and be completed later.'
            : 'Search the database to fill everything in, or enter the details by hand. Only name and brand are required.'}
        </p>
      </header>

      <div className="space-y-6">
        {!isEdit && <DatabasePrefill onPick={applyDiscovered} picked={f.external_id} />}

        <Section title="The fragrance" description="Facts about the perfume itself. Mark how well they’re verified below.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" error={errors.name}>
              <input className="field-input" value={f.name} onChange={(e) => setFrag('name', e.target.value)} />
            </Field>
            <Field label="Brand" error={errors.brand}>
              <input className="field-input" value={f.brand} onChange={(e) => setFrag('brand', e.target.value)} />
            </Field>
          </div>
          {duplicate && (
            <Notice tone="warning" icon={<CircleAlert />}>
              {duplicate.label}.{' '}
              <Link to={duplicate.to} className="link">
                Open it
              </Link>{' '}
              or continue to add another record.
            </Notice>
          )}
          <LookupLinks name={f.name} brand={f.brand} />
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Concentration" optional error={errors.concentration}>
              <select
                className="field-input"
                value={f.concentration ?? ''}
                onChange={(e) => setFrag('concentration', (e.target.value || null) as FragranceInput['concentration'])}
              >
                <option value="">Not set</option>
                {CONCENTRATIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Release year" optional error={errors.release_year}>
              <NumberInput
                decimals={false}
                value={f.release_year}
                onChange={(v) => setFrag('release_year', v)}
                placeholder="e.g. 2019"
              />
            </Field>
            <Field label="Family" optional error={errors.family}>
              <input
                className="field-input"
                list="family-options"
                value={f.family ?? ''}
                onChange={(e) => setFrag('family', e.target.value || null)}
                placeholder="e.g. Woody"
              />
            </Field>
            <datalist id="family-options">
              {FAMILIES.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>
          <TagInput label="Perfumers" value={f.perfumers} onChange={(v) => setFrag('perfumers', v)} max={10} placeholder="Type a name and press Enter" />
          <Field label="Description" optional error={errors.description}>
            <textarea
              className="field-input min-h-24"
              value={f.description ?? ''}
              onChange={(e) => setFrag('description', e.target.value || null)}
              placeholder="How it smells, in your words or from an official description"
            />
          </Field>
        </Section>

        <Section title="Notes & accords" description="Press Enter or comma after each one. Suggestions appear as you type.">
          <TagInput label="Top notes" value={f.notes_top} onChange={(v) => setFrag('notes_top', v)} suggestions={COMMON_NOTES} placeholder="e.g. Bergamot" />
          <TagInput label="Heart notes" value={f.notes_middle} onChange={(v) => setFrag('notes_middle', v)} suggestions={COMMON_NOTES} hint="If a brand lists notes without tiers, put them all here." />
          <TagInput label="Base notes" value={f.notes_base} onChange={(v) => setFrag('notes_base', v)} suggestions={COMMON_NOTES} />
          <TagInput label="Main accords" value={f.accords} onChange={(v) => setFrag('accords', v)} suggestions={COMMON_ACCORDS} max={20} hint="Most dominant first." />
        </Section>

        <Section
          title="Character & performance"
          description="Subjective ratings that drive filters, comparisons and the spray guide. They are shown as estimates, never as facts."
        >
          <Field label="These ratings are" className="sm:max-w-xs">
            <select className="field-input" value={f.ratings_basis} onChange={(e) => setFrag('ratings_basis', e.target.value as RatingsBasis)}>
              {(Object.keys(RATINGS_BASIS) as RatingsBasis[]).map((k) => (
                <option key={k} value={k}>
                  {RATINGS_BASIS[k]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {[...CHARACTER_SCALES, ...PERFORMANCE_SCALES].map((s) => (
              <ScaleInput key={s.key} label={s.label} value={f[s.key]} onChange={(v) => setFrag(s.key, v)} low={s.low} high={s.high} />
            ))}
          </div>
        </Section>

        <Section title="Suitability" description="1 = poor fit, 5 = ideal. Ratings of 4 or 5 count as “suitable” in filters.">
          <p className="eyebrow">Weather</p>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {WEATHER_SUITABILITY.map((s) => (
              <ScaleInput key={s.key} label={s.label} value={f[s.key]} onChange={(v) => setFrag(s.key, v)} />
            ))}
          </div>
          <p className="eyebrow pt-2">Occasion</p>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {OCCASION_SUITABILITY.map((s) => (
              <ScaleInput key={s.key} label={s.label} value={f[s.key]} onChange={(v) => setFrag(s.key, v)} />
            ))}
          </div>
        </Section>

        <Section title="Image, sources & visibility">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm font-medium text-ink">Reference image</p>
              {api.supportsUploads && (
                <ImagePicker
                  label="Upload image"
                  previewUrl={referencePreview}
                  busy={uploading === 'reference'}
                  onPick={(file) => upload('reference', file)}
                  onRemove={() => {
                    setF((p) => ({ ...p, image_path: null, image_url: null }))
                    setDirty(true)
                  }}
                />
              )}
              <Field
                label="…or image link"
                optional
                error={errors.image_url}
                hint="Use images you have the right to use, such as your own photo. Links must start with https://"
              >
                <input
                  className="field-input"
                  type="url"
                  value={f.image_url ?? ''}
                  onChange={(e) => setFrag('image_url', e.target.value || null)}
                  placeholder="https://"
                />
              </Field>
              <Field label="Image credit" optional error={errors.image_credit}>
                <input className="field-input" value={f.image_credit ?? ''} onChange={(e) => setFrag('image_credit', e.target.value || null)} placeholder="e.g. Photo by me" />
              </Field>
              {api.supportsUploads && (
                <p className="text-xs text-ink-3">
                  Uploaded reference images are reachable by anyone with the link. Use “My bottle photo” below for
                  private photos.
                </p>
              )}
            </div>
            <div className="space-y-4">
              <Field label="Information status" hint={INFO_STATUS[f.info_status].description}>
                <select className="field-input" value={f.info_status} onChange={(e) => setFrag('info_status', e.target.value as InfoStatus)}>
                  {(Object.keys(INFO_STATUS) as InfoStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {INFO_STATUS[k].label}
                    </option>
                  ))}
                </select>
              </Field>
              <SourceLinksEditor value={f.source_links} onChange={(v) => setFrag('source_links', v)} errors={errors} />
            </div>
          </div>
          <div className="rounded-lg border border-line bg-sunken/50 p-4">
            <Switch
              checked={f.is_public}
              onChange={(v) => setFrag('is_public', v)}
              label={
                <span className="inline-flex items-center gap-1.5">
                  {f.is_public ? <Eye className="size-4" /> : <Lock className="size-4" />} Show in public catalog
                </span>
              }
              description="Publishes only the fragrance profile above (notes, ratings, image, sources). Your rating, notes, prices, bottle and ownership status are never published."
            />
          </div>
        </Section>

        {item && (
          <>
            <Section title="My record" description="Private to your account.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Status">
                  <select className="field-input" value={item.status} onChange={(e) => setIt('status', e.target.value as CollectionStatus)}>
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end pb-2">
                  <Switch checked={item.is_favorite} onChange={(v) => setIt('is_favorite', v)} label="Favourite" />
                </div>
              </div>

              <RatingInput value={item.personal_rating} onChange={(v) => setIt('personal_rating', v)} />

              <Field label="Personal notes" optional error={errors['item.personal_notes']}>
                <textarea
                  className="field-input min-h-28"
                  value={item.personal_notes ?? ''}
                  onChange={(e) => setIt('personal_notes', e.target.value || null)}
                  placeholder="How it wears on you, compliments, what it reminds you of…"
                />
              </Field>

              {item.status === 'wishlist' && (
                <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
                  <Field label="Why I want it" optional error={errors['item.want_reason']}>
                    <textarea
                      className="field-input min-h-20"
                      value={item.want_reason ?? ''}
                      onChange={(e) => setIt('want_reason', e.target.value || null)}
                      placeholder="e.g. A fresh option for office days; loved the sample"
                    />
                  </Field>
                  <Field label="Priority" optional>
                    <select
                      className="field-input"
                      value={item.wishlist_priority ?? ''}
                      onChange={(e) => setIt('wishlist_priority', e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Not set</option>
                      <option value="1">High</option>
                      <option value="2">Medium</option>
                      <option value="3">Low</option>
                    </select>
                  </Field>
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Bottle size (ml)" optional error={errors['item.bottle_size_ml']}>
                  <NumberInput value={item.bottle_size_ml} onChange={(v) => setIt('bottle_size_ml', v)} placeholder="e.g. 100" />
                </Field>
                <Field label={item.status === 'wishlist' ? 'Expected price' : 'Purchase price'} optional error={errors['item.purchase_price']}>
                  <NumberInput value={item.purchase_price} onChange={(v) => setIt('purchase_price', v)} placeholder="e.g. 6500" />
                </Field>
                <Field label="Currency" error={errors['item.currency']}>
                  <select className="field-input" value={item.currency} onChange={(e) => setIt('currency', e.target.value)}>
                    {[...new Set([item.currency, ...CURRENCIES])].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {item.status !== 'wishlist' && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Purchase date" optional error={errors['item.purchase_date']}>
                      <input
                        type="date"
                        className="field-input"
                        value={item.purchase_date ?? ''}
                        max={todayIso()}
                        onChange={(e) => setIt('purchase_date', e.target.value || null)}
                      />
                    </Field>
                    <Field label="Bought from" optional error={errors['item.purchase_from']}>
                      <input
                        className="field-input"
                        value={item.purchase_from ?? ''}
                        onChange={(e) => setIt('purchase_from', e.target.value || null)}
                        placeholder="Store, website or person"
                      />
                    </Field>
                  </div>
                  <RemainingInput value={item.remaining_percent} onChange={(v) => setIt('remaining_percent', v)} />
                  <Switch
                    checked={item.is_decant}
                    onChange={(v) => setIt('is_decant', v)}
                    label="This is a decant or sample"
                    description="A smaller portion transferred from a full bottle."
                  />
                </>
              )}

              {api.supportsUploads && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink">
                    My bottle photo <span className="font-normal text-ink-3">· private</span>
                  </p>
                  <ImagePicker
                    label="Upload photo"
                    previewUrl={bottlePreview}
                    busy={uploading === 'bottle'}
                    onPick={(file) => upload('bottle', file)}
                    onRemove={() => setIt('bottle_image_path', null)}
                  />
                  <p className="text-xs text-ink-3">Stored privately and shown only to you through short-lived links.</p>
                </div>
              )}
            </Section>

            <Section
              id="spray"
              title="Spray preferences"
              description="Override the guide’s suggestion for this bottle. Leave blank to use the calculated range."
            >
              <SprayOverridesEditor
                fragrance={f}
                overrides={item.spray_overrides}
                profile={settings.spray_profile}
                onChange={(v) => setIt('spray_overrides', v)}
              />
            </Section>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/90 backdrop-blur-md lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <p className="hidden text-sm text-ink-3 sm:block">{dirty ? 'Unsaved changes' : 'No changes yet'}</p>
          <div className="flex w-full gap-2 sm:w-auto">
            <ButtonLink to={backTo} variant="secondary" className="flex-1 sm:flex-none">
              Cancel
            </ButtonLink>
            <Button type="submit" loading={saving} icon={<Save />} className="flex-1 sm:flex-none">
              {isEdit ? 'Save changes' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}

function RatingInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor="personal-rating" className="text-sm font-medium text-ink">
          My rating
        </label>
        <span className="flex items-baseline gap-3">
          <output htmlFor="personal-rating" className="font-display text-2xl text-ink tabular-nums">
            {value == null ? <span className="text-base text-ink-3">Not rated</span> : `${value} / 10`}
          </output>
          {value != null && (
            <button type="button" className="text-xs text-ink-3 hover:text-ink" onClick={() => onChange(null)}>
              Clear
            </button>
          )}
        </span>
      </div>
      <input
        id="personal-rating"
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={value ?? 5}
        onChange={(e) => onChange(Number(e.target.value))}
        className={value == null ? 'w-full opacity-40 accent-[var(--accent)]' : 'w-full accent-[var(--accent)]'}
        aria-valuetext={value == null ? 'Not rated' : `${value} out of 10`}
      />
    </div>
  )
}

function RemainingInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor="remaining" className="text-sm font-medium text-ink">
          Remaining in bottle
        </label>
        <output htmlFor="remaining" className="text-sm text-ink tabular-nums">
          {value == null ? 'Not tracked' : `${value}%`}
        </output>
      </div>
      <input
        id="remaining"
        type="range"
        min={0}
        max={100}
        step={5}
        value={value ?? 100}
        onChange={(e) => onChange(Number(e.target.value))}
        className={value == null ? 'w-full opacity-40 accent-[var(--accent)]' : 'w-full accent-[var(--accent)]'}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[100, 75, 50, 25, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
          >
            {n}%
          </button>
        ))}
        {value != null && (
          <button type="button" onClick={() => onChange(null)} className="px-2 text-xs text-ink-3 hover:text-ink">
            Don’t track
          </button>
        )}
      </div>
    </div>
  )
}

function SourceLinksEditor({
  value,
  onChange,
  errors,
}: {
  value: FragranceInput['source_links']
  onChange: (v: FragranceInput['source_links']) => void
  errors: Record<string, string>
}) {
  const update = (i: number, patch: Partial<FragranceInput['source_links'][number]>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">Source links</p>
      {value.length === 0 && (
        <p className="mb-2 text-xs text-ink-3">Prefer the official brand page, then reputable references.</p>
      )}
      <ul className="space-y-3">
        {value.map((s, i) => (
          <li key={i} className="rounded-md border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
              <input
                aria-label={`Source ${i + 1} label`}
                className="field-input"
                value={s.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label, e.g. Brand website"
              />
              <select
                aria-label={`Source ${i + 1} type`}
                className="field-input"
                value={s.kind}
                onChange={(e) => update(i, { kind: e.target.value as SourceKind })}
              >
                {SOURCE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                aria-label={`Source ${i + 1} URL`}
                aria-invalid={errors[`source_links.${i}.url`] ? true : undefined}
                className="field-input"
                type="url"
                value={s.url}
                onChange={(e) => update(i, { url: e.target.value })}
                placeholder="https://"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label={`Remove source ${i + 1}`}
              >
                <Trash2 />
              </Button>
            </div>
            {errors[`source_links.${i}.url`] && (
              <p className="mt-1 text-xs font-medium text-danger">{errors[`source_links.${i}.url`]}</p>
            )}
          </li>
        ))}
      </ul>
      {value.length < 20 && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          icon={<Plus />}
          onClick={() => onChange([...value, { label: '', url: '', kind: value.length ? 'reference' : 'official' }])}
        >
          Add source
        </Button>
      )}
    </div>
  )
}

function SprayOverridesEditor({
  fragrance,
  overrides,
  profile,
  onChange,
}: {
  fragrance: FragranceInput
  overrides: ItemInput['spray_overrides']
  profile: ReturnType<typeof useSettings>['settings']['spray_profile']
  onChange: (v: ItemInput['spray_overrides']) => void
}) {
  const set = (s: Scenario, patch: Partial<SprayOverride>) => {
    const next = { ...overrides, [s]: { ...overrides[s], ...patch } }
    const o = next[s]!
    if (o.min == null && o.max == null && !o.note) delete next[s]
    onChange(next)
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="text-left text-xs text-ink-3">
          <tr>
            <th scope="col" className="pb-2 font-medium">Scenario</th>
            <th scope="col" className="pb-2 font-medium">Suggested</th>
            <th scope="col" className="pb-2 font-medium">Min</th>
            <th scope="col" className="pb-2 font-medium">Max</th>
            <th scope="col" className="pb-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {SCENARIO_ORDER.map((s) => {
            const suggested = recommend(fragrance, s, { profile })
            const o = overrides[s] ?? {}
            return (
              <tr key={s}>
                <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                  {SCENARIOS[s].label}
                </th>
                <td className="py-2 pr-3 text-ink-3 tabular-nums">{suggested.rangeText}</td>
                <td className="w-20 py-2 pr-2">
                  <NumberInput
                    aria-label={`${SCENARIOS[s].label} minimum sprays`}
                    decimals={false}
                    value={o.min ?? null}
                    onChange={(v) => set(s, { min: v })}
                    className="h-9"
                  />
                </td>
                <td className="w-20 py-2 pr-2">
                  <NumberInput
                    aria-label={`${SCENARIOS[s].label} maximum sprays`}
                    decimals={false}
                    value={o.max ?? null}
                    onChange={(v) => set(s, { max: v })}
                    className="h-9"
                  />
                </td>
                <td className="py-2">
                  <input
                    aria-label={`${SCENARIOS[s].label} note`}
                    className="field-input h-9"
                    value={o.note ?? ''}
                    maxLength={300}
                    onChange={(e) => set(s, { note: e.target.value || null })}
                    placeholder="e.g. one on the scarf"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
