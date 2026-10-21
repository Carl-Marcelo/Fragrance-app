import { describe, expect, it } from 'vitest'
import { collectionInsights, compareWishlist, recommendFromCatalog, similarity, unwornRecently } from './similarity'
import { makeEntry, makeFragrance } from './test-fixtures'

const citrus = { accords: ['citrus', 'fresh', 'aromatic'], notes_top: ['Bergamot', 'Lemon'], family: 'Citrus', freshness: 5, sweetness: 1 }
const gourmand = { accords: ['vanilla', 'sweet', 'amber'], notes_base: ['Vanilla', 'Tonka Bean'], family: 'Gourmand', freshness: 1, sweetness: 5 }

describe('similarity', () => {
  it('is 1 for identical profiles and low for opposites', () => {
    const a = makeFragrance(citrus)
    expect(similarity(a, makeFragrance(citrus))).toBeCloseTo(1)
    expect(similarity(a, makeFragrance(gourmand))).toBeLessThan(0.15)
  })
  it('returns 0 when there is nothing to compare', () => {
    expect(similarity(makeFragrance(), makeFragrance())).toBe(0)
  })
})

describe('compareWishlist', () => {
  it('flags near-duplicates and gap fillers', () => {
    const owned = [makeEntry(citrus, { status: 'owned' })]
    const dupe = makeEntry(citrus, { status: 'wishlist' })
    const gap = makeEntry(gourmand, { status: 'wishlist' })
    const [r1, r2] = compareWishlist([dupe, gap], owned)
    expect(r1.verdict).toMatch(/duplicate/)
    expect(r2.verdict).toMatch(/fill a gap/)
    expect(r2.newAccords).toEqual(['vanilla', 'sweet', 'amber'])
  })
})

describe('recommendFromCatalog', () => {
  it('suggests catalog items close to favourites and skips ones already owned', () => {
    const fav = makeEntry(citrus, { is_favorite: true })
    const close = makeFragrance({ ...citrus, name: 'Close' })
    const far = makeFragrance({ ...gourmand, name: 'Far' })
    const recs = recommendFromCatalog([close, far, fav.fragrance], [fav])
    expect(recs.map((r) => r.fragrance.name)).toEqual(['Close'])
  })
  it('returns nothing without favourites or high ratings', () => {
    expect(recommendFromCatalog([makeFragrance(citrus)], [makeEntry(citrus)])).toEqual([])
  })
})

describe('collectionInsights', () => {
  it('reports a missing hot-weather option only when enough data exists', () => {
    const heavy = Array.from({ length: 3 }, () => makeEntry({ ...gourmand, suit_hot: 2 }))
    const titles = collectionInsights(heavy).map((i) => i.title)
    expect(titles).toContain('Nothing rated for hot weather')
    expect(titles).toContain('Leans sweet')
    expect(collectionInsights(heavy.slice(0, 2))).toEqual([])
  })
})

describe('unwornRecently', () => {
  it('lists owned bottles with no recent wear', () => {
    const a = makeEntry()
    const b = makeEntry()
    const logs = [
      { id: 'l1', user_id: 'u', collection_item_id: a.id, worn_on: '2026-10-15', scenario: null, weather: null, sprays: null, longevity_hours: null, rating: null, compliments: null, notes: null, created_at: '' },
    ]
    const result = unwornRecently([a, b], logs, 45, new Date('2026-10-21T12:00:00'))
    expect(result.map((r) => r.entry.id)).toEqual([b.id])
  })
})
