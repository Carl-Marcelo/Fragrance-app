// Runtime validation for forms and JSON imports. Limits mirror the database
// CHECK constraints so problems surface before a round trip.

import { z } from 'zod'

// Zod's JIT uses `new Function`, which the Content-Security-Policy forbids.
z.config({ jitless: true })

const CONCENTRATION_VALUES = [
  'body_mist',
  'edc',
  'cologne',
  'edt',
  'edp',
  'parfum',
  'extrait',
  'elixir',
  'oil',
  'other',
] as const

const SCENARIO_VALUES = ['hot_day', 'normal_day', 'office', 'night_date', 'special'] as const

const scale = z.number().int().min(1).max(5).nullable()
const tags = (max: number) => z.array(z.string().trim().min(1).max(80)).max(max)
const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep this under ${max} characters`)
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null))
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')

export const sourceLinkSchema = z.object({
  label: z.string().trim().max(120).default(''),
  url: z.url({ protocol: /^https?$/, error: 'Enter a full web address starting with https://' }),
  kind: z.enum(['official', 'reference', 'retailer', 'other']).default('other'),
})

export const fragranceInputSchema = z.object({
  id: z.uuid().optional(),
  is_public: z.boolean().default(false),
  name: z.string().trim().min(1, 'Name is required').max(200),
  brand: z.string().trim().min(1, 'Brand is required').max(200),
  concentration: z.enum(CONCENTRATION_VALUES).nullable(),
  release_year: z.number().int().min(1700, 'Year looks too early').max(2100, 'Year looks too late').nullable(),
  family: optionalText(60),
  perfumers: tags(10),
  description: optionalText(4000),
  notes_top: tags(60),
  notes_middle: tags(60),
  notes_base: tags(60),
  accords: tags(20),
  sweetness: scale,
  freshness: scale,
  darkness: scale,
  masculinity: scale,
  projection: scale,
  longevity: scale,
  suit_hot: scale,
  suit_humid: scale,
  suit_rainy: scale,
  suit_aircon: scale,
  suit_day: scale,
  suit_night: scale,
  suit_office: scale,
  suit_date: scale,
  suit_special: scale,
  info_status: z.enum(['verified', 'unverified', 'needs_review']),
  ratings_basis: z.enum(['personal', 'estimate', 'community']),
  source_links: z.array(sourceLinkSchema).max(20),
  image_url: z
    .string()
    .trim()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => v == null || /^https:\/\/\S+$/i.test(v), 'Image links must start with https://'),
  image_path: z.string().max(300).nullable(),
  image_credit: optionalText(300),
  // Optional with defaults so backups made before discovery existed still import.
  external_source: z.enum(['fragella']).nullable().default(null),
  external_id: z.string().min(1).max(200).nullable().default(null),
  brand_country: optionalText(80).default(null),
})

const sprayOverrideSchema = z.object({
  min: z.number().int().min(0).max(30).nullable().optional(),
  max: z.number().int().min(0).max(30).nullable().optional(),
  note: z.string().max(300).nullable().optional(),
})

export const sprayOverridesSchema = z.partialRecord(z.enum(SCENARIO_VALUES), sprayOverrideSchema)

export const itemInputSchema = z.object({
  id: z.uuid().optional(),
  status: z.enum(['owned', 'wishlist', 'previously_owned']),
  is_favorite: z.boolean(),
  personal_rating: z.number().min(0).max(10).nullable(),
  personal_notes: optionalText(8000),
  want_reason: optionalText(2000),
  wishlist_priority: z.number().int().min(1).max(3).nullable(),
  bottle_size_ml: z.number().positive('Must be more than 0').max(5000).nullable(),
  remaining_percent: z.number().int().min(0).max(100).nullable(),
  is_decant: z.boolean(),
  purchase_price: z.number().min(0, 'Price can’t be negative').max(9_999_999_999).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code'),
  purchase_date: isoDate.nullable(),
  purchase_from: optionalText(200),
  bottle_image_path: z.string().max(300).nullable(),
  spray_overrides: sprayOverridesSchema,
})

export const wearLogInputSchema = z.object({
  id: z.uuid().optional(),
  collection_item_id: z.uuid('Choose a perfume'),
  worn_on: isoDate,
  scenario: z.enum(SCENARIO_VALUES).nullable(),
  weather: z.enum(['hot', 'humid', 'rainy', 'mild', 'aircon']).nullable(),
  sprays: z.number().int().min(0).max(30).nullable(),
  longevity_hours: z.number().min(0).max(72).nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  compliments: z.number().int().min(0).max(100).nullable(),
  notes: optionalText(2000),
})

export const sprayProfileSchema = z.object({
  globalOffset: z.number().int().min(-2).max(2).default(0),
  scenarioOffsets: z.partialRecord(z.enum(SCENARIO_VALUES), z.number().int().min(-2).max(2)).default({}),
  application: z.enum(['auto', 'skin', 'clothing', 'both']).default('auto'),
})

// ----- Backup file ------------------------------------------------------------

export const BACKUP_APP = 'sillage'
export const BACKUP_VERSION = 1
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024

const timestamp = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid timestamp')

const backupFragrance = fragranceInputSchema.extend({
  id: z.uuid(),
  created_at: timestamp.optional(),
})

const backupItem = itemInputSchema.extend({
  id: z.uuid(),
  fragrance_id: z.uuid(),
  created_at: timestamp.optional(),
})

const backupWearLog = wearLogInputSchema.extend({
  id: z.uuid(),
  created_at: timestamp.optional(),
})

export const backupSchema = z
  .object({
    app: z.literal(BACKUP_APP, 'This file was not exported from Sillage'),
    version: z.literal(BACKUP_VERSION, `Unsupported backup version (expected ${BACKUP_VERSION})`),
    exported_at: timestamp,
    fragrances: z.array(backupFragrance).max(5000),
    collection_items: z.array(backupItem).max(5000),
    wear_logs: z.array(backupWearLog).max(20000),
    settings: z
      .object({
        theme: z.enum(['light', 'dark', 'system']),
        currency: z.string().regex(/^[A-Z]{3}$/),
        low_bottle_threshold: z.number().int().min(1).max(90),
        spray_profile: sprayProfileSchema,
      })
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const fragranceIds = new Set(data.fragrances.map((f) => f.id))
    const itemIds = new Set(data.collection_items.map((i) => i.id))
    if (fragranceIds.size !== data.fragrances.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate fragrance ids', path: ['fragrances'] })
    }
    if (itemIds.size !== data.collection_items.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate collection item ids', path: ['collection_items'] })
    }
    data.collection_items.forEach((item, i) => {
      if (!fragranceIds.has(item.fragrance_id)) {
        ctx.addIssue({
          code: 'custom',
          message: 'References a fragrance that is not in the file',
          path: ['collection_items', i, 'fragrance_id'],
        })
      }
    })
    data.wear_logs.forEach((log, i) => {
      if (!itemIds.has(log.collection_item_id)) {
        ctx.addIssue({
          code: 'custom',
          message: 'References a collection item that is not in the file',
          path: ['wear_logs', i, 'collection_item_id'],
        })
      }
    })
  })

export type BackupFile = z.infer<typeof backupSchema>

/** Flattens zod issues into "path: message" strings for display. */
export function describeIssues(error: z.ZodError, limit = 12): string[] {
  const lines = error.issues.slice(0, limit).map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'file'
    return `${path}: ${issue.message}`
  })
  if (error.issues.length > limit) lines.push(`…and ${error.issues.length - limit} more problem(s)`)
  return lines
}

/** Maps zod issues to a flat field → message record for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
