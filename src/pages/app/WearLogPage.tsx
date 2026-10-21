import { NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FragranceImage } from '../../components/fragrance/FragranceImage'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { WearLogForm } from '../../components/wear/WearLogForm'
import { useDeleteWearLog, useEntries, useWearLogs } from '../../hooks/queries'
import { SCENARIO_LABELS, WEAR_WEATHER } from '../../lib/constants'
import { errorMessage, formatDate, todayIso } from '../../lib/format'
import { unwornRecently } from '../../lib/similarity'
import type { WearLog } from '../../lib/types'
import { useConfirm } from '../../providers/ConfirmProvider'
import { useToast } from '../../providers/ToastProvider'

export default function WearLogPage() {
  const logs = useWearLogs()
  const entries = useEntries()
  const del = useDeleteWearLog()
  const confirm = useConfirm()
  const toast = useToast()
  const [editing, setEditing] = useState<WearLog | 'new' | null>(null)

  const byId = useMemo(() => new Map((entries.data ?? []).map((e) => [e.id, e])), [entries.data])

  const summary = useMemo(() => {
    const list = logs.data ?? []
    const month = todayIso().slice(0, 7)
    const thisMonth = list.filter((l) => l.worn_on.startsWith(month))
    const rated = list.filter((l) => l.longevity_hours != null)
    const avgLongevity = rated.length ? rated.reduce((s, l) => s + (l.longevity_hours ?? 0), 0) / rated.length : null
    const compliments = list.reduce((s, l) => s + (l.compliments ?? 0), 0)
    const unworn = unwornRecently(entries.data ?? [], list, 45)
    return { total: list.length, thisMonth: thisMonth.length, avgLongevity, compliments, unworn }
  }, [logs.data, entries.data])

  const grouped = useMemo(() => {
    const groups = new Map<string, WearLog[]>()
    for (const l of logs.data ?? []) {
      const key = l.worn_on.slice(0, 7)
      groups.set(key, [...(groups.get(key) ?? []), l])
    }
    return [...groups.entries()]
  }, [logs.data])

  const remove = async (l: WearLog) => {
    const ok = await confirm({ title: 'Delete this entry?', confirmLabel: 'Delete', tone: 'danger' })
    if (!ok) return
    del.mutate(l.id, {
      onSuccess: () => toast.success('Entry deleted'),
      onError: (err) => toast.error('Couldn’t delete', errorMessage(err)),
    })
  }

  if (logs.isPending || entries.isPending) return <LoadingBlock />
  if (logs.isError) return <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
  if (entries.isError) return <ErrorState error={entries.error} onRetry={() => entries.refetch()} />

  return (
    <div>
      <PageHeader
        eyebrow="Tools"
        title="Wear log"
        description="What you wore, how many sprays, and how it held up."
        actions={
          <Button icon={<Plus />} onClick={() => setEditing('new')} disabled={!entries.data?.length}>
            Log a wear
          </Button>
        }
      />

      {!entries.data?.length ? (
        <EmptyState icon={<NotebookPen />} title="Add a perfume first" description="Wear entries are linked to perfumes in your journal." />
      ) : (
        <div className="space-y-8">
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ['This month', summary.thisMonth],
              ['All time', summary.total],
              ['Average longevity', summary.avgLongevity != null ? `${summary.avgLongevity.toFixed(1)} h` : '—'],
              ['Compliments', summary.compliments],
            ].map(([label, value]) => (
              <div key={label} className="card p-4">
                <dt className="eyebrow">{label}</dt>
                <dd className="mt-1.5 font-display text-3xl text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {summary.unworn.length > 0 && summary.total > 0 && (
            <section className="card p-5">
              <h2 className="text-xl">Not worn in the last 45 days</h2>
              <p className="mt-1 text-sm text-ink-3">Based on your log. Bottles you never logged are included.</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {summary.unworn.slice(0, 12).map(({ entry }) => (
                  <li key={entry.id}>
                    <Link
                      to={`/app/perfume/${entry.id}`}
                      className="inline-flex rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:border-line-strong hover:text-ink"
                    >
                      {entry.fragrance.name}
                    </Link>
                  </li>
                ))}
                {summary.unworn.length > 12 && <li className="self-center text-xs text-ink-3">+{summary.unworn.length - 12} more</li>}
              </ul>
            </section>
          )}

          {!grouped.length ? (
            <EmptyState
              icon={<NotebookPen />}
              title="No wears logged yet"
              description="Logging what you wear shows your most-worn bottles and how each performs in real weather."
              action={
                <Button icon={<Plus />} onClick={() => setEditing('new')}>
                  Log your first wear
                </Button>
              }
            />
          ) : (
            grouped.map(([month, list]) => (
              <section key={month}>
                <h2 className="mb-3 text-2xl">{formatDate(`${month}-01`, { day: undefined, month: 'long' })}</h2>
                <ul className="card divide-y divide-line">
                  {list.map((l) => {
                    const e = byId.get(l.collection_item_id)
                    return (
                      <li key={l.id} className="flex items-start gap-3 p-4">
                        {e && (
                          <FragranceImage
                            fragrance={e.fragrance}
                            bottlePhotoPath={e.bottle_image_path}
                            sizes="thumb"
                            className="size-11 shrink-0 rounded-md border border-line"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            {e ? (
                              <Link to={`/app/perfume/${e.id}`} className="font-medium text-ink hover:underline">
                                {e.fragrance.name}
                              </Link>
                            ) : (
                              <span className="text-ink-3">Deleted perfume</span>
                            )}
                            <span className="ml-2 text-ink-3">{formatDate(l.worn_on)}</span>
                          </p>
                          <p className="mt-0.5 text-sm text-ink-2">
                            {[
                              l.scenario && SCENARIO_LABELS[l.scenario],
                              l.weather && WEAR_WEATHER.find((w) => w.value === l.weather)?.label,
                              l.sprays != null && `${l.sprays} spray${l.sprays === 1 ? '' : 's'}`,
                              l.longevity_hours != null && `lasted ${l.longevity_hours} h`,
                              l.compliments ? `${l.compliments} compliment${l.compliments === 1 ? '' : 's'}` : null,
                              l.rating != null && `${l.rating}/5`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {l.notes && <p className="mt-1 text-sm text-ink-3">{l.notes}</p>}
                        </div>
                        <div className="flex shrink-0">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(l)} aria-label="Edit entry">
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => remove(l)} aria-label="Delete entry">
                            <Trash2 />
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      <Dialog open={editing != null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Log a wear' : 'Edit wear entry'}>
        {editing != null && (
          <WearLogForm
            entries={entries.data ?? []}
            initial={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  )
}
