// Shapes shared by the server-side discovery proxy (api/discover/*) and the app.
// Kept free of browser-only imports so the Vercel functions can bundle it.

import type { Concentration } from '../types'

export type DiscoverSource = 'fragella'
export type DiscoverGender = 'men' | 'women' | 'unisex'
export type AccordStrength = 'dominant' | 'prominent' | 'moderate' | 'subtle'

export interface RankedTag {
  name: string
  score: number
}

/** A fragrance from the external database, normalised and trimmed for the app. */
export interface DiscoveredFragrance {
  ref: string
  source: DiscoverSource
  name: string
  brand: string
  year: number | null
  country: string | null
  gender: DiscoverGender | null
  concentration: Concentration | null
  concentrationLabel: string | null
  imageUrl: string | null
  perfumers: string[]
  notes: { top: string[]; middle: string[]; base: string[] }
  generalNotes: string[]
  accords: { name: string; strength: AccordStrength | null }[]
  longevity: string | null
  sillage: string | null
  seasons: RankedTag[]
  occasions: RankedTag[]
  rating: number | null
  purchaseUrl: string | null
}

export interface DiscoverResponse {
  results: DiscoveredFragrance[]
  source: DiscoverSource
  /** True when a brand lookup found nothing and fell back to a text search. */
  fallback?: boolean
}

export type DiscoverErrorCode =
  | 'not_configured'
  | 'invalid_request'
  | 'rate_minute'
  | 'rate_day'
  | 'monthly_cap'
  | 'provider_limit'
  | 'provider_auth'
  | 'provider_error'
  | 'limits_unavailable'

export interface DiscoverErrorBody {
  error: DiscoverErrorCode
  message: string
}
