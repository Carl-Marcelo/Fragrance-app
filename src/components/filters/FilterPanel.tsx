import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, SlidersHorizontal, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import {
  CHARACTER_SCALES,
  CONCENTRATIONS,
  OCCASION_SUITABILITY,
  PERFORMANCE_SCALES,
  STATUSES,
  WEATHER_SUITABILITY,
} from '../../lib/constants'
import { cn } from '../../lib/cn'
import {
  activeFilterCount,
  isRangeActive,
  type FilterState,
  type ScaleFilterKey,
  type SortKey,
} from '../../lib/filters'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Chip, Switch } from '../ui/Field'

export interface Facets {
  families: string[]
  notes: string[]
  accords: string[]
  letters: Set<string>
}

interface FilterControlsProps {
  state: FilterState
  update: (patch: Partial<FilterState> | ((s: FilterState) => Partial<FilterState>)) => void
  clear: () => void
  facets: Facets
  showStatus?: boolean
  showFavorites?: boolean
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

// ----- Search + sort bar ------------------------------------------------------

const SORTS: { value: SortKey; label: string; private?: boolean }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'name', label: 'Name' },
  { value: 'brand', label: 'Brand' },
  { value: 'rating', label: 'My rating', private: true },
  { value: 'price', label: 'Price', private: true },
  { value: 'year', label: 'Release year' },
]

