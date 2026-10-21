// Server-side proxy for the Fragella fragrance database.
//
// * The API key stays on the server (FRAGELLA_API_KEY); browsers never see it.
// * Successful responses are cached by Vercel's CDN for 24 h, so repeated
//   searches cost nothing.
// * Every uncached call passes a per-visitor rate limit and a monthly cap,
//   enforced atomically in Supabase (public.consume_discovery_quota).
//
// Files under api/_lib are helpers, not routes.

import { normalizeFragellaList } from '../../src/lib/discover/fragella'
import type { DiscoverErrorBody, DiscoverErrorCode, DiscoverResponse } from '../../src/lib/discover/types'

export type DiscoverKind = 'search' | 'brand' | 'similar'

const CACHE_OK = 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800'

function env(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

function envInt(name: string, fallback: number, min: number, max: number) {
  const n = Number.parseInt(env(name) ?? '', 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const limits = () => ({
  perMinute: envInt('DISCOVER_RATE_PER_MINUTE', 20, 1, 600),
  perDay: envInt('DISCOVER_RATE_PER_DAY', 300, 1, 100_000),
  monthlyCap: envInt('DISCOVER_MONTHLY_CAP', 1000, 0, 10_000_000),
})

function json(body: DiscoverResponse | DiscoverErrorBody, status = 200, cache = 'no-store', extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  })
}

const MESSAGES: Record<DiscoverErrorCode, string> = {
  not_configured: 'The fragrance database isn’t connected yet.',
  invalid_request: 'That search couldn’t be understood.',
  rate_minute: 'Too many searches in a short time. Wait a minute and try again.',
  rate_day: 'Daily search limit reached for this connection. Try again tomorrow.',
  monthly_cap: 'Live database searches are paused until next month. Saved fragrances still work.',
  provider_limit: 'The fragrance database’s request allowance is used up for now.',
  provider_auth: 'The fragrance database rejected the API key. Check FRAGELLA_API_KEY.',
  provider_error: 'The fragrance database is unavailable right now. Try again shortly.',
  limits_unavailable: 'Search safeguards aren’t configured, so live search is disabled.',
}

const fail = (code: DiscoverErrorCode, status: number, extra?: Record<string, string>) =>
  json({ error: code, message: MESSAGES[code] }, status, 'no-store', extra)

/** Collapses whitespace and strips control characters. */
function clean(v: string | null, max = 80): string | null {
  if (!v) return null
  // Matching control characters is the point here: strip them from user input.
  // oxlint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  return t && t.length <= max ? t : null
}

// ----- Quota --------------------------------------------------------------------

interface Quota {
  allowed: boolean
  reason?: 'rate_minute' | 'rate_day' | 'monthly_cap'
}

async function clientKey(request: Request): Promise<string> {
  // Vercel overwrites these headers with the real client address.
  const ip =
    request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const salt = env('RATE_LIMIT_SALT') ?? 'sillage-discover'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}

async function consumeSupabase(client: string): Promise<Quota> {
  const url = (env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL'))!.replace(/\/$/, '')
  const secret = env('SUPABASE_SERVICE_ROLE_KEY')!
  const { perMinute, perDay, monthlyCap } = limits()
  // New-style secret keys go in `apikey` only; legacy service_role JWTs also as Bearer.
  const headers: Record<string, string> = { apikey: secret, 'content-type': 'application/json' }
  if (!secret.startsWith('sb_secret_')) headers.authorization = `Bearer ${secret}`
  const res = await fetch(`${url}/rest/v1/rpc/consume_discovery_quota`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_client: client, p_per_minute: perMinute, p_per_day: perDay, p_monthly_cap: monthlyCap }),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`quota RPC failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as Quota
}

// Development fallback only: per-process counters.
const memory = new Map<string, { hits: number; expires: number }>()
let memoryMonth = { period: '', calls: 0 }

function consumeMemory(client: string): Quota {
  const now = Date.now()
  const { perMinute, perDay, monthlyCap } = limits()
  const period = new Date().toISOString().slice(0, 7)
  if (memoryMonth.period !== period) memoryMonth = { period, calls: 0 }
  if (memoryMonth.calls >= monthlyCap) return { allowed: false, reason: 'monthly_cap' }
  const bump = (bucket: string, ttl: number) => {
    const key = `${client}:${bucket}`
    const entry = memory.get(key)
    if (!entry || entry.expires < now) {
      memory.set(key, { hits: 1, expires: now + ttl })
      return 1
    }
    entry.hits++
    return entry.hits
  }
  if (bump(`m:${Math.floor(now / 60_000)}`, 120_000) > perMinute) return { allowed: false, reason: 'rate_minute' }
  if (bump(`d:${new Date().toISOString().slice(0, 10)}`, 172_800_000) > perDay) return { allowed: false, reason: 'rate_day' }
  memoryMonth.calls++
  return { allowed: true }
}

async function consume(request: Request): Promise<Quota | Response> {
  const client = await clientKey(request)
  const hasSupabase = Boolean((env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL')) && env('SUPABASE_SERVICE_ROLE_KEY'))
  if (!hasSupabase) {
    // In production the cap must be shared across instances, so refuse rather than overspend.
    if (env('VERCEL') && env('VERCEL_ENV') !== 'development') return fail('limits_unavailable', 503)
    return consumeMemory(client)
  }
  try {
    return await consumeSupabase(client)
  } catch (e) {
    console.error('[discover]', e)
    return fail('limits_unavailable', 503)
  }
}

// ----- Upstream -----------------------------------------------------------------

async function callFragella(path: string, params: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const base = (env('FRAGELLA_API_BASE') ?? 'https://api.fragella.com/api/v1').replace(/\/$/, '')
  const url = new URL(`${base}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, {
    headers: { 'x-api-key': env('FRAGELLA_API_KEY')!, accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    await res.body?.cancel()
    return { status: res.status, body: null }
  }
  // Fragella has been seen answering data requests with its HTML home page and
  // HTTP 200. Never read that as "no results", or the CDN would cache it for a day.
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('json')) {
    await res.body?.cancel()
    throw new Error(`Fragella sent ${type || 'no content type'} instead of JSON for ${path} (HTTP ${res.status})`)
  }
  return { status: res.status, body: await res.json() }
}

function upstreamError(status: number): Response | null {
  if (status === 401 || status === 403) return fail('provider_auth', 502)
  if (status === 429 || status === 402) return fail('provider_limit', 503)
  if (status >= 400 && status !== 404) return fail('provider_error', 502)
  return null
}

function quotaResponse(q: Quota): Response {
  const reason = q.reason ?? 'rate_minute'
  const retry = reason === 'rate_minute' ? '60' : reason === 'rate_day' ? '3600' : '86400'
  return fail(reason, 429, { 'retry-after': retry })
}

// ----- Handler ------------------------------------------------------------------

export async function handleDiscover(request: Request, kind: DiscoverKind): Promise<Response> {
  if (request.method !== 'GET') return fail('invalid_request', 405, { allow: 'GET' })
  if (!env('FRAGELLA_API_KEY')) return fail('not_configured', 503)

  const params = new URL(request.url).searchParams
  let path: string
  let query: Record<string, string>
  let fallbackSearch: string | null = null

  if (kind === 'search') {
    const q = clean(params.get('q'))
    // Fragella requires at least 3 characters.
    if (!q || q.length < 3) return fail('invalid_request', 400)
    const gender = params.get('gender')
    const page = params.get('page') === '2' ? '2' : '1'
    path = '/fragrances'
    query = { search: q, limit: '10', page }
    if (gender === 'men' || gender === 'women' || gender === 'unisex') query.gender = gender
  } else if (kind === 'brand') {
    const name = clean(params.get('name'))
    if (!name) return fail('invalid_request', 400)
    path = `/brands/${encodeURIComponent(name)}`
    query = { limit: '20' } // Fragella's maximum for this endpoint
    fallbackSearch = name
  } else {
    const name = clean(params.get('name'), 160)
    if (!name || name.length < 2) return fail('invalid_request', 400)
    path = '/fragrances/similar'
    query = { name, limit: '6' }
  }

  const quota = await consume(request)
  if (quota instanceof Response) return quota
  if (!quota.allowed) return quotaResponse(quota)

  try {
    const first = await callFragella(path, query)
    const err = upstreamError(first.status)
    if (err) return err
    let results = first.status === 404 ? [] : normalizeFragellaList(first.body)
    let fallback = false

    // Unknown brand spelling: try a plain text search instead (counts as a call).
    if (!results.length && fallbackSearch) {
      const again = await consume(request)
      if (again instanceof Response) return again
      if (!again.allowed) return quotaResponse(again)
      const second = await callFragella('/fragrances', { search: fallbackSearch, limit: '10' })
      const err2 = upstreamError(second.status)
      if (err2) return err2
      results = second.status === 404 ? [] : normalizeFragellaList(second.body)
      fallback = true
    }

    return json({ results, source: 'fragella', fallback }, 200, CACHE_OK)
  } catch (e) {
    console.error('[discover]', e)
    return fail('provider_error', 502)
  }
}
