// Local preview adapter: same interface as the cloud API, stored in this
// browser's localStorage. Used only when Supabase isn't configured, so the app
// can be explored before cloud setup. It is not a substitute for cloud sync.

import { buildBackup } from '../lib/backup'
import { DEFAULT_SPRAY_PROFILE } from '../lib/spray'
import type { CollectionEntry, CollectionItem, Fragrance, UserSettings, WearLog } from '../lib/types'
import { fragrancePayload, itemPayload, normalizeFragrance, normalizeItem } from './normalize'
import type { DataApi } from './types'

export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001'
const KEY = 'sillage.local.v1'

interface LocalDb {
  fragrances: Fragrance[]
  items: CollectionItem[]
  wearLogs: WearLog[]
  settings: UserSettings | null
}

const empty = (): LocalDb => ({ fragrances: [], items: [], wearLogs: [], settings: null })

function load(): LocalDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const db: LocalDb = { ...empty(), ...JSON.parse(raw) }
    db.fragrances = db.fragrances.map((f) => normalizeFragrance(f as unknown as Record<string, unknown>))
    return db
  } catch {
    return empty()
  }
}

function persist(db: LocalDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    throw new Error('This browser’s local storage is full or unavailable.')
  }
}

const now = () => new Date().toISOString()
const clone = <T>(v: T): T => structuredClone(v)

function join(db: LocalDb, item: CollectionItem): CollectionEntry {
  const fragrance = db.fragrances.find((f) => f.id === item.fragrance_id)
  if (!fragrance) throw new Error('Fragrance record is missing.')
  return clone({ ...item, fragrance })
}

function upsertFragrance(db: LocalDb, input: Partial<Fragrance> & { id?: string }): Fragrance {
  const payload = fragrancePayload(input)
  const existing = input.id ? db.fragrances.find((f) => f.id === input.id) : undefined
  if (existing) {
    Object.assign(existing, payload, { updated_at: now() })
    return existing
  }
  // Mirrors the database's unique index on (owner, external_source, external_id).
  if (
    payload.external_id &&
    db.fragrances.some((f) => f.external_source === payload.external_source && f.external_id === payload.external_id)
  ) {
    throw new Error('This fragrance is already in your library.')
  }
  const created = {
    id: input.id ?? crypto.randomUUID(),
    owner_id: LOCAL_USER_ID,
    created_at: input.created_at ?? now(),
    updated_at: now(),
    ...payload,
  } as Fragrance
  db.fragrances.unshift(created)
  return created
}

function upsertItem(db: LocalDb, input: Partial<CollectionItem> & { fragrance_id: string }): CollectionItem {
  const payload = itemPayload(input)
  const existing = input.id ? db.items.find((i) => i.id === input.id) : undefined
  if (existing) {
    if (payload.status && payload.status !== existing.status) existing.status_changed_at = now()
    Object.assign(existing, payload, { fragrance_id: input.fragrance_id, updated_at: now() })
    return existing
  }
  const created = normalizeItem({
    id: input.id ?? crypto.randomUUID(),
    user_id: LOCAL_USER_ID,
    fragrance_id: input.fragrance_id,
    status: 'owned',
    is_favorite: false,
    is_decant: false,
    currency: 'PHP',
    spray_overrides: {},
    created_at: input.created_at ?? now(),
    updated_at: now(),
    status_changed_at: now(),
    ...payload,
  })
  db.items.unshift(created)
  return created
}