export function SearchSortBar({
  state,
  update,
  privateSorts,
  onOpenFilters,
  filterCount,
}: {
  state: FilterState
  update: FilterControlsProps['update']
  privateSorts?: boolean
  onOpenFilters?: () => void
  filterCount: number
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative flex-1">
        <span className="sr-only">Search by name or brand</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          value={state.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="Search name or brand"
          className="field-input h-10 pl-9"
        />
      </label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="sr-only">Sort by</span>
          <select
            value={state.sort}
            onChange={(e) => {
              const sort = e.target.value as SortKey
              update({ sort, dir: sort === 'name' || sort === 'brand' ? 'asc' : 'desc' })
            }}
            className="field-input h-10 w-auto pr-8"
          >
            {SORTS.filter((s) => privateSorts || !s.private).map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => update({ dir: state.dir === 'asc' ? 'desc' : 'asc' })}
          aria-label={state.dir === 'asc' ? 'Ascending order. Switch to descending.' : 'Descending order. Switch to ascending.'}
          title={state.dir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {state.dir === 'asc' ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
        </Button>
        {onOpenFilters && (
          <Button variant="secondary" onClick={onOpenFilters} className="lg:hidden" icon={<SlidersHorizontal />}>
            Filters{filterCount > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-accent-ink">{filterCount}</span>}
          </Button>
        )}
      </div>
    </div>
  )
}

// ----- A–Z bar ----------------------------------------------------------------

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']

export function AlphabetBar({
  state,
  update,
  available,
}: {
  state: FilterState
  update: FilterControlsProps['update']
  available: Set<string>
}) {
  return (
    <div className="flex flex-wrap items-center gap-y-1">
      <nav aria-label="Filter by first letter" className="-ml-1 flex flex-wrap">
        <button
          type="button"
          aria-pressed={!state.letter}
          onClick={() => update({ letter: null })}
          className={cn(
            'h-7 rounded px-2 text-xs',
            !state.letter ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-sunken',
          )}
        >
          All
        </button>
        {LETTERS.map((l) => {
          const enabled = available.has(l) || state.letter === l
          return (
            <button
              key={l}
              type="button"
              disabled={!enabled}
              aria-pressed={state.letter === l}
              onClick={() => update({ letter: state.letter === l ? null : l })}
              className={cn(
                'h-7 w-6 rounded text-xs transition-colors',
                state.letter === l
                  ? 'bg-accent text-accent-ink'
                  : enabled
                    ? 'text-ink-2 hover:bg-sunken hover:text-ink'
                    : 'text-ink-3/50',
              )}
            >
              {l}
            </button>
          )
        })}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-1 pl-3 text-xs">
        <span className="text-ink-3">A–Z by</span>
        {(['name', 'brand'] as const).map((by) => (
          <button
            key={by}
            type="button"
            aria-pressed={state.letterBy === by}
            onClick={() => update({ letterBy: by })}
            className={cn(
              'rounded px-1.5 py-0.5 capitalize',
              state.letterBy === by ? 'bg-sunken font-medium text-ink' : 'text-ink-3 hover:text-ink',
            )}
          >
            {by}
          </button>
        ))}
      </div>
    </div>
  )
}

// ----- Filter groups ----------------------------------------------------------

function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-line py-3 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink select-none">
        {title}
        <span className="text-ink-3 transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

function RangeSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: { min: number; max: number }
  onChange: (v: { min: number; max: number }) => void
}) {
  const options = [1, 2, 3, 4, 5]
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className={cn('min-w-0 truncate', isRangeActive(value) ? 'font-medium text-ink' : 'text-ink-2')}>{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        <select
          aria-label={`${label} minimum`}
          value={value.min}
          onChange={(e) => onChange({ min: Number(e.target.value), max: Math.max(Number(e.target.value), value.max) })}
          className="field-input h-8 w-14 px-2 py-0 text-xs"
        >
          {options.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <span className="text-ink-3">–</span>
        <select
          aria-label={`${label} maximum`}
          value={value.max}
          onChange={(e) => onChange({ min: Math.min(Number(e.target.value), value.min), max: Number(e.target.value) })}
          className="field-input h-8 w-14 px-2 py-0 text-xs"
        >
          {options.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </span>
    </div>
  )
}

export function FilterControls({ state, update, clear, facets, showStatus, showFavorites }: FilterControlsProps) {
  const [noteDraft, setNoteDraft] = useState('')
  const noteListId = useId()
  const count = activeFilterCount(state)
  const setScale = (key: ScaleFilterKey, v: { min: number; max: number }) =>
    update((s) => ({ scales: { ...s.scales, [key]: v } }))

  const addNote = (n: string) => {
    const match = facets.notes.find((x) => x.toLowerCase() === n.trim().toLowerCase())
    if (match && !state.notes.includes(match)) update((s) => ({ notes: [...s.notes, match] }))
    setNoteDraft('')
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm text-ink-2">{count ? `${count} filter${count > 1 ? 's' : ''} active` : 'No filters'}</p>
        <Button variant="ghost" size="sm" onClick={clear} disabled={!count} icon={<X />}>
          Clear all
        </Button>
      </div>

      {(showStatus || showFavorites) && (
        <Group title="Collection">
          <div className="space-y-3">
            {showStatus && (
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <Chip
                    key={s.value}
                    selected={state.statuses.includes(s.value)}
                    onClick={() => update((f) => ({ statuses: toggle(f.statuses, s.value) }))}
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            )}
            {showFavorites && (
              <Switch
                checked={state.favoritesOnly}
                onChange={(v) => update({ favoritesOnly: v })}
                label="Favourites only"
              />
            )}
          </div>
        </Group>
      )}

      <Group title="Concentration">
        <div className="flex flex-wrap gap-1.5">
          {CONCENTRATIONS.map((c) => (
            <Chip
              key={c.value}
              selected={state.concentrations.includes(c.value)}
              onClick={() => update((s) => ({ concentrations: toggle(s.concentrations, c.value) }))}
            >
              {c.short}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Fragrance family">
        {facets.families.length ? (
          <div className="flex flex-wrap gap-1.5">
            {facets.families.map((f) => (
              <Chip
                key={f}
                selected={state.families.includes(f)}
                onClick={() => update((s) => ({ families: toggle(s.families, f) }))}
              >
                {f}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-3">No families recorded yet.</p>
        )}
      </Group>

      <Group title="Accords" defaultOpen={state.accords.length > 0}>
        {facets.accords.length ? (
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {facets.accords.map((a) => (
              <Chip
                key={a}
                selected={state.accords.includes(a)}
                onClick={() => update((s) => ({ accords: toggle(s.accords, a) }))}
                className="capitalize"
              >
                {a}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-3">No accords recorded yet.</p>
        )}
        {state.accords.length > 1 && <p className="mt-2 text-xs text-ink-3">Showing perfumes with all selected accords.</p>}
      </Group>

      <Group title="Notes" defaultOpen={state.notes.length > 0}>
        <label className="block">
          <span className="sr-only">Add a note filter</span>
          <input
            list={noteListId}
            value={noteDraft}
            onChange={(e) => {
              const v = e.target.value
              if (facets.notes.includes(v)) addNote(v)
              else setNoteDraft(v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addNote(noteDraft)
              }
            }}
            placeholder={facets.notes.length ? 'Type a note, e.g. Vanilla' : 'No notes recorded yet'}
            disabled={!facets.notes.length}
            className="field-input h-9"
          />
          <datalist id={noteListId}>
            {facets.notes.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        {state.notes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {state.notes.map((n) => (
              <Chip key={n} selected onClick={() => update((s) => ({ notes: s.notes.filter((x) => x !== n) }))}>
                {n} <X aria-label="remove" />
              </Chip>
            ))}
          </div>
        )}
      </Group>

      <Group title="Character" defaultOpen={false}>
        <div className="space-y-2">
          {CHARACTER_SCALES.map((s) => (
            <RangeSelect key={s.key} label={s.label} value={state.scales[s.key]} onChange={(v) => setScale(s.key, v)} />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">1 = {CHARACTER_SCALES[0].low.toLowerCase()} … 5 = {CHARACTER_SCALES[0].high.toLowerCase()}</p>
      </Group>

      <Group title="Performance" defaultOpen={false}>
        <div className="space-y-2">
          {PERFORMANCE_SCALES.map((s) => (
            <RangeSelect key={s.key} label={s.label} value={state.scales[s.key]} onChange={(v) => setScale(s.key, v)} />
          ))}
        </div>
      </Group>

      <Group title="Weather" defaultOpen={state.weather.length > 0}>
        <div className="flex flex-wrap gap-1.5">
          {WEATHER_SUITABILITY.map((w) => (
            <Chip
              key={w.filter}
              selected={state.weather.includes(w.filter)}
              onClick={() => update((s) => ({ weather: toggle(s.weather, w.filter) }))}
            >
              {w.label}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">Rated 4 or higher for every selected condition.</p>
      </Group>

      <Group title="Occasion" defaultOpen={state.occasions.length > 0}>
        <div className="flex flex-wrap gap-1.5">
          {OCCASION_SUITABILITY.map((o) => (
            <Chip
              key={o.filter}
              selected={state.occasions.includes(o.filter)}
              onClick={() => update((s) => ({ occasions: toggle(s.occasions, o.filter) }))}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </Group>
    </div>
  )
}

/** Sidebar on large screens, dialog on small ones. */
export function FilterLayout({
  controls,
  toolbar,
  children,
}: {
  controls: FilterControlsProps
  toolbar: (openFilters: () => void, count: number) => ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(controls.state)
  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8">
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-1">
          <FilterControls {...controls} />
        </div>
      </aside>
      <div className="min-w-0 space-y-4">
        {toolbar(() => setOpen(true), count)}
        {children}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Filters" size="sm">
        <FilterControls {...controls} />
        <Button className="mt-4 w-full" onClick={() => setOpen(false)}>
          Show results
        </Button>
      </Dialog>
    </div>
  )
}
