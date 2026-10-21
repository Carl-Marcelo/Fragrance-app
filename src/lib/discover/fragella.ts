// Normalises Fragella API objects (https://api.fragella.com) into
// DiscoveredFragrance. Written defensively: every field is optional, and values
// may arrive as strings, numbers, objects or arrays depending on the record.

import type { Concentration } from '../types'
import type { AccordStrength, DiscoverGender, DiscoveredFragrance, RankedTag } from './types'

type Raw = Record<string, unknown>

const MAX_TEXT = 120

function text(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v.replace(',', '.')) : Number.NaN
  return Number.isFinite(n) ? n : null
}

function httpsUrl(v: unknown): string | null {
  const t = text(v, 600)
  return t && /^https:\/\/[^\s"'<>]+$/i.test(t) ? t : null
}

/** Accepts ["a","b"], [{name:"a"}], "a, b", or "a; b" (Fragella's perfumers field). */
function names(v: unknown, max = 60): string[] {
  let list: unknown[] = []
  if (Array.isArray(v)) list = v
  else if (typeof v === 'string') list = v.split(/[;,]/)
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const raw = typeof item === 'object' && item ? (item as Raw).name ?? (item as Raw).Name : item
    const t = text(raw, 80)
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase())
      out.push(t)
    }
    if (out.length >= max) break
  }
  return out
}

function pick(raw: Raw, ...keys: string[]): unknown {
  for (const k of keys) if (raw[k] != null) return raw[k]
  return undefined
}

export function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export function parseConcentration(label: string | null): Concentration | null {
  if (!label) return null
  const l = label.toLowerCase()
  if (/extrait/.test(l)) return 'extrait'
  if (/elixir/.test(l)) return 'elixir'
  if (/eau de parfum|\bedp\b/.test(l)) return 'edp'
  if (/eau de toilette|\bedt\b/.test(l)) return 'edt'
  if (/eau de cologne|\bedc\b/.test(l)) return 'edc'
  if (/body mist|mist|splash/.test(l)) return 'body_mist'
  if (/oil|attar|ittar/.test(l)) return 'oil'
  if (/parfum|perfume|pure/.test(l)) return 'parfum'
  if (/cologne/.test(l)) return 'cologne'
  return 'other'
}

export function parseGender(v: unknown): DiscoverGender | null {
  const t = text(v)?.toLowerCase()
  if (!t) return null
  const fem = /women|female|feminine|\bher\b/.test(t)
  const masc = /\bmen\b|\bmale\b|masculine|\bhim\b/.test(t)
  if (/unisex|shared|both/.test(t) || (fem && masc)) return 'unisex'
  if (fem) return 'women'
  if (masc) return 'men'
  return null
}

function parseStrength(v: unknown): AccordStrength | null {
  const t = text(v)?.toLowerCase() ?? ''
  if (t.includes('dominant')) return 'dominant'
  if (t.includes('prominent')) return 'prominent'
  if (t.includes('moderate')) return 'moderate'
  if (t.includes('subtle') || t.includes('light') || t.includes('minor')) return 'subtle'
  const n = num(v)
  if (n == null) return null
  const pct = n <= 1 ? n * 100 : n
  return pct >= 75 ? 'dominant' : pct >= 50 ? 'prominent' : pct >= 25 ? 'moderate' : 'subtle'
}

const STRENGTH_ORDER: Record<AccordStrength, number> = { dominant: 4, prominent: 3, moderate: 2, subtle: 1 }

function ranked(v: unknown): RankedTag[] {
  const out: RankedTag[] = []
  if (Array.isArray(v)) {
    for (const item of v) {
      if (!item || typeof item !== 'object') continue
      const name = text((item as Raw).name ?? (item as Raw).Name, 40)
      const score = num((item as Raw).score ?? (item as Raw).Score ?? (item as Raw).value)
      if (name && score != null) out.push({ name: name.toLowerCase(), score })
    }
  } else if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Raw)) {
      const score = num(val)
      if (score != null) out.push({ name: k.toLowerCase().slice(0, 40), score })
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12)
}

