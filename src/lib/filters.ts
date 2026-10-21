// Client-side search, filtering and sorting. Works on any list of rows that carry
// a fragrance and (for private views) a collection item. All filters combine with
// AND; values inside one multi-select combine with OR unless noted.

import type { CollectionItem, CollectionStatus, Concentration, Fragrance } from './types'

export interface Range {
  min: number
  max: number
}

export const FULL_RANGE: Range = { min: 1, max: 5 }

export type ScaleFilterKey = 'sweetness' | 'freshness' | 'darkness' | 'masculinity' | 'projection' | 'longevity'
export type WeatherFilter = 'hot' | 'humid' | 'rainy' | 'aircon'
export type OccasionFilter = 'day' | 'night' | 'office' | 'date' | 'special'
export type SortKey = 'recent' | 'name' | 'brand' | 'rating' | 'price' | 'year'
export type SortDir = 'asc' | 'desc'

export interface FilterState {
  q: string
  letter: string | null
  letterBy: 'name' | 'brand'
  families: string[]
  notes: string[]
  accords: string[]
  concentrations: Concentration[]
  scales: Record<ScaleFilterKey, Range>
  weather: WeatherFilter[]
  occasions: OccasionFilter[]
  statuses: CollectionStatus[]
  favoritesOnly: boolean
  sort: SortKey
  dir: SortDir
}

export const SCALE_FILTER_KEYS: ScaleFilterKey[] = [
  'sweetness',
  'freshness',
  'darkness',
  'masculinity',
  'projection',
  'longevity',
]

export function defaultFilters(overrides: Partial<FilterState> = {}): FilterState {
  return {
    q: '',
    letter: null,
    letterBy: 'name',
    families: [],
    notes: [],
    accords: [],
    concentrations: [],
    scales: Object.fromEntries(SCALE_FILTER_KEYS.map((k) => [k, { ...FULL_RANGE }])) as FilterState['scales'],
    weather: [],
    occasions: [],
    statuses: [],
    favoritesOnly: false,
    sort: 'recent',
    dir: 'desc',
    ...overrides,
  }
}

export interface Row {
  fragrance: Fragrance
  item?: CollectionItem | null
}

/** A "suitable" rating threshold for weather/occasion filters (on a 1–5 scale). */
export const SUITABLE_AT = 4

const WEATHER_FIELD: Record<WeatherFilter, keyof Fragrance> = {
  hot: 'suit_hot',
  humid: 'suit_humid',
  rainy: 'suit_rainy',
  aircon: 'suit_aircon',
}

const OCCASION_FIELD: Record<OccasionFilter, keyof Fragrance> = {
  day: 'suit_day',
  night: 'suit_night',
  office: 'suit_office',
  date: 'suit_date',
  special: 'suit_special',
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export const allNotes = (f: Fragrance) => [...f.notes_top, ...f.notes_middle, ...f.notes_base]

export function isRangeActive(r: Range) {
  return r.min > FULL_RANGE.min || r.max < FULL_RANGE.max
}

export function activeFilterCount(s: FilterState): number {
  let n = 0
  if (s.q.trim()) n++
  if (s.letter) n++
  n += s.families.length + s.notes.length + s.accords.length + s.concentrations.length
  n += SCALE_FILTER_KEYS.filter((k) => isRangeActive(s.scales[k])).length
  n += s.weather.length + s.occasions.length + s.statuses.length
  if (s.favoritesOnly) n++
  return n
}

function firstLetter(value: string): string {
  const c = normalize(value).charAt(0).toUpperCase()
  return c >= 'A' && c <= 'Z' ? c : '#'
}

export function matches(row: Row, s: FilterState): boolean {
  const f = row.fragrance
  const item = row.item

  if (s.q.trim()) {
    const terms = normalize(s.q).split(/\s+/)
    const hay = normalize(`${f.name} ${f.brand}`)
    if (!terms.every((t) => hay.includes(t))) return false
  }

  if (s.letter && firstLetter(s.letterBy === 'brand' ? f.brand : f.name) !== s.letter) return false

  if (s.families.length && !(f.family && s.families.some((fam) => normalize(fam) === normalize(f.family!)))) {
    return false
  }

  if (s.concentrations.length && !(f.concentration && s.concentrations.includes(f.concentration))) return false

  // Notes and accords narrow results: every selected one must be present.
  if (s.notes.length) {
    const have = new Set(allNotes(f).map(normalize))
    if (!s.notes.every((n) => have.has(normalize(n)))) return false
  }
  if (s.accords.length) {
    const have = new Set(f.accords.map(normalize))
    if (!s.accords.every((a) => have.has(normalize(a)))) return false
  }

  for (const key of SCALE_FILTER_KEYS) {
    const r = s.scales[key]
    if (!isRangeActive(r)) continue
    const v = f[key]
    if (v == null || v < r.min || v > r.max) return false
  }

  for (const w of s.weather) {
    const v = f[WEATHER_FIELD[w]] as number | null
    if (v == null || v < SUITABLE_AT) return false
  }
  for (const o of s.occasions) {
    const v = f[OCCASION_FIELD[o]] as number | null
    if (v == null || v < SUITABLE_AT) return false
  }

  if (s.statuses.length && !(item && s.statuses.includes(item.status))) return false
  if (s.favoritesOnly && !item?.is_favorite) return false

  return true
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

export function compareRows(a: Row, b: Row, sort: SortKey, dir: SortDir): number {
  const sign = dir === 'asc' ? 1 : -1
  // Missing values always sink to the bottom regardless of direction.
  const numeric = (x: number | null | undefined, y: number | null | undefined) => {
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    return (x - y) * sign
  }
  let result = 0
  switch (sort) {
    case 'name':
      result = collator.compare(a.fragrance.name, b.fragrance.name) * sign
      break
    case 'brand':
      result =
        (collator.compare(a.fragrance.brand, b.fragrance.brand) ||
          collator.compare(a.fragrance.name, b.fragrance.name)) * sign
      break
    case 'rating':
      result = numeric(a.item?.personal_rating, b.item?.personal_rating)
      break
    case 'price':
      result = numeric(a.item?.purchase_price, b.item?.purchase_price)
      break
    case 'year':
      result = numeric(a.fragrance.release_year, b.fragrance.release_year)
      break
    case 'recent': {
      const ta = Date.parse(a.item?.created_at ?? a.fragrance.created_at)
      const tb = Date.parse(b.item?.created_at ?? b.fragrance.created_at)
      result = (ta - tb) * sign
      break
    }
  }
  return result || collator.compare(a.fragrance.name, b.fragrance.name)
}

export function applyFilters<T extends Row>(rows: T[], s: FilterState): T[] {
  return rows.filter((r) => matches(r, s)).sort((a, b) => compareRows(a, b, s.sort, s.dir))
}

/** Unique, sorted values present in the data, used to build filter options. */
export function facetValues(rows: Row[]) {
  const families = new Set<string>()
  const notes = new Set<string>()
  const accords = new Set<string>()
  const letters = new Set<string>()
  for (const { fragrance: f } of rows) {
    if (f.family) families.add(f.family)
    allNotes(f).forEach((n) => notes.add(n))
    f.accords.forEach((a) => accords.add(a))
    letters.add(firstLetter(f.name))
    letters.add(firstLetter(f.brand))
  }
  const sorted = (set: Set<string>) => [...set].sort(collator.compare)
  return { families: sorted(families), notes: sorted(notes), accords: sorted(accords), letters }
}

// ----- URL (de)serialisation so filters survive refresh and can be bookmarked --

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])

