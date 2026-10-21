import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  applyFilters,
  defaultFilters,
  facetValues,
  filtersFromParams,
  filtersToParams,
  type FilterState,
} from './filters'
import { makeEntry } from './test-fixtures'

const entries = [
  makeEntry(
    {
      name: 'Aqua Breeze',
      brand: 'Maison A',
      concentration: 'edt',
      family: 'Aquatic',
      accords: ['aquatic', 'citrus', 'fresh'],
      notes_top: ['Bergamot', 'Sea Notes'],
      notes_base: ['White Musk'],
      sweetness: 1,
      freshness: 5,
      suit_hot: 5,
      suit_office: 4,
    },
    { personal_rating: 7, purchase_price: 3000, created_at: '2026-03-01T00:00:00Z' },
  ),
  makeEntry(
    {
      name: 'Velvet Oud',
      brand: 'Atelier Z',
      concentration: 'extrait',
      family: 'Woody',
      accords: ['oud', 'woody', 'smoky'],
      notes_base: ['Agarwood (Oud)', 'Vanilla'],
      sweetness: 4,
      freshness: 1,
      suit_hot: 1,
      suit_date: 5,
    },
    { personal_rating: 9, purchase_price: 12000, is_favorite: true, created_at: '2026-01-01T00:00:00Z' },
  ),
  makeEntry(
    { name: 'Écume Blanche', brand: 'Maison A', concentration: 'edp', family: 'Floral', accords: ['white floral', 'fresh'] },
    { status: 'wishlist', personal_rating: null, purchase_price: null, created_at: '2026-02-01T00:00:00Z' },
  ),
]
const rows = entries.map((e) => ({ fragrance: e.fragrance, item: e }))
const f = (patch: Partial<FilterState>) => ({ ...defaultFilters(), ...patch })
const names = (s: FilterState) => applyFilters(rows, s).map((r) => r.fragrance.name)

describe('applyFilters', () => {
  it('searches name and brand, ignoring accents and case', () => {
    expect(names(f({ q: 'ecume' }))).toEqual(['Écume Blanche'])
    expect(names(f({ q: 'maison a', sort: 'name', dir: 'asc' }))).toEqual(['Aqua Breeze', 'Écume Blanche'])
  })

  it('filters by first letter of name or brand', () => {
    expect(names(f({ letter: 'V' }))).toEqual(['Velvet Oud'])
    expect(names(f({ letter: 'E', letterBy: 'name' }))).toEqual(['Écume Blanche'])
    expect(names(f({ letter: 'A', letterBy: 'brand', sort: 'name', dir: 'asc' }))).toEqual(['Velvet Oud'])
  })

  it('combines family, concentration, accord and note filters', () => {
    expect(names(f({ families: ['Aquatic', 'Woody'], sort: 'name', dir: 'asc' }))).toEqual(['Aqua Breeze', 'Velvet Oud'])
    expect(names(f({ concentrations: ['extrait'] }))).toEqual(['Velvet Oud'])
    expect(names(f({ accords: ['fresh'], sort: 'name', dir: 'asc' }))).toEqual(['Aqua Breeze', 'Écume Blanche'])
    expect(names(f({ accords: ['fresh', 'citrus'] }))).toEqual(['Aqua Breeze'])
    expect(names(f({ notes: ['vanilla'] }))).toEqual(['Velvet Oud'])
    expect(names(f({ accords: ['fresh'], concentrations: ['extrait'] }))).toEqual([])
  })

  it('applies scale ranges and excludes unknown values when a range is active', () => {
    const scales = defaultFilters().scales
    expect(names(f({ scales: { ...scales, sweetness: { min: 3, max: 5 } } }))).toEqual(['Velvet Oud'])
    expect(names(f({ scales: { ...scales, freshness: { min: 4, max: 5 } } }))).toEqual(['Aqua Breeze'])
  })

  it('filters by weather, occasion, status and favourites', () => {
    expect(names(f({ weather: ['hot'] }))).toEqual(['Aqua Breeze'])
    expect(names(f({ occasions: ['date'] }))).toEqual(['Velvet Oud'])
    expect(names(f({ statuses: ['wishlist'] }))).toEqual(['Écume Blanche'])
    expect(names(f({ favoritesOnly: true }))).toEqual(['Velvet Oud'])
  })

  it('sorts by rating and price with missing values last', () => {
    expect(names(f({ sort: 'rating', dir: 'desc' }))).toEqual(['Velvet Oud', 'Aqua Breeze', 'Écume Blanche'])
    expect(names(f({ sort: 'price', dir: 'asc' }))).toEqual(['Aqua Breeze', 'Velvet Oud', 'Écume Blanche'])
    expect(names(f({ sort: 'recent', dir: 'desc' }))).toEqual(['Aqua Breeze', 'Écume Blanche', 'Velvet Oud'])
  })
})

describe('filter URL round trip', () => {
  it('survives serialisation', () => {
    const base = defaultFilters()
    const state = f({
      q: 'oud',
      letter: 'V',
      families: ['Woody'],
      accords: ['oud', 'smoky'],
      concentrations: ['extrait'],
      scales: { ...base.scales, darkness: { min: 3, max: 5 } },
      weather: ['rainy'],
      occasions: ['date'],
      favoritesOnly: true,
      sort: 'price',
      dir: 'asc',
    })
    const params = filtersToParams(state, base)
    expect(filtersFromParams(new URLSearchParams(params.toString()), base)).toEqual(state)
    // q, letter, 1 family, 2 accords, 1 concentration, 1 range, 1 weather, 1 occasion, favourites
    expect(activeFilterCount(state)).toBe(10)
  })

  it('ignores malformed parameters', () => {
    const base = defaultFilters()
    const parsed = filtersFromParams(new URLSearchParams('letter=xyz&sort=evil&sweetness=a-b'), base)
    expect(parsed.letter).toBeNull()
    expect(parsed.sort).toBe('recent')
    expect(parsed.scales.sweetness).toEqual({ min: 1, max: 5 })
  })
})

describe('facetValues', () => {
  it('collects families, notes, accords and letters present in the data', () => {
    const facets = facetValues(rows)
    expect(facets.families).toEqual(['Aquatic', 'Floral', 'Woody'])
    expect(facets.accords).toContain('oud')
    expect(facets.notes).toContain('Bergamot')
    expect(facets.letters.has('E')).toBe(true)
  })
})
