import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '../api'
import { DiscoverError, discoverApi, normalizeQuery } from '../api/discover'
import { blankItem } from '../lib/defaults'
import { toFragranceInput } from '../lib/discover/toFragrance'
import type { DiscoverGender, DiscoverResponse, DiscoveredFragrance } from '../lib/discover/types'
import type { CollectionEntry, CollectionStatus, Fragrance } from '../lib/types'
import { keys, useEntries, useMyFragrances, useSettings } from './queries'

const STALE = 60 * 60 * 1000

// Retrying a limit or configuration error only wastes quota.
const retry = (count: number, error: unknown) =>
  count < 1 && error instanceof DiscoverError && (error.code === 'network' || error.code === 'provider_error')

export function useDiscoverStatus() {
  return useQuery({ queryKey: ['discover-status'], queryFn: () => discoverApi.status(), staleTime: 5 * 60 * 1000 })
}

export function useDiscoverSearch(q: string, gender: DiscoverGender | null, page = 1) {
  const term = normalizeQuery(q)
  return useQuery({
    queryKey: ['discover', 'search', term, gender, page],
    queryFn: () => discoverApi.search(term, { gender, page }),
    enabled: term.length >= 3,
    staleTime: STALE,
    gcTime: STALE,
    retry,
    placeholderData: (prev) => prev,
  })
}

export function useDiscoverBrand(name: string | null) {
  return useQuery({
    queryKey: ['discover', 'brand', name],
    queryFn: () => discoverApi.brand(name!),
    enabled: Boolean(name),
    staleTime: STALE,
    gcTime: STALE,
    retry,
  })
}

export function useDiscoverSimilar(name: string | null) {
  return useQuery({
    queryKey: ['discover', 'similar', name ? normalizeQuery(name) : null],
    queryFn: () => discoverApi.similar(name!),
    enabled: Boolean(name),
    staleTime: STALE,
    gcTime: STALE,
    retry,
  })
}

/**
 * Finds a discovered fragrance by ref: first in anything already loaded this
 * session (free), otherwise via a search for "brand name" (CDN-cached).
 */
export function useDiscoveredFragrance(ref: string | undefined, hint: string | null) {
  const qc = useQueryClient()
  const cached = useMemo(() => {
    if (!ref) return undefined
    for (const [, data] of qc.getQueriesData<DiscoverResponse>({ queryKey: ['discover'] })) {
      const hit = data?.results?.find((r) => r.ref === ref)
      if (hit) return hit
    }
    return undefined
  }, [qc, ref])

  const search = useQuery({
    queryKey: ['discover', 'search', normalizeQuery(hint ?? ''), null, 1],
    queryFn: () => discoverApi.search(hint!),
    enabled: !cached && Boolean(hint && hint.trim().length >= 3),
    staleTime: STALE,
    gcTime: STALE,
    retry,
  })

  const found = cached ?? search.data?.results.find((r) => r.ref === ref)
  return {
    data: found,
    isPending: !cached && search.isPending && search.fetchStatus !== 'idle',
    isError: !cached && search.isError,
    error: search.error,
    notFound: !cached && search.isSuccess && !found,
    refetch: search.refetch,
  }
}

/** Where (if anywhere) a discovered fragrance already sits in the owner's journal. */
export function useJournalMatch(d: DiscoveredFragrance | undefined) {
  const entries = useEntries()
  const library = useMyFragrances()
  return useMemo(() => {
    if (!d) return { entry: undefined, fragrance: undefined }
    const isMatch = (f: Fragrance) => f.external_source === d.source && f.external_id === d.ref
    return {
      entry: entries.data?.find((e) => isMatch(e.fragrance)),
      fragrance: library.data?.find(isMatch),
    }
  }, [d, entries.data, library.data])
}

/** Adds a discovered fragrance to the collection or wishlist, reusing an existing library record. */
export function useAddDiscovered() {
  const qc = useQueryClient()
  const library = useMyFragrances()
  const { settings } = useSettings()
  return useMutation({
    mutationFn: async ({ d, status }: { d: DiscoveredFragrance; status: CollectionStatus }): Promise<CollectionEntry> => {
      const item = blankItem(status, settings.currency)
      const existing = library.data?.find((f) => f.external_source === d.source && f.external_id === d.ref)
      if (existing) return api.addToCollection(existing.id, item)
      return api.saveEntry(toFragranceInput(d), item)
    },
    onSuccess: (entry) => {
      qc.setQueryData<CollectionEntry[]>(keys.entries, (list) => (list ? [entry, ...list.filter((e) => e.id !== entry.id)] : list))
      qc.invalidateQueries({ queryKey: ['fragrances'] })
    },
  })
}
