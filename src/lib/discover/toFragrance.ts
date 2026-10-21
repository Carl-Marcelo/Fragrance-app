// Converts a fragrance from the external database into a journal record.
// Facts (notes, accords, year, concentration) are copied as-is and marked
// unverified; character and suitability are derived from community data and
// accords, and labelled as community ratings.

import { blankFragrance } from '../defaults'
import { normalize } from '../filters'
import type { FragranceInput, ScaleValue } from '../types'
import type { AccordStrength, DiscoveredFragrance, RankedTag } from './types'

const WEIGHT: Record<AccordStrength, number> = { dominant: 1, prominent: 0.75, moderate: 0.5, subtle: 0.3 }

// How strongly each accord signals a trait (1 = defining, lower = partial).
const SWEET: Record<string, number> = {
  sweet: 1, vanilla: 1, caramel: 1, honey: 1, gourmand: 1, chocolate: 1, cacao: 1, praline: 1, candy: 1,
  cherry: 0.7, almond: 0.6, coconut: 0.6, tropical: 0.5, rum: 0.5, boozy: 0.5, fruity: 0.4,
}
const FRESH: Record<string, number> = {
  fresh: 1, citrus: 1, aquatic: 1, marine: 1, ozonic: 1, 'fresh spicy': 0.8, green: 0.8, watery: 0.8, clean: 0.7,
  salty: 0.6, mint: 0.7, aromatic: 0.6, lavender: 0.5, herbal: 0.5,
}
const DARK: Record<string, number> = {
  oud: 1, leather: 1, smoky: 1, tobacco: 1, incense: 1, animalic: 1, coffee: 0.7, balsamic: 0.7, resinous: 0.7,
  patchouli: 0.6, earthy: 0.6, mossy: 0.5, amber: 0.5,
}
const FRESH_NOTES = /bergamot|lemon|lime|grapefruit|mandarin|orange|yuzu|citrus|neroli|petitgrain|mint|sea|marine|water|cucumber|green|apple|ginger/

function accordScore(d: DiscoveredFragrance, vocabulary: Record<string, number>): number {
  let score = 0
  d.accords.forEach((a, i) => {
    const name = normalize(a.name)
    const key = Object.keys(vocabulary).find((v) => name === v) ?? Object.keys(vocabulary).find((v) => name.includes(v))
    if (key) {
      // Without a strength label, fall back to position (first = strongest).
      const strength = a.strength ? WEIGHT[a.strength] : Math.max(0.3, 1 - i * 0.12)
      score += strength * vocabulary[key]
    }
  })
  return score
}

/** Bright top notes nudge freshness even when no "fresh" accord is listed. */
function freshNoteBonus(d: DiscoveredFragrance) {
  const hits = d.notes.top.filter((n) => FRESH_NOTES.test(n.toLowerCase())).length
  return Math.min(0.6, hits * 0.2)
}

const toScale = (score: number): number => Math.min(5, 1 + Math.round(score * 2.5))

function labelScale(label: string | null, table: [RegExp, number][]): ScaleValue {
  if (!label) return null
  const l = label.toLowerCase()
  for (const [re, v] of table) if (re.test(l)) return v
  return null
}

const SILLAGE: [RegExp, number][] = [
  [/enormous|huge|very strong|beast/, 5],
  [/strong|heavy/, 4],
  [/moderate|average|medium/, 3],
  [/soft|weak|light|close/, 2],
  [/intimate|skin/, 1],
]

const LONGEVITY: [RegExp, number][] = [
  [/eternal|very long/, 5],
  [/long/, 4],
  [/moderate|average|medium/, 3],
  [/very weak|very short|poor/, 1],
  [/weak|short/, 2],
]

/**
 * 1–5 rating for the best-matching tag, relative to the average vote in the
 * ranking: an even spread scores 3, a clear favourite 5, a clear miss 1.
 */
function rankedScale(tags: RankedTag[], keywords: string[]): ScaleValue {
  const valid = tags.filter((t) => t.score >= 0)
  const mean = valid.reduce((s, t) => s + t.score, 0) / (valid.length || 1)
  if (!valid.length || mean <= 0) return null
  const matches = valid.filter((t) => keywords.some((k) => t.name.includes(k)))
  if (!matches.length) return null
  const r = Math.max(...matches.map((t) => t.score)) / mean
  return r >= 1.5 ? 5 : r >= 1.15 ? 4 : r >= 0.85 ? 3 : r >= 0.5 ? 2 : 1
}

