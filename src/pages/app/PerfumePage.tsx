import { ArrowLeft, Columns3, Eye, Heart, Lock, NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FragranceMeta, InfoStatusBadge } from '../../components/fragrance/FragranceBits'
import { FragranceRow } from '../../components/fragrance/FragranceCard'
import { FragranceImage } from '../../components/fragrance/FragranceImage'
import { FragranceProfile, ProfileSection } from '../../components/fragrance/FragranceProfile'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { BottleLevel } from '../../components/ui/Scale'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { WearLogForm } from '../../components/wear/WearLogForm'
import {
  useDeleteEntry,
  useEntries,
  useEntry,
  useSettings,
  useUpdateFragrance,
  useUpdateItem,
  useWearLogs,
} from '../../hooks/queries'
import { SCENARIO_LABELS, STATUSES, statusLabel } from '../../lib/constants'
import {
  errorMessage,
  formatDate,
  formatMoney,
  formatRating,
  pricePerMl,
  relativeDays,
  remainingMl,
} from '../../lib/format'
import { mostSimilar } from '../../lib/similarity'
import type { CollectionStatus } from '../../lib/types'
import { useConfirm } from '../../providers/ConfirmProvider'
import { useToast } from '../../providers/ToastProvider'

const BACK: Record<CollectionStatus, { to: string; label: string }> = {
  owned: { to: '/app/collection', label: 'My Collection' },
  wishlist: { to: '/app/wishlist', label: 'Wishlist' },
  previously_owned: { to: '/app/previously-owned', label: 'Previously owned' },
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  )
}