export function normalizeFragella(raw: Raw): DiscoveredFragrance | null {
  const name = text(pick(raw, 'Name', 'name'), 200)
  const brand = text(pick(raw, 'Brand', 'brand'), 200)
  if (!name || !brand) return null

  const concentrationLabel = text(pick(raw, 'OilType', 'Oil Type', 'Concentration'), 60)
  const yearNum = num(pick(raw, 'Year', 'year'))
  const notesRaw = (pick(raw, 'Notes', 'notes') ?? {}) as Raw

  // Accords ordered strongest first; keep the API's order within the same strength.
  const accordNames = names(pick(raw, 'Main Accords', 'Accords', 'accords'), 20).map((a) => a.toLowerCase())
  const strengths = (pick(raw, 'Main Accords Percentage', 'Accords Percentage') ?? {}) as Raw
  const strengthOf = (accord: string) => {
    const key = Object.keys(strengths).find((k) => k.toLowerCase() === accord)
    return key ? parseStrength(strengths[key]) : null
  }
  const accords = accordNames
    .map((n, i) => ({ name: n, strength: strengthOf(n), i }))
    .sort((a, b) => (b.strength ? STRENGTH_ORDER[b.strength] : 0) - (a.strength ? STRENGTH_ORDER[a.strength] : 0) || a.i - b.i)
    .map(({ name: n, strength }) => ({ name: n, strength }))

  const id = text(pick(raw, '_id', 'id', 'ID'), 120)
  const perfumers = names(pick(raw, 'perfumers', 'Perfumers', 'Perfumer'), 10)

  return {
    ref: id ? slug(id) || `${slug(brand)}--${slug(name)}` : `${slug(brand)}--${slug(name)}`,
    source: 'fragella',
    name,
    brand,
    year: yearNum && yearNum >= 1700 && yearNum <= 2100 ? Math.round(yearNum) : null,
    country: text(pick(raw, 'Country', 'country'), 80),
    gender: parseGender(pick(raw, 'Gender', 'gender')),
    concentration: parseConcentration(concentrationLabel),
    concentrationLabel,
    imageUrl:
      httpsUrl(pick(raw, 'Image URL', 'Image', 'image')) ??
      httpsUrl(pick(raw, 'Image URL Transparent')) ??
      (Array.isArray(raw['Image Fallbacks']) ? httpsUrl((raw['Image Fallbacks'] as unknown[])[0]) : null),
    perfumers,
    notes: {
      top: names(pick(notesRaw, 'Top', 'top')),
      middle: names(pick(notesRaw, 'Middle', 'Heart', 'middle', 'heart')),
      base: names(pick(notesRaw, 'Base', 'base')),
    },
    generalNotes: names(pick(raw, 'General Notes', 'Notes List')),
    accords,
    longevity: text(pick(raw, 'Longevity', 'longevity'), 40),
    sillage: text(pick(raw, 'Sillage', 'sillage'), 40),
    seasons: ranked(pick(raw, 'Season Ranking', 'Seasons')),
    occasions: ranked(pick(raw, 'Occasion Ranking', 'Occasions')),
    rating: (() => {
      const r = num(pick(raw, 'rating', 'Rating'))
      return r != null && r >= 0 && r <= 10 ? Math.round(r * 100) / 100 : null
    })(),
    purchaseUrl: httpsUrl(pick(raw, 'Purchase URL', 'purchaseUrl')),
  }
}

/**
 * Accepts an array, {data: [...]} (paginated search), {similar_fragrances: [...]}
 * (/fragrances/similar), {results|fragrances|items: [...]} or a single object.
 */
export function normalizeFragellaList(payload: unknown): DiscoveredFragrance[] {
  let list: unknown[] = []
  if (Array.isArray(payload)) list = payload
  else if (payload && typeof payload === 'object') {
    const p = payload as Raw
    const inner = p.data ?? p.similar_fragrances ?? p.results ?? p.fragrances ?? p.items
    list = Array.isArray(inner) ? inner : p.Name || p.name ? [p] : []
  }
  const out: DiscoveredFragrance[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const f = normalizeFragella(item as Raw)
    if (f && !seen.has(f.ref)) {
      seen.add(f.ref)
      out.push(f)
    }
  }
  return out
}