export function filtersFromParams(params: URLSearchParams, base: FilterState): FilterState {
  const scales = { ...base.scales }
  for (const key of SCALE_FILTER_KEYS) {
    const raw = params.get(key)
    if (!raw) continue
    const [lo, hi] = raw.split('-').map(Number)
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      scales[key] = { min: Math.max(1, Math.min(lo, hi)), max: Math.min(5, Math.max(lo, hi)) }
    }
  }
  const sort = params.get('sort') as SortKey | null
  const dir = params.get('dir') as SortDir | null
  const letter = params.get('letter')
  return {
    ...base,
    q: params.get('q') ?? base.q,
    letter: letter && /^[A-Z#]$/.test(letter) ? letter : base.letter,
    letterBy: params.get('by') === 'brand' ? 'brand' : base.letterBy,
    families: params.has('family') ? list(params.get('family')) : base.families,
    notes: params.has('notes') ? list(params.get('notes')) : base.notes,
    accords: params.has('accords') ? list(params.get('accords')) : base.accords,
    concentrations: params.has('conc') ? (list(params.get('conc')) as Concentration[]) : base.concentrations,
    scales,
    weather: params.has('weather') ? (list(params.get('weather')) as WeatherFilter[]) : base.weather,
    occasions: params.has('occasion') ? (list(params.get('occasion')) as OccasionFilter[]) : base.occasions,
    statuses: params.has('status') ? (list(params.get('status')) as CollectionStatus[]) : base.statuses,
    favoritesOnly: params.has('fav') ? params.get('fav') === '1' : base.favoritesOnly,
    sort: sort && ['recent', 'name', 'brand', 'rating', 'price', 'year'].includes(sort) ? sort : base.sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : base.dir,
  }
}

export function filtersToParams(s: FilterState, base: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (s.q.trim()) p.set('q', s.q.trim())
  if (s.letter) p.set('letter', s.letter)
  if (s.letterBy !== base.letterBy) p.set('by', s.letterBy)
  if (s.families.length) p.set('family', s.families.join(','))
  if (s.notes.length) p.set('notes', s.notes.join(','))
  if (s.accords.length) p.set('accords', s.accords.join(','))
  if (s.concentrations.length) p.set('conc', s.concentrations.join(','))
  for (const key of SCALE_FILTER_KEYS) {
    if (isRangeActive(s.scales[key])) p.set(key, `${s.scales[key].min}-${s.scales[key].max}`)
  }
  if (s.weather.length) p.set('weather', s.weather.join(','))
  if (s.occasions.length) p.set('occasion', s.occasions.join(','))
  if (s.statuses.length) p.set('status', s.statuses.join(','))
  if (s.favoritesOnly !== base.favoritesOnly) p.set('fav', s.favoritesOnly ? '1' : '0')
  if (s.sort !== base.sort) p.set('sort', s.sort)
  if (s.dir !== base.dir) p.set('dir', s.dir)
  return p
}
