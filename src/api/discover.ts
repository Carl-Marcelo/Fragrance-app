// Browser client for the discovery proxy (api/discover/*). Queries are
// normalised so identical searches share the same CDN-cached response.

import type {
  DiscoverErrorBody,
  DiscoverErrorCode,
  DiscoverGender,
  DiscoverResponse,
} from '../lib/discover/types'

export class DiscoverError extends Error {
  readonly code: DiscoverErrorCode | 'network'
  constructor(code: DiscoverErrorCode | 'network', message: string) {
    super(message)
    this.code = code
  }
}

export const normalizeQuery = (q: string) => q.toLowerCase().replace(/\s+/g, ' ').trim()

async function get(path: string, params: Record<string, string | undefined>): Promise<DiscoverResponse> {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) if (v) search.set(k, v)
  let res: Response
  try {
    res = await fetch(`/api/discover/${path}?${search}`, { headers: { accept: 'application/json' } })
  } catch {
    throw new DiscoverError('network', 'Can’t reach the fragrance database. Check your connection.')
  }
  const body = (await res.json().catch(() => null)) as DiscoverResponse | DiscoverErrorBody | null
  if (!res.ok || !body || 'error' in body) {
    const err = body && 'error' in body ? body : null
    // A missing proxy (e.g. plain static hosting) looks like a 404 HTML page.
    if (!err && res.status === 404) throw new DiscoverError('not_configured', 'The fragrance database isn’t connected yet.')
    throw new DiscoverError(err?.error ?? 'provider_error', err?.message ?? 'The fragrance database is unavailable right now.')
  }
  return body
}

export interface DiscoverStatus {
  available: boolean
  configured: boolean
  limitsShared: boolean
}

export const discoverApi = {
  async status(): Promise<DiscoverStatus> {
    try {
      const res = await fetch('/api/discover/status', { headers: { accept: 'application/json' } })
      if (!res.ok) return { available: false, configured: false, limitsShared: false }
      return (await res.json()) as DiscoverStatus
    } catch {
      return { available: false, configured: false, limitsShared: false }
    }
  },
  search: (q: string, opts: { gender?: DiscoverGender | null; page?: number } = {}) =>
    get('search', { q: normalizeQuery(q), gender: opts.gender ?? undefined, page: opts.page === 2 ? '2' : undefined }),
  brand: (name: string) => get('brand', { name: name.trim() }),
  similar: (name: string) => get('similar', { name: normalizeQuery(name) }),
}
