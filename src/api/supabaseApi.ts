import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { buildBackup } from '../lib/backup'
import type { BackupFile } from '../lib/validation'
import type { CollectionEntry, Fragrance, WearLog } from '../lib/types'
import {
  fragrancePayload,
  itemPayload,
  normalizeEntry,
  normalizeFragrance,
  normalizeItem,
  normalizeSettings,
  normalizeWearLog,
  pick,
} from './normalize'
import type { Bucket, DataApi } from './types'

const ENTRY_SELECT = '*, fragrance:fragrances(*)'
const CHUNK = 200

/** Turns PostgREST errors into messages a person can act on. */
function fail(error: PostgrestError | Error | null, action: string): never {
  const raw = error?.message ?? 'Unknown error'
  const code = (error as PostgrestError | null)?.code
  let message = `${action} failed: ${raw}`
  if (code === '42501' || /row-level security|permission denied/i.test(raw)) {
    message = `${action} was blocked by the database permissions. Sign in with the owner account.`
  } else if (code === 'PGRST301' || /JWT expired/i.test(raw)) {
    message = 'Your session has expired. Please sign in again.'
  } else if (code === '23514') {
    message = `${action} failed: a value is outside the allowed range.`
  } else if (code === '23505') {
    message = `${action} failed: this fragrance is already in your library.`
  } else if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    message = `${action} failed: can’t reach the server. Check your connection.`
  }
  throw new Error(message, { cause: error })
}

const chunks = <T>(list: T[], size = CHUNK) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