export default function PerfumePage() {
  const { id } = useParams()
  const entry = useEntry(id)
  const all = useEntries()
  const wearLogs = useWearLogs()
  const { settings } = useSettings()
  const updateItem = useUpdateItem()
  const updateFragrance = useUpdateFragrance()
  const del = useDeleteEntry()
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()
  const [logOpen, setLogOpen] = useState(false)
  const [levelDraft, setLevelDraft] = useState<number | null>(null)

  const e = entry.data
  const logs = useMemo(() => (wearLogs.data ?? []).filter((l) => l.collection_item_id === id), [wearLogs.data, id])
  const similarOwned = useMemo(
    () => (e ? mostSimilar(e.fragrance, (all.data ?? []).filter((x) => x.status === 'owned' && x.id !== e.id), 3, 0.2) : []),
    [e, all.data],
  )

  if (entry.isPending) return <LoadingBlock />
  if (entry.isError) return <ErrorState error={entry.error} onRetry={() => entry.refetch()} />
  if (!e) {
    return (
      <EmptyState
        title="Perfume not found"
        description="It may have been deleted."
        action={
          <ButtonLink to="/app/collection" variant="secondary">
            Back to collection
          </ButtonLink>
        }
      />
    )
  }

  const f = e.fragrance
  const low = e.status === 'owned' && e.remaining_percent != null && e.remaining_percent <= settings.low_bottle_threshold
  const perMl = pricePerMl(e.purchase_price, e.bottle_size_ml)
  const back = BACK[e.status]

  const patch = (p: Parameters<typeof updateItem.mutate>[0]['patch'], success?: string) =>
    updateItem.mutate(
      { id: e.id, patch: p },
      {
        onSuccess: () => success && toast.success(success),
        onError: (err) => toast.error('Couldn’t update', errorMessage(err)),
      },
    )

  const changeStatus = async (status: CollectionStatus) => {
    if (status === e.status) return
    const extra = status === 'owned' && e.remaining_percent == null ? { remaining_percent: 100 } : {}
    patch({ status, ...extra }, `Moved to ${statusLabel(status).toLowerCase()}`)
  }

  const togglePublic = async () => {
    const next = !f.is_public
    if (next) {
      const ok = await confirm({
        title: 'Publish this fragrance profile?',
        description:
          'Notes, accords, character ratings, suitability, image and sources become visible to anyone. Your rating, notes, prices, bottle details and ownership status stay private.',
        confirmLabel: 'Publish',
      })
      if (!ok) return
    }
    updateFragrance.mutate(
      { id: f.id, patch: { is_public: next } },
      {
        onSuccess: () => toast.success(next ? 'Published to the catalog' : 'Removed from the public catalog'),
        onError: (err) => toast.error('Couldn’t change visibility', errorMessage(err)),
      },
    )
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${f.name}?`,
      description: (
        <>
          This removes your record, rating, notes, purchase details and {logs.length} wear log entr
          {logs.length === 1 ? 'y' : 'ies'}.{' '}
          {f.is_public
            ? 'The public catalog profile stays published.'
            : 'The fragrance details are deleted too, unless another record uses them.'}{' '}
          Consider “Previously owned” if you just finished the bottle.
        </>
      ),
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(e)
      toast.success(`${f.name} deleted`)
      navigate(back.to, { replace: true })
    } catch (err) {
      toast.error('Couldn’t delete', errorMessage(err))
    }
  }

  const level = levelDraft ?? e.remaining_percent

  return (
    <article className="space-y-10">
      <Link to={back.to} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {back.label}
      </Link>

      <header className="grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-10">
        <FragranceImage fragrance={f} bottlePhotoPath={e.bottle_image_path} sizes="hero" className="card aspect-[4/5]" />
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{statusLabel(e.status)}</Badge>
            {e.is_decant && <Badge>Decant</Badge>}
            {low && <Badge tone="warning">Running low</Badge>}
            <InfoStatusBadge status={f.info_status} />
            {f.external_source === 'fragella' && <Badge tone="info">From the Fragella database</Badge>}
            {f.is_public ? (
              <Badge tone="info">
                <Eye /> In public catalog
              </Badge>
            ) : (
              <Badge>
                <Lock /> Private
              </Badge>
            )}
          </div>
          <p className="eyebrow mt-4">{f.brand}</p>
          <h1 className="mt-1 text-5xl leading-[1.05]">{f.name}</h1>
          <FragranceMeta fragrance={f} className="mt-2 text-sm" />

          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink to={`/app/perfume/${e.id}/edit`} icon={<Pencil />}>
              Edit
            </ButtonLink>
            <Button
              variant="secondary"
              onClick={() => patch({ is_favorite: !e.is_favorite })}
              aria-pressed={e.is_favorite}
              icon={<Heart className={e.is_favorite ? 'fill-danger text-danger' : undefined} />}
            >
              {e.is_favorite ? 'Favourite' : 'Add to favourites'}
            </Button>
            <Button variant="secondary" onClick={() => setLogOpen(true)} icon={<NotebookPen />}>
              Log a wear
            </Button>
            <ButtonLink to={`/app/compare?ids=${e.id}`} variant="ghost" icon={<Columns3 />}>
              Compare
            </ButtonLink>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-3">
            <Detail label="My rating">
              <span className="font-display text-2xl">{formatRating(e.personal_rating)}</span>
            </Detail>
            <Detail label={e.status === 'wishlist' ? 'Expected price' : 'Price paid'}>
              {formatMoney(e.purchase_price, e.currency)}
              {perMl != null && <span className="block text-xs text-ink-3">{formatMoney(perMl, e.currency)} per ml</span>}
            </Detail>
            <Detail label="Bottle">
              {e.bottle_size_ml ? `${e.bottle_size_ml} ml` : '—'}
              {e.status === 'owned' && remainingMl(e.bottle_size_ml, e.remaining_percent) != null && (
                <span className="block text-xs text-ink-3">≈ {remainingMl(e.bottle_size_ml, e.remaining_percent)} ml left</span>
              )}
            </Detail>
            {e.status !== 'wishlist' && <Detail label="Purchased">{formatDate(e.purchase_date)}</Detail>}
            {e.purchase_from && <Detail label="From">{e.purchase_from}</Detail>}
            <Detail label="Added">{formatDate(e.created_at)}</Detail>
            {e.status === 'wishlist' && e.wishlist_priority && (
              <Detail label="Priority">{['', 'High', 'Medium', 'Low'][e.wishlist_priority]}</Detail>
            )}
          </dl>

          {e.status === 'owned' && (
            <div className="mt-6 rounded-lg border border-line p-4">
              <div className="flex items-baseline justify-between">
                <label htmlFor="level" className="text-sm font-medium text-ink">
                  Bottle level
                </label>
                {levelDraft != null && levelDraft !== e.remaining_percent && (
                  <span className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setLevelDraft(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        patch({ remaining_percent: levelDraft }, 'Bottle level updated')
                        setLevelDraft(null)
                      }}
                    >
                      Save {levelDraft}%
                    </Button>
                  </span>
                )}
              </div>
              {level != null ? (
                <>
                  <BottleLevel percent={level} low={level <= settings.low_bottle_threshold} className="mt-3" />
                  <input
                    id="level"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={level}
                    onChange={(ev) => setLevelDraft(Number(ev.target.value))}
                    className="mt-2 w-full accent-[var(--accent)]"
                    aria-label="Adjust bottle level"
                  />
                </>
              ) : (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => setLevelDraft(100)}>
                  Start tracking level
                </Button>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-3">Move to</span>
            {STATUSES.filter((s) => s.value !== e.status).map((s) => (
              <Button key={s.value} size="sm" variant="secondary" onClick={() => changeStatus(s.value)} disabled={updateItem.isPending}>
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {(e.personal_notes || e.want_reason) && (
        <ProfileSection title="My notes">
          <div className="grid gap-6 md:grid-cols-2">
            {e.want_reason && (
              <div>
                <p className="eyebrow mb-2">Why I want it</p>
                <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink">{e.want_reason}</p>
              </div>
            )}
            {e.personal_notes && (
              <div>
                <p className="eyebrow mb-2">Personal notes</p>
                <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink">{e.personal_notes}</p>
              </div>
            )}
          </div>
        </ProfileSection>
      )}

      <FragranceProfile
        fragrance={f}
        sprayProfile={settings.spray_profile}
        sprayOverrides={e.spray_overrides}
        onCustomizeSpray={() => navigate(`/app/perfume/${e.id}/edit#spray`)}
        showLookup
        sprayFirst
      />

      <ProfileSection
        title="Wear history"
        aside={
          <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)} icon={<NotebookPen />}>
            Log a wear
          </Button>
        }
      >
        {logs.length ? (
          <ul className="divide-y divide-line">
            {logs.slice(0, 8).map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-sm">
                <span className="w-28 shrink-0 text-ink">{formatDate(l.worn_on)}</span>
                <span className="text-ink-2">
                  {[
                    l.scenario && SCENARIO_LABELS[l.scenario],
                    l.sprays != null && `${l.sprays} spray${l.sprays === 1 ? '' : 's'}`,
                    l.longevity_hours != null && `${l.longevity_hours} h`,
                    l.rating != null && `${l.rating}/5`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No details'}
                </span>
                {l.notes && <span className="w-full text-ink-3 sm:w-auto">{l.notes}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">Not logged yet.</p>
        )}
        {logs.length > 0 && (
          <p className="mt-3 text-xs text-ink-3">
            Last worn {relativeDays(logs[0].worn_on)} · {logs.length} wear{logs.length === 1 ? '' : 's'} logged ·{' '}
            <Link to="/app/wear-log" className="link">
              Full log
            </Link>
          </p>
        )}
      </ProfileSection>

      {similarOwned.length > 0 && (
        <ProfileSection title="Similar in your collection">
          <ul className="grid gap-2 sm:grid-cols-3">
            {similarOwned.map(({ target, score }) => (
              <li key={target.id}>
                <FragranceRow
                  fragrance={target.fragrance}
                  item={target}
                  to={`/app/perfume/${target.id}`}
                  trailing={<span className="text-xs text-ink-3">{Math.round(score * 100)}%</span>}
                />
              </li>
            ))}
          </ul>
        </ProfileSection>
      )}

      <ProfileSection title="Manage">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={togglePublic} loading={updateFragrance.isPending} icon={f.is_public ? <Lock /> : <Eye />}>
            {f.is_public ? 'Remove from public catalog' : 'Publish profile to catalog'}
          </Button>
          {f.is_public && (
            <ButtonLink to={`/fragrance/${f.id}`} variant="ghost">
              View public page
            </ButtonLink>
          )}
          <Button variant="danger" onClick={remove} loading={del.isPending} icon={<Trash2 />}>
            Delete
          </Button>
        </div>
      </ProfileSection>

      <Dialog open={logOpen} onClose={() => setLogOpen(false)} title="Log a wear">
        <WearLogForm
          entries={all.data ?? [e]}
          defaultItemId={e.id}
          onDone={() => setLogOpen(false)}
          onCancel={() => setLogOpen(false)}
        />
      </Dialog>
    </article>
  )
}
