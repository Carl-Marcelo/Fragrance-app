import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { DEFAULT_CURRENCY, DEFAULT_LOW_BOTTLE_THRESHOLD } from '../lib/constants'
import { DEFAULT_SPRAY_PROFILE } from '../lib/spray'
import type {
  CollectionEntry,
  Fragrance,
  FragranceInput,
  ItemInput,
  ItemPatch,
  SettingsPatch,
  UserSettings,
  WearLog,
  WearLogInput,
} from '../lib/types'
import type { BackupFile } from '../lib/validation'
import { useAuth, useIsOwner } from '../providers/AuthProvider'

export const keys = {
  publicFragrances: ['fragrances', 'public'] as const,
  fragrance: (id: string) => ['fragrance', id] as const,
  myFragrances: ['fragrances', 'mine'] as const,
  entries: ['entries'] as const,
  wearLogs: ['wearLogs'] as const,
  settings: ['settings'] as const,
  signedUrl: (path: string) => ['signedUrl', path] as const,
}

// ----- Queries ----------------------------------------------------------------

export function usePublicFragrances() {
  return useQuery({ queryKey: keys.publicFragrances, queryFn: () => api.listPublicFragrances() })
}

export function useFragrance(id: string | undefined) {
  return useQuery({
    queryKey: keys.fragrance(id ?? ''),
    queryFn: () => api.getFragrance(id!),
    enabled: Boolean(id),
  })
}

export function useMyFragrances() {
  const { user } = useAuth()
  const owner = useIsOwner()
  return useQuery({
    queryKey: keys.myFragrances,
    queryFn: () => api.listMyFragrances(user!.id),
    enabled: owner && Boolean(user),
  })
}

export function useEntries() {
  const owner = useIsOwner()
  return useQuery({ queryKey: keys.entries, queryFn: () => api.listEntries(), enabled: owner })
}

export function useEntry(id: string | undefined) {
  const query = useEntries()
  return { ...query, data: query.data?.find((e) => e.id === id) }
}

export function useWearLogs() {
  const owner = useIsOwner()
  return useQuery({ queryKey: keys.wearLogs, queryFn: () => api.listWearLogs(), enabled: owner })
}

export function defaultSettings(userId: string): UserSettings {
  return {
    user_id: userId,
    theme: 'system',
    currency: DEFAULT_CURRENCY,
    low_bottle_threshold: DEFAULT_LOW_BOTTLE_THRESHOLD,
    spray_profile: DEFAULT_SPRAY_PROFILE,
    updated_at: new Date(0).toISOString(),
  }
}

/** Settings with defaults filled in; `loaded` tells whether the stored row has arrived. */
export function useSettings() {
  const { user } = useAuth()
  const owner = useIsOwner()
  const query = useQuery({
    queryKey: keys.settings,
    queryFn: () => api.getSettings(user!.id),
    enabled: owner && Boolean(user),
  })
  return {
    ...query,
    stored: query.data ?? null,
    settings: query.data ?? defaultSettings(user?.id ?? ''),
    loaded: query.isSuccess,
  }
}

export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: keys.signedUrl(path ?? ''),
    queryFn: () => api.signedUrl(path!),
    enabled: Boolean(path) && api.supportsUploads,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
  })
}

// ----- Cache helpers ----------------------------------------------------------

function putEntry(qc: QueryClient, entry: CollectionEntry) {
  qc.setQueryData<CollectionEntry[]>(keys.entries, (list) => {
    if (!list) return list
    const i = list.findIndex((e) => e.id === entry.id)
    if (i === -1) return [entry, ...list]
    const next = list.slice()
    next[i] = entry
    return next
  })
}

function invalidateFragrances(qc: QueryClient, fragrance?: Fragrance) {
  qc.invalidateQueries({ queryKey: ['fragrances'] })
  if (fragrance) qc.setQueryData(keys.fragrance(fragrance.id), fragrance)
}

// ----- Mutations --------------------------------------------------------------

export function useSaveEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fragrance, item }: { fragrance: FragranceInput; item: ItemInput }) => api.saveEntry(fragrance, item),
    onSuccess: (entry) => {
      putEntry(qc, entry)
      invalidateFragrances(qc, entry.fragrance)
      // Other entries may share the same fragrance record.
      qc.invalidateQueries({ queryKey: keys.entries })
    },
  })
}

export function useAddToCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fragranceId, item }: { fragranceId: string; item: ItemInput }) =>
      api.addToCollection(fragranceId, item),
    onSuccess: (entry) => putEntry(qc, entry),
  })
}

/** Optimistic: favourites, bottle level and status moves feel instant and roll back on failure. */
export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ItemPatch }) => api.updateItem(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.entries })
      const previous = qc.getQueryData<CollectionEntry[]>(keys.entries)
      qc.setQueryData<CollectionEntry[]>(keys.entries, (list) =>
        list?.map((e) => (e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } : e)),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.entries, ctx.previous)
    },
    onSuccess: (entry) => putEntry(qc, entry),
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entry: CollectionEntry) => api.deleteEntry(entry),
    onSuccess: (_res, entry) => {
      qc.setQueryData<CollectionEntry[]>(keys.entries, (list) => list?.filter((e) => e.id !== entry.id))
      qc.setQueryData<WearLog[]>(keys.wearLogs, (list) => list?.filter((w) => w.collection_item_id !== entry.id))
      invalidateFragrances(qc)
    },
  })
}

export function useSaveFragrance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FragranceInput) => api.saveFragrance(input),
    onSuccess: (fragrance) => {
      invalidateFragrances(qc, fragrance)
      qc.invalidateQueries({ queryKey: keys.entries })
    },
  })
}

export function useUpdateFragrance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<FragranceInput> }) => api.updateFragrance(id, patch),
    onSuccess: (fragrance) => {
      invalidateFragrances(qc, fragrance)
      qc.setQueryData<CollectionEntry[]>(keys.entries, (list) =>
        list?.map((e) => (e.fragrance_id === fragrance.id ? { ...e, fragrance } : e)),
      )
    },
  })
}

export function useDeleteFragrance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteFragrance(id),
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: keys.fragrance(id) })
      invalidateFragrances(qc)
      qc.invalidateQueries({ queryKey: keys.entries })
      qc.invalidateQueries({ queryKey: keys.wearLogs })
    },
  })
}

export function useSaveWearLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: WearLogInput) => api.saveWearLog(input),
    onSuccess: (log) => {
      qc.setQueryData<WearLog[]>(keys.wearLogs, (list) => {
        if (!list) return list
        const rest = list.filter((w) => w.id !== log.id)
        return [log, ...rest].sort((a, b) => b.worn_on.localeCompare(a.worn_on))
      })
    },
  })
}

export function useDeleteWearLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteWearLog(id),
    onSuccess: (_res, id) => qc.setQueryData<WearLog[]>(keys.wearLogs, (list) => list?.filter((w) => w.id !== id)),
  })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (patch: SettingsPatch) => api.saveSettings(user!.id, patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.settings })
      const previous = qc.getQueryData<UserSettings | null>(keys.settings)
      qc.setQueryData<UserSettings | null>(keys.settings, (s) => ({ ...(s ?? defaultSettings(user!.id)), ...patch }))
      return { previous }
    },
    onError: (_err, _patch, ctx) => qc.setQueryData(keys.settings, ctx?.previous ?? null),
    onSuccess: (settings) => qc.setQueryData(keys.settings, settings),
  })
}

export function useImportData() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ data, mode }: { data: BackupFile; mode: 'merge' | 'replace' }) =>
      api.importData(user!.id, data, mode),
    onSettled: () => qc.invalidateQueries(),
  })
}