const FAMILY_BY_ACCORD: [RegExp, string][] = [
  [/citrus/, 'Citrus'],
  [/aquatic|marine|ozonic/, 'Aquatic'],
  [/fresh/, 'Fresh'],
  [/white floral|floral|rose|tuberose|iris|violet|yellow floral/, 'Floral'],
  [/oud|woody|vetiver|sandal|cedar/, 'Woody'],
  [/amber|warm spicy|balsamic|resinous/, 'Amber'],
  [/vanilla|sweet|caramel|gourmand|chocolate|honey/, 'Gourmand'],
  [/aromatic|lavender|herbal/, 'Aromatic'],
  [/leather|animalic|smoky|tobacco/, 'Leather'],
  [/fruity|tropical|cherry/, 'Fruity'],
  [/green/, 'Green'],
  [/powdery/, 'Powdery'],
  [/musk/, 'Musky'],
  [/spicy/, 'Spicy'],
  [/chypre|mossy/, 'Chypre'],
]

export function familyFromAccords(accords: { name: string }[]): string | null {
  for (const a of accords) {
    const found = FAMILY_BY_ACCORD.find(([re]) => re.test(a.name.toLowerCase()))
    if (found) return found[1]
  }
  return null
}

const capitalize = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase())

export function toFragranceInput(d: DiscoveredFragrance): FragranceInput {
  const hasAccords = d.accords.length > 0
  const notes =
    d.notes.top.length || d.notes.middle.length || d.notes.base.length
      ? d.notes
      : { top: [], middle: d.generalNotes, base: [] }

  return {
    ...blankFragrance(),
    name: d.name,
    brand: d.brand,
    concentration: d.concentration,
    release_year: d.year,
    family: familyFromAccords(d.accords),
    perfumers: d.perfumers,
    notes_top: notes.top.map(capitalize),
    notes_middle: notes.middle.map(capitalize),
    notes_base: notes.base.map(capitalize),
    accords: d.accords.map((a) => a.name),
    sweetness: hasAccords ? toScale(accordScore(d, SWEET)) : null,
    freshness: hasAccords ? toScale(accordScore(d, FRESH) + freshNoteBonus(d)) : null,
    darkness: hasAccords ? toScale(accordScore(d, DARK)) : null,
    masculinity: d.gender === 'men' ? 4 : d.gender === 'women' ? 2 : d.gender === 'unisex' ? 3 : null,
    projection: labelScale(d.sillage, SILLAGE),
    longevity: labelScale(d.longevity, LONGEVITY),
    suit_hot: rankedScale(d.seasons, ['summer']),
    suit_rainy: rankedScale(d.seasons, ['fall', 'autumn']),
    suit_day: rankedScale(d.occasions, ['day', 'daily', 'leisure', 'casual', 'sport']),
    suit_night: rankedScale(d.occasions, ['night', 'evening']),
    suit_office: rankedScale(d.occasions, ['business', 'office', 'professional', 'work']),
    suit_date: rankedScale(d.occasions, ['date', 'romantic', 'night out', 'evening']),
    suit_special: rankedScale(d.occasions, ['formal', 'special', 'party', 'night out', 'evening']),
    info_status: 'unverified',
    ratings_basis: 'community',
    source_links: d.purchaseUrl ? [{ label: 'Where to buy (via Fragella)', url: d.purchaseUrl, kind: 'retailer' }] : [],
    image_url: d.imageUrl,
    image_credit: d.imageUrl ? 'Image via Fragella' : null,
    external_source: d.source,
    external_id: d.ref,
    brand_country: d.country,
  }
}

/** Display-only Fragrance built from a discovered record (no database id). */
export function previewFragrance(d: DiscoveredFragrance) {
  const now = new Date(0).toISOString()
  return {
    ...toFragranceInput(d),
    id: `discover:${d.ref}`,
    owner_id: '',
    is_public: true,
    created_at: now,
    updated_at: now,
  }
}
