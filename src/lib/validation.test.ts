import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup } from './backup'
import { blankFragrance, blankItem } from './defaults'
import { makeEntry } from './test-fixtures'
import { fragranceInputSchema, itemInputSchema } from './validation'

describe('fragranceInputSchema', () => {
  it('accepts a minimal record and trims text', () => {
    const r = fragranceInputSchema.safeParse({ ...blankFragrance(), name: '  Sauvage ', brand: 'Dior', description: '   ' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.name).toBe('Sauvage')
      expect(r.data.description).toBeNull()
    }
  })

  it('rejects missing names, bad scales and non-https images', () => {
    const r = fragranceInputSchema.safeParse({
      ...blankFragrance(),
      name: '',
      brand: 'X',
      sweetness: 7,
      image_url: 'http://example.com/a.jpg',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'))
      expect(paths).toEqual(expect.arrayContaining(['name', 'sweetness', 'image_url']))
    }
  })

  it('rejects javascript: source links', () => {
    const r = fragranceInputSchema.safeParse({
      ...blankFragrance(),
      name: 'A',
      brand: 'B',
      source_links: [{ label: 'x', url: 'javascript:alert(1)', kind: 'other' }],
    })
    expect(r.success).toBe(false)
  })
})

describe('itemInputSchema', () => {
  it('rejects NaN numbers and out-of-range values', () => {
    const r = itemInputSchema.safeParse({ ...blankItem('owned'), purchase_price: Number.NaN, remaining_percent: 140 })
    expect(r.success).toBe(false)
  })
  it('accepts a blank wishlist item', () => {
    expect(itemInputSchema.safeParse(blankItem('wishlist')).success).toBe(true)
  })
})

describe('backup round trip', () => {
  const entry = makeEntry({ name: 'Round Trip', brand: 'House', accords: ['woody'] }, { personal_rating: 8.5, purchase_price: 4200 })
  const { fragrance, ...item } = entry
  const backup = buildBackup({
    fragrances: [fragrance],
    items: [item],
    wearLogs: [
      {
        id: '00000000-0000-4000-8000-00000000ffff',
        user_id: entry.user_id,
        collection_item_id: entry.id,
        worn_on: '2026-10-20',
        scenario: 'office',
        weather: 'aircon',
        sprays: 2,
        longevity_hours: 7,
        rating: 4,
        compliments: 1,
        notes: null,
        created_at: '2026-10-20T08:00:00.000Z',
      },
    ],
    settings: null,
  })

  it('exports without owner ids and parses back', () => {
    const json = JSON.parse(JSON.stringify(backup))
    expect(json.fragrances[0].owner_id).toBeUndefined()
    expect(json.collection_items[0].user_id).toBeUndefined()
    const parsed = parseBackup(json)
    expect(parsed.ok).toBe(true)
  })

  it('rejects broken references and foreign files', () => {
    const broken = JSON.parse(JSON.stringify(backup))
    broken.collection_items[0].fragrance_id = '00000000-0000-4000-8000-00000000abcd'
    const r = parseBackup(broken)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/not in the file/)

    const foreign = parseBackup({ app: 'other', version: 1 })
    expect(foreign.ok).toBe(false)
  })
})
