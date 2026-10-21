// Similarity and recommendation helpers. Everything is derived from data the
// owner has saved: nothing is fetched or invented.

import { allNotes, normalize } from './filters'
import { scenarioScore } from './spray'
import type { CollectionEntry, Fragrance, Scenario, WearLog } from './types'

const SCALE_KEYS = ['sweetness', 'freshness', 'darkness', 'masculinity'] as const

function jaccard(a: string[], b: string[]): number | null {
  if (!a.length || !b.length) return null
  const A = new Set(a.map(normalize))
  const B = new Set(b.map(normalize))
  let inter = 0
  A.forEach((x) => B.has(x) && inter++)
  return inter / (A.size + B.size - inter)
}

/** 0–1 similarity, re-weighted to whatever data both fragrances actually have. */
export function similarity(a: Fragrance, b: Fragrance): number {
  const parts: [number, number][] = []
  const acc = jaccard(a.accords, b.accords)
  if (acc != null) parts.push([acc, 0.4])
  const notes = jaccard(allNotes(a), allNotes(b))
  if (notes != null) parts.push([notes, 0.3])
  if (a.family && b.family) parts.push([normalize(a.family) === normalize(b.family) ? 1 : 0, 0.15])
  const scaleDiffs = SCALE_KEYS.filter((k) => a[k] != null && b[k] != null).map(
    (k) => 1 - Math.abs((a[k] as number) - (b[k] as number)) / 4,
  )
  if (scaleDiffs.length) parts.push([scaleDiffs.reduce((x, y) => x + y, 0) / scaleDiffs.length, 0.15])
  if (!parts.length) return 0
  const weight = parts.reduce((s, [, w]) => s + w, 0)
  return parts.reduce((s, [v, w]) => s + v * w, 0) / weight
}

export function sharedValues(a: string[], b: string[]): string[] {
  const B = new Set(b.map(normalize))
  return a.filter((x) => B.has(normalize(x)))
}

export interface Match<T> {
  target: T
  score: number
}