export function createSupabaseApi(sb: SupabaseClient): DataApi {
  const api: DataApi = {
    mode: 'cloud',
    supportsUploads: true,

    async listPublicFragrances() {
      const { data, error } = await sb
        .from('fragrances')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) fail(error, 'Loading the catalog')
      return (data ?? []).map(normalizeFragrance)
    },

    async getFragrance(id) {
      const { data, error } = await sb.from('fragrances').select('*').eq('id', id).maybeSingle()
      if (error) {
        if (error.code === '22P02') return null // not a uuid
        fail(error, 'Loading the fragrance')
      }
      return data ? normalizeFragrance(data) : null
    },

    async listMyFragrances(userId) {
      const { data, error } = await sb
        .from('fragrances')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
      if (error) fail(error, 'Loading your fragrance library')
      return (data ?? []).map(normalizeFragrance)
    },

    async saveFragrance(input) {
      const payload = fragrancePayload(input)
      const query = input.id
        ? sb.from('fragrances').update(payload).eq('id', input.id).select('*').single()
        : sb.from('fragrances').insert(payload).select('*').single()
      const { data, error } = await query
      if (error) fail(error, 'Saving the fragrance')
      return normalizeFragrance(data)
    },

    async updateFragrance(id, patch) {
      const { data, error } = await sb.from('fragrances').update(fragrancePayload(patch)).eq('id', id).select('*').single()
      if (error) fail(error, 'Updating the fragrance')
      return normalizeFragrance(data)
    },

    async deleteFragrance(id) {
      const { data: existing } = await sb.from('fragrances').select('image_path').eq('id', id).maybeSingle()
      const { error } = await sb.from('fragrances').delete().eq('id', id)
      if (error) fail(error, 'Deleting the fragrance')
      if (existing?.image_path) await api.removeImage('fragrance-images', existing.image_path).catch(() => {})
    },

    async listEntries() {
      const { data, error } = await sb.from('collection_items').select(ENTRY_SELECT).order('created_at', { ascending: false })
      if (error) fail(error, 'Loading your collection')
      return (data ?? []).map(normalizeEntry)
    },

    async saveEntry(fragranceInput, itemInput) {
      const isNewFragrance = !fragranceInput.id
      const fragrance = await api.saveFragrance(fragranceInput)
      const payload = { ...itemPayload(itemInput), fragrance_id: fragrance.id }
      const query = itemInput.id
        ? sb.from('collection_items').update(payload).eq('id', itemInput.id).select(ENTRY_SELECT).single()
        : sb.from('collection_items').insert(payload).select(ENTRY_SELECT).single()
      const { data, error } = await query
      if (error) {
        // Don't leave an orphaned fragrance behind if the second write failed.
        if (isNewFragrance) await sb.from('fragrances').delete().eq('id', fragrance.id)
        fail(error, 'Saving your collection record')
      }
      return normalizeEntry(data)
    },

    async addToCollection(fragranceId, item) {
      const { data, error } = await sb
        .from('collection_items')
        .insert({ ...itemPayload(item), fragrance_id: fragranceId })
        .select(ENTRY_SELECT)
        .single()
      if (error) fail(error, 'Adding to your collection')
      return normalizeEntry(data)
    },

    async updateItem(id, patch) {
      const { data, error } = await sb
        .from('collection_items')
        .update(itemPayload(patch))
        .eq('id', id)
        .select(ENTRY_SELECT)
        .single()
      if (error) fail(error, 'Updating your record')
      return normalizeEntry(data)
    },

    async deleteEntry(entry) {
      const { error } = await sb.from('collection_items').delete().eq('id', entry.id)
      if (error) fail(error, 'Deleting the perfume')
      if (entry.bottle_image_path) await api.removeImage('bottle-photos', entry.bottle_image_path).catch(() => {})

      // Remove the private fragrance record too, unless it's published or still referenced.
      if (entry.fragrance.is_public) return { fragranceRemoved: false }
      const { count } = await sb
        .from('collection_items')
        .select('id', { count: 'exact', head: true })
        .eq('fragrance_id', entry.fragrance_id)
      if ((count ?? 0) > 0) return { fragranceRemoved: false }
      await api.deleteFragrance(entry.fragrance_id).catch(() => {})
      return { fragranceRemoved: true }
    },

    async listWearLogs() {
      const { data, error } = await sb.from('wear_logs').select('*').order('worn_on', { ascending: false }).limit(5000)
      if (error) fail(error, 'Loading your wear log')
      return (data ?? []).map(normalizeWearLog)
    },

    async saveWearLog(input) {
      const { id, ...rest } = input
      const query = id
        ? sb.from('wear_logs').update(rest).eq('id', id).select('*').single()
        : sb.from('wear_logs').insert(rest).select('*').single()
      const { data, error } = await query
      if (error) fail(error, 'Saving the wear entry')
      return normalizeWearLog(data)
    },

    async deleteWearLog(id) {
      const { error } = await sb.from('wear_logs').delete().eq('id', id)
      if (error) fail(error, 'Deleting the wear entry')
    },

    async getSettings(userId) {
      const { data, error } = await sb.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
      if (error) fail(error, 'Loading settings')
      return data ? normalizeSettings(data) : null
    },

    async saveSettings(userId, patch) {
      const payload = pick(patch, ['theme', 'currency', 'low_bottle_threshold', 'spray_profile'])
      const { data, error } = await sb
        .from('user_settings')
        .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
        .select('*')
        .single()
      if (error) fail(error, 'Saving settings')
      return normalizeSettings(data)
    },

    async uploadImage(bucket: Bucket, file: File, userId: string) {
      if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
      if (file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.')
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
      const path = `${userId}/${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from(bucket).upload(path, file, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false,
      })
      if (error) fail(error, 'Uploading the image')
      return { path, publicUrl: bucket === 'fragrance-images' ? api.publicUrl(path) : null }
    },

    async signedUrl(path) {
      const { data, error } = await sb.storage.from('bottle-photos').createSignedUrl(path, 60 * 60)
      if (error) return null
      return data.signedUrl
    },

    publicUrl(path) {
      return sb.storage.from('fragrance-images').getPublicUrl(path).data.publicUrl
    },

    async removeImage(bucket, path) {
      const { error } = await sb.storage.from(bucket).remove([path])
      if (error) fail(error, 'Removing the image')
    },

    async getDiscoverUsage() {
      // Months roll over in Philippine time, matching the database function.
      const period = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' })
        .format(new Date())
        .slice(0, 7)
      const { data, error } = await sb.from('api_usage').select('calls').eq('period', period).maybeSingle()
      if (error) return null
      return { period, calls: data?.calls ?? 0 }
    },

    async exportData(userId) {
      const [fragrances, entries, wearLogs, settings] = await Promise.all([
        api.listMyFragrances(userId),
        api.listEntries(),
        api.listWearLogs(),
        api.getSettings(userId),
      ])
      // Include public fragrances referenced by the collection even if owned elsewhere.
      const byId = new Map<string, Fragrance>(fragrances.map((f) => [f.id, f]))
      entries.forEach((e: CollectionEntry) => byId.set(e.fragrance.id, e.fragrance))
      const items = entries.map(({ fragrance: _f, ...item }) => normalizeItem(item))
      return buildBackup({ fragrances: [...byId.values()], items, wearLogs, settings })
    },

    async importData(userId, data: BackupFile, mode) {
      if (mode === 'replace') {
        for (const [table, column] of [
          ['wear_logs', 'user_id'],
          ['collection_items', 'user_id'],
          ['fragrances', 'owner_id'],
        ] as const) {
          const { error } = await sb.from(table).delete().eq(column, userId)
          if (error) fail(error, `Clearing ${table.replace('_', ' ')}`)
        }
      }

      const fragranceRows = data.fragrances.map(({ created_at, id, ...f }) => ({
        id,
        ...fragrancePayload(f),
        ...(created_at ? { created_at } : {}),
      }))
      for (const batch of chunks(fragranceRows)) {
        const { error } = await sb.from('fragrances').upsert(batch, { onConflict: 'id' })
        if (error) fail(error, 'Importing fragrances')
      }

      const itemRows = data.collection_items.map(({ created_at, id, fragrance_id, ...i }) => ({
        id,
        fragrance_id,
        ...itemPayload(i),
        ...(created_at ? { created_at } : {}),
      }))
      for (const batch of chunks(itemRows)) {
        const { error } = await sb.from('collection_items').upsert(batch, { onConflict: 'id' })
        if (error) fail(error, 'Importing collection records')
      }

      const logRows: Partial<WearLog>[] = data.wear_logs.map(({ created_at, ...w }) => ({
        ...w,
        ...(created_at ? { created_at } : {}),
      }))
      for (const batch of chunks(logRows)) {
        const { error } = await sb.from('wear_logs').upsert(batch, { onConflict: 'id' })
        if (error) fail(error, 'Importing the wear log')
      }

      if (data.settings) await api.saveSettings(userId, data.settings)

      return {
        fragrances: fragranceRows.length,
        items: itemRows.length,
        wearLogs: logRows.length,
        settings: Boolean(data.settings),
      }
    },
  }
  return api
}