export function createLocalApi(): DataApi {
  const api: DataApi = {
    mode: 'local',
    supportsUploads: false,

    async listPublicFragrances() {
      return clone(load().fragrances.filter((f) => f.is_public))
    },
    async getFragrance(id) {
      return clone(load().fragrances.find((f) => f.id === id) ?? null)
    },
    async listMyFragrances() {
      return clone(load().fragrances)
    },
    async saveFragrance(input) {
      const db = load()
      const f = upsertFragrance(db, input)
      persist(db)
      return clone(f)
    },
    async updateFragrance(id, patch) {
      const db = load()
      if (!db.fragrances.some((f) => f.id === id)) throw new Error('Fragrance not found.')
      const f = upsertFragrance(db, { ...patch, id })
      persist(db)
      return clone(f)
    },
    async deleteFragrance(id) {
      const db = load()
      const itemIds = new Set(db.items.filter((i) => i.fragrance_id === id).map((i) => i.id))
      db.fragrances = db.fragrances.filter((f) => f.id !== id)
      db.items = db.items.filter((i) => !itemIds.has(i.id))
      db.wearLogs = db.wearLogs.filter((w) => !itemIds.has(w.collection_item_id))
      persist(db)
    },

    async listEntries() {
      const db = load()
      return db.items.map((i) => join(db, i))
    },
    async saveEntry(fragranceInput, itemInput) {
      const db = load()
      const f = upsertFragrance(db, fragranceInput)
      const item = upsertItem(db, { ...itemInput, fragrance_id: f.id })
      persist(db)
      return join(db, item)
    },
    async addToCollection(fragranceId, item) {
      const db = load()
      const created = upsertItem(db, { ...item, id: undefined, fragrance_id: fragranceId })
      persist(db)
      return join(db, created)
    },
    async updateItem(id, patch) {
      const db = load()
      const existing = db.items.find((i) => i.id === id)
      if (!existing) throw new Error('Record not found.')
      const item = upsertItem(db, { ...patch, id, fragrance_id: existing.fragrance_id })
      persist(db)
      return join(db, item)
    },
    async deleteEntry(entry) {
      const db = load()
      db.items = db.items.filter((i) => i.id !== entry.id)
      db.wearLogs = db.wearLogs.filter((w) => w.collection_item_id !== entry.id)
      const stillUsed = db.items.some((i) => i.fragrance_id === entry.fragrance_id)
      const remove = !entry.fragrance.is_public && !stillUsed
      if (remove) db.fragrances = db.fragrances.filter((f) => f.id !== entry.fragrance_id)
      persist(db)
      return { fragranceRemoved: remove }
    },

    async listWearLogs() {
      return clone(load().wearLogs).sort((a, b) => b.worn_on.localeCompare(a.worn_on))
    },
    async saveWearLog(input) {
      const db = load()
      if (!db.items.some((i) => i.id === input.collection_item_id)) throw new Error('Perfume not found.')
      const existing = input.id ? db.wearLogs.find((w) => w.id === input.id) : undefined
      if (existing) {
        Object.assign(existing, input)
        persist(db)
        return clone(existing)
      }
      const created: WearLog = { ...input, id: crypto.randomUUID(), user_id: LOCAL_USER_ID, created_at: now() }
      db.wearLogs.unshift(created)
      persist(db)
      return clone(created)
    },
    async deleteWearLog(id) {
      const db = load()
      db.wearLogs = db.wearLogs.filter((w) => w.id !== id)
      persist(db)
    },

    async getSettings() {
      return clone(load().settings)
    },
    async saveSettings(_userId, patch) {
      const db = load()
      db.settings = {
        user_id: LOCAL_USER_ID,
        theme: 'system',
        currency: 'PHP',
        low_bottle_threshold: 20,
        spray_profile: DEFAULT_SPRAY_PROFILE,
        ...db.settings,
        ...patch,
        updated_at: now(),
      }
      persist(db)
      return clone(db.settings)
    },

    async uploadImage() {
      throw new Error('Image uploads need cloud storage. Paste an image link instead.')
    },
    async signedUrl() {
      return null
    },
    publicUrl() {
      return null
    },
    async removeImage() {},

    async getDiscoverUsage() {
      return null
    },

    async exportData() {
      const db = load()
      return buildBackup({ fragrances: db.fragrances, items: db.items, wearLogs: db.wearLogs, settings: db.settings })
    },
    async importData(_userId, data, mode) {
      const db = mode === 'replace' ? { ...empty(), settings: load().settings } : load()
      data.fragrances.forEach((f) => upsertFragrance(db, f))
      data.collection_items.forEach((i) => upsertItem(db, i))
      for (const w of data.wear_logs) {
        const existing = db.wearLogs.find((x) => x.id === w.id)
        if (existing) Object.assign(existing, w)
        else db.wearLogs.push({ ...w, user_id: LOCAL_USER_ID, created_at: w.created_at ?? now() })
      }
      if (data.settings) db.settings = { user_id: LOCAL_USER_ID, ...data.settings, updated_at: now() }
      persist(db)
      return {
        fragrances: data.fragrances.length,
        items: data.collection_items.length,
        wearLogs: data.wear_logs.length,
        settings: Boolean(data.settings),
      }
    },
  }
  return api
}
