import { ArrowRight, Briefcase, Droplets, Moon, PartyPopper, Plus, Sun, Upload } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FragranceRow } from '../../components/fragrance/FragranceCard'
import { ButtonLink } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { BottleLevel } from '../../components/ui/Scale'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useEntries, useSettings, useWearLogs } from '../../hooks/queries'
import { SCENARIO_LABELS } from '../../lib/constants'
import { formatMoney, formatRating, relativeDays, todayIso, totalsByCurrency } from '../../lib/format'
import { bestForScenario } from '../../lib/similarity'
import type { Scenario } from '../../lib/types'

const SCENARIO_ICONS: Record<Scenario, typeof Sun> = {
  hot_day: Sun,
  normal_day: Droplets,
  office: Briefcase,
  night_date: Moon,
  special: PartyPopper,
}

function Stat({ label, value, detail, to }: { label: string; value: ReactNode; detail?: ReactNode; to?: string }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-4xl leading-none text-ink tabular-nums">{value}</p>
      {detail && <p className="mt-2 text-xs text-ink-3">{detail}</p>}
    </>
  )
  return to ? (
    <Link to={to} className="card block p-5 transition-colors hover:border-line-strong">
      {body}
    </Link>
  ) : (
    <div className="card p-5">{body}</div>
  )
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xl">{title}</h2>
        {action && <div className="text-sm">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  const entries = useEntries()
  const wearLogs = useWearLogs()
  const { settings } = useSettings()

  const data = useMemo(() => {
    const all = entries.data ?? []
    const owned = all.filter((e) => e.status === 'owned')
    const wishlist = all.filter((e) => e.status === 'wishlist')
    const favorites = all.filter((e) => e.is_favorite)
    const low = owned
      .filter((e) => e.remaining_percent != null && e.remaining_percent <= settings.low_bottle_threshold)
      .sort((a, b) => (a.remaining_percent ?? 0) - (b.remaining_percent ?? 0))
    const topRated = owned
      .filter((e) => e.personal_rating != null)
      .sort((a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0))
      .slice(0, 5)
    const recent = all.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)
    const totals = totalsByCurrency(owned)
    const priced = owned.filter((e) => e.purchase_price != null).length
    return { all, owned, wishlist, favorites, low, topRated, recent, totals, priced }
  }, [entries.data, settings.low_bottle_threshold])

  const wear = useMemo(() => {
    const logs = wearLogs.data ?? []
    const monthPrefix = todayIso().slice(0, 7)
    const thisMonth = logs.filter((l) => l.worn_on.startsWith(monthPrefix)).length
    const counts = new Map<string, number>()
    logs.forEach((l) => counts.set(l.collection_item_id, (counts.get(l.collection_item_id) ?? 0) + 1))
    const mostWorn = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, n]) => ({ entry: data.all.find((e) => e.id === id), n }))
      .filter((x) => x.entry)
    return { total: logs.length, thisMonth, mostWorn, last: logs[0] }
  }, [wearLogs.data, data.all])

  const picks = useMemo(
    () =>
      (['hot_day', 'office', 'night_date'] as Scenario[])
        .map((s) => ({ scenario: s, best: bestForScenario(data.owned, s, 1)[0] }))
        .filter((p) => p.best),
    [data.owned],
  )

  if (entries.isPending) return <LoadingBlock label="Loading your journal" />
  if (entries.isError) return <ErrorState error={entries.error} onRetry={() => entries.refetch()} />

  if (!data.all.length) {
    return (
      <div>
        <PageHeader eyebrow={greeting()} title="Welcome to your journal" />
        <EmptyState
          icon={<Plus />}
          title="Start with your first bottle"
          description="Add a perfume you own or one you’re eyeing. Everything you add stays private to your account."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/app/perfume/new" icon={<Plus />}>
                Add a perfume
              </ButtonLink>
              <ButtonLink to="/app/settings#data" variant="secondary" icon={<Upload />}>
                Restore a backup
              </ButtonLink>
            </div>
          }
        />
      </div>
    )
  }

  const [primary, ...others] = data.totals

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={greeting()}
        title="Your fragrance journal"
        actions={
          <ButtonLink to="/app/perfume/new" icon={<Plus />}>
            Add perfume
          </ButtonLink>
        }
        className="mb-0"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Owned" value={data.owned.length} to="/app/collection" detail={`${data.favorites.length} favourites`} />
        <Stat label="Wishlist" value={data.wishlist.length} to="/app/wishlist" />
        <Stat
          label="Recorded value"
          value={primary ? formatMoney(primary.total, primary.currency) : '—'}
          detail={
            primary
              ? `From ${data.priced} of ${data.owned.length} owned bottles with a price${others.length ? ` · plus ${others.map((o) => formatMoney(o.total, o.currency)).join(', ')}` : ''}`
              : 'Add purchase prices to see a total'
          }
        />
        <Stat
          label="Running low"
          value={data.low.length}
          detail={`At or below ${settings.low_bottle_threshold}% remaining`}
        />
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-xl">Spray guide</h2>
          <Link to="/app/spray-guide" className="link text-sm">
            Open
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(SCENARIO_ICONS) as Scenario[]).map((s) => {
            const Icon = SCENARIO_ICONS[s]
            return (
              <Link
                key={s}
                to={`/app/spray-guide?scenario=${s}`}
                className="flex items-center gap-2 rounded-md border border-line px-3 py-2.5 text-sm text-ink-2 transition-colors last:col-span-2 hover:border-line-strong hover:text-ink sm:last:col-span-1"
              >
                <Icon className="size-4 text-accent" aria-hidden />
                {SCENARIO_LABELS[s]}
              </Link>
            )
          })}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Low-bottle alerts" action={<Link to="/app/settings" className="link">Threshold</Link>}>
          {data.low.length ? (
            <ul className="space-y-1">
              {data.low.map((e) => (
                <li key={e.id}>
                  <FragranceRow
                    fragrance={e.fragrance}
                    item={e}
                    to={`/app/perfume/${e.id}`}
                    trailing={<BottleLevel percent={e.remaining_percent} low className="w-28" />}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">
              Nothing below {settings.low_bottle_threshold}%.{' '}
              {data.owned.some((e) => e.remaining_percent == null) && 'Some bottles have no level recorded.'}
            </p>
          )}
        </Panel>

        <Panel title="Reach for today" action={<Link to="/app/recommendations" className="link">More</Link>}>
          {picks.length ? (
            <ul className="space-y-1">
              {picks.map(({ scenario, best }) => (
                <li key={scenario}>
                  <FragranceRow
                    fragrance={best!.entry.fragrance}
                    item={best!.entry}
                    to={`/app/perfume/${best!.entry.id}`}
                    trailing={<span className="text-xs text-ink-3">{SCENARIO_LABELS[scenario]}</span>}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Add owned perfumes to get suggestions.</p>
          )}
          <p className="mt-3 text-xs text-ink-3">Based on the suitability and character you’ve saved.</p>
        </Panel>

        <Panel title="Highest rated">
          {data.topRated.length ? (
            <ol className="space-y-1">
              {data.topRated.map((e) => (
                <li key={e.id}>
                  <FragranceRow
                    fragrance={e.fragrance}
                    item={e}
                    to={`/app/perfume/${e.id}`}
                    trailing={<span className="font-medium text-ink">{formatRating(e.personal_rating)}</span>}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-3">Rate your owned perfumes to see your top picks here.</p>
          )}
        </Panel>

        <Panel title="Recently added">
          <ul className="space-y-1">
            {data.recent.map((e) => (
              <li key={e.id}>
                <FragranceRow
                  fragrance={e.fragrance}
                  item={e}
                  to={`/app/perfume/${e.id}`}
                  trailing={<span className="text-xs text-ink-3">{relativeDays(e.created_at)}</span>}
                />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Favourites" action={<Link to="/app/favorites" className="link">All</Link>}>
          {data.favorites.length ? (
            <ul className="space-y-1">
              {data.favorites.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <FragranceRow fragrance={e.fragrance} item={e} to={`/app/perfume/${e.id}`} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Tap the heart on any perfume to mark it as a favourite.</p>
          )}
        </Panel>

        <Panel title="Wear log" action={<Link to="/app/wear-log" className="link">Open</Link>}>
          {wearLogs.isError ? (
            <p className="text-sm text-danger">Couldn’t load the wear log.</p>
          ) : wear.total ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-2">
                <span className="font-medium text-ink">{wear.thisMonth}</span> wear{wear.thisMonth === 1 ? '' : 's'} logged
                this month · {wear.total} in total
              </p>
              {wear.mostWorn.length > 0 && (
                <ul className="space-y-1">
                  {wear.mostWorn.map(({ entry, n }) => (
                    <li key={entry!.id}>
                      <FragranceRow
                        fragrance={entry!.fragrance}
                        item={entry}
                        to={`/app/perfume/${entry!.id}`}
                        trailing={<span className="text-xs text-ink-3">{n}×</span>}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-3">
              Log what you wear to see your most-worn bottles.{' '}
              <Link to="/app/wear-log" className="link">
                Log a wear <ArrowRight className="inline size-3" />
              </Link>
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}
