// Coerce rows coming from the database or a backup into the exact app shapes.

import { DEFAULT_SPRAY_PROFILE } from '../lib/spray'
import type { CollectionEntry, CollectionItem, Fragrance, FragranceInput, ItemInput, UserSettings, WearLog } from '../lib/types'

type AnyRow = Record<string, unknown>

const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const obj = <T>(v: unknown, fallback: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : fallback)

export function normalizeFragrance(row: AnyRow): Fragrance {
  const f = row as unknown as Fragrance
  return {
    ...f,
    release_year: num(row.release_year),
    perfumers: arr(row.perfumers),
    notes_top: arr(row.notes_top),
    notes_middle: arr(row.notes_middle),
    notes_base: arr(row.notes_base),
    accords: arr(row.accords),
    source_links: Array.isArray(row.source_links) ? (row.source_links as Fragrance['source_links']) : [],
    external_source: row.external_source === 'fragella' ? 'fragella' : null,
    external_id: typeof row.external_id === 'string' ? row.external_id : null,
    brand_country: typeof row.brand_country === 'string' ? row.brand_country : null,
  }
}

export function normalizeItem(row: AnyRow): CollectionItem {
  const i = row as unknown as CollectionItem
  return {
    ...i,
    personal_rating: num(row.personal_rating),
    bottle_size_ml: num(row.bottle_size_ml),
    remaining_percent: num(row.remaining_percent),
    purchase_price: num(row.purchase_price),
    wishlist_priority: num(row.wishlist_priority),
    spray_overrides: obj(row.spray_overrides, {}),
  }
}

export function normalizeEntry(row: AnyRow): CollectionEntry {
  const { fragrance, ...rest } = row
  return { ...normalizeItem(rest), fragrance: normalizeFragrance(fragrance as AnyRow) }
}

export function normalizeWearLog(row: AnyRow): WearLog {
  const w = row as unknown as WearLog
  return { ...w, sprays: num(row.sprays), longevity_hours: num(row.longevity_hours), rating: num(row.rating), compliments: num(row.compliments) }
}

export function normalizeSettings(row: AnyRow): UserSettings {
  const s = row as unknown as UserSettings
  return {
    ...s,
    low_bottle_threshold: num(row.low_bottle_threshold) ?? 20,
    spray_profile: { ...DEFAULT_SPRAY_PROFILE, ...obj(row.spray_profile, {}) },
  }
}

const FRAGRANCE_FIELDS: (keyof FragranceInput)[] = [
  'is_public', 'name', 'brand', 'concentration', 'release_year', 'family', 'perfumers', 'description',
  'notes_top', 'notes_middle', 'notes_base', 'accords', 'sweetness', 'freshness', 'darkness', 'masculinity',
  'projection', 'longevity', 'suit_hot', 'suit_humid', 'suit_rainy', 'suit_aircon', 'suit_day', 'suit_night',
  'suit_office', 'suit_date', 'suit_special', 'info_status', 'ratings_basis', 'source_links', 'image_url',
  'image_path', 'image_credit', 'external_source', 'external_id', 'brand_country',
]

const ITEM_FIELDS: (keyof ItemInput)[] = [
  'status', 'is_favorite', 'personal_rating', 'personal_notes', 'want_reason', 'wishlist_priority',
  'bottle_size_ml', 'remaining_percent', 'is_decant', 'purchase_price', 'currency', 'purchase_date',
  'purchase_from', 'bottle_image_path', 'spray_overrides',
]

/** Only whitelisted, client-writable columns ever reach the database. */
export function pick<T extends object>(source: Partial<T>, fields: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {}
  for (const key of fields) {
    if (key in source && source[key] !== undefined) out[key] = source[key]
  }
  return out
}

export const fragrancePayload = (f: Partial<FragranceInput>) => pick(f, FRAGRANCE_FIELDS)
export const itemPayload = (i: Partial<ItemInput>) => pick(i, ITEM_FIELDS)
