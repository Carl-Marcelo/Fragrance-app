import { describe, expect, it } from 'vitest'
import { recommend } from '../spray'
import { fragranceInputSchema } from '../validation'
import { FRAGELLA_FRESH, FRAGELLA_SAMPLE } from './fixtures'
import { normalizeFragella, normalizeFragellaList, parseConcentration, parseGender } from './fragella'
import { familyFromAccords, toFragranceInput } from './toFragrance'

describe('normalizeFragella', () => {
  it('maps the documented response shape', () => {
    const d = normalizeFragella(FRAGELLA_SAMPLE)!
    expect(d.name).toBe('Khamrah')
    expect(d.brand).toBe('Lattafa Perfumes')
    expect(d.year).toBe(2022)
    expect(d.gender).toBe('unisex')
    expect(d.concentration).toBe('edp')
    expect(d.country).toBe('United Arab Emirates')
    expect(d.imageUrl).toBe('https://images.fragella.example/khamrah.jpg')
    expect(d.notes.top).toEqual(['Cinnamon', 'Nutmeg', 'Bergamot'])
    expect(d.accords[0]).toEqual({ name: 'sweet', strength: 'dominant' })
    expect(d.accords.at(-1)).toEqual({ name: 'boozy', strength: 'subtle' })
    expect(d.seasons[0].name).toBe('winter')
    expect(d.rating).toBe(4.25)
    expect(d.ref).toBe('65a1f0c2e4b0a1b2c3d4e5f6')
  })

  it('tolerates missing and oddly typed fields', () => {
    const d = normalizeFragella({ Name: '  Mystery  ', Brand: 'House', Notes: 'not an object', 'Image URL': 'http://insecure.example/x.jpg' })!
    expect(d.name).toBe('Mystery')
    expect(d.imageUrl).toBeNull()
    expect(d.notes).toEqual({ top: [], middle: [], base: [] })
    expect(d.ref).toBe('house--mystery')
    expect(normalizeFragella({ Name: 'No brand' })).toBeNull()
  })

  it('splits perfumer credits on semicolons', () => {
    const d = normalizeFragella({ Name: 'X', Brand: 'Y', perfumers: 'Anne Flipo; Carlos Benaïm' })!
    expect(d.perfumers).toEqual(['Anne Flipo', 'Carlos Benaïm'])
    expect(normalizeFragella({ Name: 'X', Brand: 'Y', perfumers: '' })!.perfumers).toEqual([])
  })

  it('accepts list wrappers and removes duplicates', () => {
    expect(normalizeFragellaList([FRAGELLA_SAMPLE, FRAGELLA_SAMPLE])).toHaveLength(1)
    expect(normalizeFragellaList({ data: [FRAGELLA_SAMPLE, FRAGELLA_FRESH] })).toHaveLength(2)
    expect(normalizeFragellaList({ results: [FRAGELLA_FRESH] })).toHaveLength(1)
    expect(normalizeFragellaList({ similar_to: 'Khamrah', similar_fragrances: [FRAGELLA_FRESH] })).toHaveLength(1)
    expect(normalizeFragellaList(FRAGELLA_FRESH)).toHaveLength(1)
    expect(normalizeFragellaList(null)).toEqual([])
  })
})

describe('parsers', () => {
  it('reads concentrations', () => {
    expect(parseConcentration('Extrait de Parfum')).toBe('extrait')
    expect(parseConcentration('Eau de Parfum Intense')).toBe('edp')
    expect(parseConcentration('Eau de Toilette')).toBe('edt')
    expect(parseConcentration('Eau de Cologne')).toBe('edc')
    expect(parseConcentration('Perfume Oil')).toBe('oil')
    expect(parseConcentration('Parfum')).toBe('parfum')
    expect(parseConcentration(null)).toBeNull()
  })
  it('reads gender without confusing female and male', () => {
    expect(parseGender('female')).toBe('women')
    expect(parseGender('for women')).toBe('women')
    expect(parseGender('for men')).toBe('men')
    expect(parseGender('for women and men')).toBe('unisex')
    expect(parseGender('Unisex')).toBe('unisex')
  })
})

describe('toFragranceInput', () => {
  const sweet = toFragranceInput(normalizeFragella(FRAGELLA_SAMPLE)!)
  const fresh = toFragranceInput(normalizeFragella(FRAGELLA_FRESH)!)

  it('produces a valid journal record linked to its source', () => {
    expect(fragranceInputSchema.safeParse(sweet).success).toBe(true)
    expect(sweet.external_source).toBe('fragella')
    expect(sweet.external_id).toBe('65a1f0c2e4b0a1b2c3d4e5f6')
    expect(sweet.info_status).toBe('unverified')
    expect(sweet.ratings_basis).toBe('community')
    expect(sweet.is_public).toBe(false)
  })

  it('derives character from accords', () => {
    expect(sweet.sweetness!).toBeGreaterThanOrEqual(4)
    expect(fresh.freshness!).toBeGreaterThanOrEqual(4)
    expect(sweet.freshness!).toBeLessThan(fresh.freshness!)
    expect(familyFromAccords([{ name: 'citrus' }])).toBe('Citrus')
  })

  it('maps performance labels and season/occasion rankings', () => {
    expect(sweet.longevity).toBe(4)
    expect(sweet.projection).toBe(4)
    expect(fresh.projection).toBe(3)
    expect(fresh.suit_hot).toBe(5)
    expect(sweet.suit_hot!).toBeLessThanOrEqual(2)
    expect(fresh.suit_office!).toBeGreaterThanOrEqual(4)
    expect(sweet.suit_date!).toBeGreaterThanOrEqual(4)
    expect(fresh.suit_rainy!).toBeLessThanOrEqual(2)
  })

  it('treats an even vote spread as neutral, not "very high"', () => {
    const flat = toFragranceInput(
      normalizeFragella({
        ...FRAGELLA_FRESH,
        'Season Ranking': ['summer', 'spring', 'fall', 'winter'].map((name) => ({ name, score: 1 })),
      })!,
    )
    expect(flat.suit_hot).toBe(3)
    expect(flat.suit_rainy).toBe(3)
  })

  it('does not count fruity as fully sweet, and lets citrus top notes add freshness', () => {
    const fruityFresh = toFragranceInput(
      normalizeFragella({
        Name: 'Test',
        Brand: 'Test',
        'Main Accords': ['fruity', 'woody'],
        'Main Accords Percentage': { fruity: 'Dominant', woody: 'Prominent' },
        Notes: { Top: [{ name: 'Bergamot' }, { name: 'Lemon' }], Middle: [], Base: [] },
      })!,
    )
    expect(fruityFresh.sweetness!).toBeLessThanOrEqual(3)
    expect(fruityFresh.freshness!).toBeGreaterThanOrEqual(2)
  })

  it('feeds the spray guide sensibly', () => {
    const hotSweet = recommend(sweet, 'hot_day')
    const hotFresh = recommend(fresh, 'hot_day')
    expect(hotSweet.max).toBeLessThan(hotFresh.max)
  })
})