export function mostSimilar<T extends { fragrance: Fragrance } | Fragrance>(
  to: Fragrance,
  pool: T[],
  limit = 3,
  minScore = 0.15,
): Match<T>[] {
  const frag = (x: T): Fragrance => ('fragrance' in x ? x.fragrance : x)
  return pool
    .filter((x) => frag(x).id !== to.id)
    .map((x) => ({ target: x, score: similarity(to, frag(x)) }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Catalog fragrances the owner doesn't have yet, ranked by closeness to favourites and top-rated owned bottles. */
export function recommendFromCatalog(
  catalog: Fragrance[],
  entries: CollectionEntry[],
  limit = 6,
): { fragrance: Fragrance; score: number; because: CollectionEntry }[] {
  const known = new Set(entries.map((e) => e.fragrance_id))
  const basis = entries
    .filter((e) => e.status === 'owned' && (e.is_favorite || (e.personal_rating ?? 0) >= 8))
    .slice(0, 30)
  if (!basis.length) return []
  return catalog
    .filter((f) => !known.has(f.id))
    .map((f) => {
      let best = { score: 0, because: basis[0] }
      for (const b of basis) {
        const s = similarity(f, b.fragrance)
        if (s > best.score) best = { score: s, because: b }
      }
      return { fragrance: f, ...best }
    })
    .filter((r) => r.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Owned bottles ranked for a scenario, using saved suitability and the spray engine. */
export function bestForScenario(owned: CollectionEntry[], scenario: Scenario, limit = 3) {
  return owned
    .filter((e) => e.status === 'owned' && (e.remaining_percent ?? 100) > 0)
    .map((e) => ({
      entry: e,
      score: scenarioScore(e.fragrance, scenario) + (e.personal_rating ?? 5) * 1.5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export interface WishlistComparison {
  wish: CollectionEntry
  closest: Match<CollectionEntry>[]
  newAccords: string[]
  verdict: string
}

/** For each wishlist item: the closest owned bottles and what it would add. */
export function compareWishlist(wishlist: CollectionEntry[], owned: CollectionEntry[]): WishlistComparison[] {
  const ownedAccords = new Set(owned.flatMap((e) => e.fragrance.accords.map(normalize)))
  return wishlist.map((wish) => {
    const closest = mostSimilar(wish.fragrance, owned, 3, 0.1)
    const newAccords = wish.fragrance.accords.filter((a) => !ownedAccords.has(normalize(a)))
    const top = closest[0]?.score ?? 0
    const hasData = wish.fragrance.accords.length > 0 || allNotes(wish.fragrance).length > 0
    let verdict: string
    if (!hasData) verdict = 'Add notes or accords to compare this with your collection.'
    else if (!owned.length) verdict = 'Nothing owned yet to compare against.'
    else if (top >= 0.6) verdict = `Very close to ${closest[0].target.fragrance.name}. It may duplicate what you have.`
    else if (top >= 0.35) verdict = 'Related to bottles you own, with its own character.'
    else verdict = 'Different from everything you own. It would fill a gap.'
    return { wish, closest, newAccords, verdict }
  })
}

export interface CollectionInsight {
  title: string
  detail: string
}

/** Observations about gaps or concentration in the collection, based only on recorded data. */
export function collectionInsights(owned: CollectionEntry[]): CollectionInsight[] {
  const insights: CollectionInsight[] = []
  const active = owned.filter((e) => e.status === 'owned')
  if (active.length < 3) return insights

  const checks = [
    ['suit_hot', 'hot weather'],
    ['suit_office', 'the office'],
    ['suit_date', 'date nights'],
    ['suit_special', 'special occasions'],
  ] as const
  for (const [key, label] of checks) {
    const r = active.filter((e) => e.fragrance[key] != null)
    if (r.length >= 3 && !r.some((e) => (e.fragrance[key] ?? 0) >= 4)) {
      insights.push({
        title: `Nothing rated for ${label}`,
        detail: `None of the ${r.length} bottles with a ${label} rating score 4 or higher.`,
      })
    }
  }

  const avg = (key: 'sweetness' | 'freshness') => {
    const vals = active.map((e) => e.fragrance[key]).filter((v): v is number => v != null)
    return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const sweet = avg('sweetness')
  const fresh = avg('freshness')
  if (sweet != null && sweet >= 3.8) {
    insights.push({
      title: 'Leans sweet',
      detail: `Average sweetness is ${sweet.toFixed(1)} of 5. A dry or fresh scent would add range for hot days.`,
    })
  }
  if (fresh != null && fresh >= 3.8) {
    insights.push({
      title: 'Leans fresh',
      detail: `Average freshness is ${fresh.toFixed(1)} of 5. A warmer scent could cover evenings and rainy days.`,
    })
  }

  const families = new Map<string, number>()
  active.forEach((e) => e.fragrance.family && families.set(e.fragrance.family, (families.get(e.fragrance.family) ?? 0) + 1))
  const [topFamily, topCount] = [...families.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  if (topFamily && topCount && topCount / active.length >= 0.5 && active.length >= 4) {
    insights.push({
      title: `Mostly ${topFamily.toLowerCase()}`,
      detail: `${topCount} of ${active.length} owned bottles are ${topFamily.toLowerCase()}.`,
    })
  }
  return insights
}

/** Owned bottles not worn within the given window, according to the wear log. */
export function unwornRecently(owned: CollectionEntry[], logs: WearLog[], days = 45, now = new Date()) {
  const last = new Map<string, string>()
  for (const l of logs) {
    const prev = last.get(l.collection_item_id)
    if (!prev || l.worn_on > prev) last.set(l.collection_item_id, l.worn_on)
  }
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffIso = cutoff.toISOString().slice(0, 10)
  return owned
    .filter((e) => e.status === 'owned')
    .map((e) => ({ entry: e, lastWorn: last.get(e.id) ?? null }))
    .filter((x) => !x.lastWorn || x.lastWorn < cutoffIso)
}
