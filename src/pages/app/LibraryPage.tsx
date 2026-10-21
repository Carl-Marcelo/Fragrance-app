import { BookOpen, Eye, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { InfoStatusBadge } from '../../components/fragrance/FragranceBits'
import { FragranceImage } from '../../components/fragrance/FragranceImage'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Chip, Switch } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/States'
import { useDeleteFragrance, useEntries, useMyFragrances, useUpdateFragrance } from '../../hooks/queries'
import { concentrationLabel, statusLabel } from '../../lib/constants'
import { normalize } from '../../lib/filters'
import { errorMessage } from '../../lib/format'
import type { Fragrance } from '../../lib/types'
import { useConfirm } from '../../providers/ConfirmProvider'
import { useToast } from '../../providers/ToastProvider'

type Show = 'all' | 'public' | 'private'

export default function LibraryPage() {
  const library = useMyFragrances()
  const entries = useEntries()
  const update = useUpdateFragrance()
  const del = useDeleteFragrance()
  const confirm = useConfirm()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [show, setShow] = useState<Show>('all')

  const usage = useMemo(() => {
    const map = new Map<string, string[]>()
    entries.data?.forEach((e) => map.set(e.fragrance_id, [...(map.get(e.fragrance_id) ?? []), statusLabel(e.status)]))
    return map
  }, [entries.data])

  const list = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean)
    return (library.data ?? [])
      .filter((f) => (show === 'all' ? true : show === 'public' ? f.is_public : !f.is_public))
      .filter((f) => terms.every((t) => normalize(`${f.name} ${f.brand}`).includes(t)))
      .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
  }, [library.data, q, show])

  const publicCount = library.data?.filter((f) => f.is_public).length ?? 0

  const setPublic = async (f: Fragrance, value: boolean) => {
    if (value) {
      const ok = await confirm({
        title: `Publish ${f.name}?`,
        description:
          'Its profile (notes, accords, ratings, suitability, image and sources) becomes visible to anyone. Personal records stay private.',
        confirmLabel: 'Publish',
      })
      if (!ok) return
    }
    update.mutate(
      { id: f.id, patch: { is_public: value } },
      {
        onSuccess: () => toast.success(value ? `${f.name} published` : `${f.name} is now private`),
        onError: (err) => toast.error('Couldn’t change visibility', errorMessage(err)),
      },
    )
  }

  const remove = async (f: Fragrance) => {
    const used = usage.get(f.id)
    const ok = await confirm({
      title: `Delete ${f.name}?`,
      description: used?.length
        ? `This fragrance is used by ${used.length} journal record${used.length > 1 ? 's' : ''} (${used.join(', ')}). Deleting it also deletes those records and their wear logs.`
        : 'This removes the fragrance profile permanently.',
      confirmLabel: 'Delete',
      tone: 'danger',
      requireText: used?.length ? 'DELETE' : undefined,
    })
    if (!ok) return
    del.mutate(f.id, {
      onSuccess: () => toast.success(`${f.name} deleted`),
      onError: (err) => toast.error('Couldn’t delete', errorMessage(err)),
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Manage"
        title="Fragrance library"
        description="Every fragrance profile you’ve created, and what’s visible in the public catalog."
        actions={
          <ButtonLink to="/app/library/new" icon={<Plus />}>
            New catalog entry
          </ButtonLink>
        }
      />

      <Notice className="mb-6" icon={<Eye />}>
        <span className="font-medium text-ink">{publicCount}</span> of {library.data?.length ?? 0} profiles are public.
        Published profiles never include your ratings, notes, prices, bottles or whether you own them.
      </Notice>

      {library.isError ? (
        <ErrorState error={library.error} onRetry={() => library.refetch()} />
      ) : library.isPending ? (
        <LoadingBlock />
      ) : !library.data?.length ? (
        <EmptyState
          icon={<BookOpen />}
          title="No fragrance profiles yet"
          description="Profiles are created when you add a perfume to your journal, or here as catalog-only entries."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search the library</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input type="search" className="field-input pl-9" placeholder="Search name or brand" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="flex gap-1.5" role="group" aria-label="Visibility">
              {(['all', 'public', 'private'] as Show[]).map((s) => (
                <Chip key={s} selected={show === s} onClick={() => setShow(s)} className="capitalize">
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          <ul className="card divide-y divide-line">
            {list.map((f) => {
              const used = usage.get(f.id)
              return (
                <li key={f.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link to={`/fragrance/${f.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <FragranceImage fragrance={f} sizes="thumb" className="size-12 shrink-0 rounded-md border border-line" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{f.name}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {[f.brand, concentrationLabel(f.concentration, true)].filter(Boolean).join(' · ')}
                        {used?.length ? ` · In journal: ${used.join(', ')}` : ' · Catalog only'}
                      </span>
                    </span>
                  </Link>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <InfoStatusBadge status={f.info_status} />
                    <div className="w-36">
                      <Switch
                        checked={f.is_public}
                        onChange={(v) => setPublic(f, v)}
                        disabled={update.isPending}
                        label={
                          <span className="inline-flex items-center gap-1 text-xs">
                            {f.is_public ? <Eye className="size-3.5" /> : <Lock className="size-3.5" />}
                            {f.is_public ? 'Public' : 'Private'}
                          </span>
                        }
                      />
                    </div>
                    <ButtonLink to={`/app/library/${f.id}/edit`} variant="ghost" size="icon-sm" aria-label={`Edit ${f.name}`}>
                      <Pencil />
                    </ButtonLink>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(f)} aria-label={`Delete ${f.name}`}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              )
            })}
            {!list.length && <li className="p-6 text-center text-sm text-ink-3">No matches.</li>}
          </ul>
        </>
      )}
    </div>
  )
}
