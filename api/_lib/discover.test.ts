import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FRAGELLA_FRESH, FRAGELLA_SAMPLE } from '../../src/lib/discover/fixtures'

type FetchArgs = [input: string | URL | Request, init?: RequestInit]

const ENV_KEYS = [
  'FRAGELLA_API_KEY',
  'FRAGELLA_API_BASE',
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VERCEL',
  'VERCEL_ENV',
  'DISCOVER_RATE_PER_MINUTE',
  'DISCOVER_RATE_PER_DAY',
  'DISCOVER_MONTHLY_CAP',
]

let saved: Record<string, string | undefined>
let ipCounter = 0

async function load() {
  vi.resetModules() // fresh in-memory limiter per test
  return (await import('./discover')).handleDiscover
}

const req = (path: string) =>
  new Request(`http://localhost/api/discover/${path}`, { headers: { 'x-real-ip': `10.0.0.${++ipCounter}` } })

function mockFetch(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (...[input, init]: FetchArgs) => handler(new URL(String(input)), init))
  vi.stubGlobal('fetch', fn)
  return fn
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  for (const k of ENV_KEYS) delete process.env[k]
  process.env.FRAGELLA_API_KEY = 'test-key'
})

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  vi.unstubAllGlobals()
})

describe('handleDiscover', () => {
  it('reports when no API key is configured', async () => {
    delete process.env.FRAGELLA_API_KEY
    const handle = await load()
    const res = await handle(req('search?q=khamrah'), 'search')
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('not_configured')
  })

  it('rejects too-short queries without calling the provider', async () => {
    const fetchFn = mockFetch(() => jsonResponse([]))
    const handle = await load()
    const res = await handle(req('search?q=kh'), 'search') // Fragella needs 3+ characters
    expect(res.status).toBe(400)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('searches, sends the key server-side, normalises and sets CDN caching', async () => {
    const fetchFn = mockFetch((url, init) => {
      expect(url.pathname).toBe('/api/v1/fragrances')
      expect(url.searchParams.get('search')).toBe('khamrah')
      expect(url.searchParams.get('limit')).toBe('10')
      expect(url.searchParams.get('gender')).toBe('unisex')
      expect(new Headers(init?.headers).get('x-api-key')).toBe('test-key')
      return jsonResponse([FRAGELLA_SAMPLE])
    })
    const handle = await load()
    const res = await handle(req('search?q=khamrah&gender=unisex'), 'search')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400')
    const body = await res.json()
    expect(body.results[0].name).toBe('Khamrah')
    expect(body.results[0]).not.toHaveProperty('Purchase URL')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('reads the similar-fragrances wrapper', async () => {
    mockFetch((url) => {
      expect(url.pathname).toBe('/api/v1/fragrances/similar')
      return jsonResponse({ similar_to: 'Khamrah', similar_fragrances: [FRAGELLA_FRESH] })
    })
    const handle = await load()
    const body = await (await handle(req('similar?name=Khamrah'), 'similar')).json()
    expect(body.results.map((r: { name: string }) => r.name)).toEqual(['Light Blue Pour Homme'])
  })

  it('treats an HTML page from the provider as an error, not as cacheable empty results', async () => {
    mockFetch(() => new Response('<!DOCTYPE html><title>Fragella API</title>', { headers: { 'content-type': 'text/html' } }))
    const handle = await load()
    const res = await handle(req('search?q=sauvage'), 'search')
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('provider_error')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('falls back to a text search when a brand is unknown', async () => {
    const fetchFn = mockFetch((url) => {
      if (!url.pathname.startsWith('/api/v1/brands/')) return jsonResponse([FRAGELLA_FRESH])
      expect(url.searchParams.get('limit')).toBe('20') // the endpoint's maximum
      return jsonResponse({ error: 'not found' }, 404)
    })
    const handle = await load()
    const res = await handle(req('brand?name=D%26G'), 'brand')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.fallback).toBe(true)
    expect(body.results).toHaveLength(1)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('maps provider auth and quota errors without caching them', async () => {
    mockFetch(() => jsonResponse({ message: 'bad key' }, 401))
    let handle = await load()
    let res = await handle(req('search?q=sauvage'), 'search')
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('provider_auth')
    expect(res.headers.get('cache-control')).toBe('no-store')

    mockFetch(() => jsonResponse({ message: 'limit' }, 429))
    handle = await load()
    res = await handle(req('search?q=sauvage'), 'search')
    expect((await res.json()).error).toBe('provider_limit')
  })

  it('rate-limits a single visitor (development limiter)', async () => {
    process.env.DISCOVER_RATE_PER_MINUTE = '2'
    mockFetch(() => jsonResponse([FRAGELLA_FRESH]))
    const handle = await load()
    const same = () =>
      handle(new Request('http://localhost/api/discover/search?q=light+blue', { headers: { 'x-real-ip': '192.0.2.9' } }), 'search')
    expect((await same()).status).toBe(200)
    expect((await same()).status).toBe(200)
    const third = await same()
    expect(third.status).toBe(429)
    expect(third.headers.get('retry-after')).toBe('60')
  })

  it('enforces the monthly cap', async () => {
    process.env.DISCOVER_MONTHLY_CAP = '1'
    mockFetch(() => jsonResponse([FRAGELLA_FRESH]))
    const handle = await load()
    expect((await handle(req('search?q=light+blue'), 'search')).status).toBe(200)
    const res = await handle(req('search?q=aventus'), 'search')
    expect(res.status).toBe(429)
    expect((await res.json()).error).toBe('monthly_cap')
  })

  it('refuses to run in production without shared limits', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    const fetchFn = mockFetch(() => jsonResponse([]))
    const handle = await load()
    const res = await handle(req('search?q=khamrah'), 'search')
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('limits_unavailable')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('uses the Supabase quota function when configured', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test'
    const fetchFn = mockFetch((url, init) => {
      if (url.hostname === 'proj.supabase.co') {
        const headers = new Headers(init?.headers)
        expect(url.pathname).toBe('/rest/v1/rpc/consume_discovery_quota')
        expect(headers.get('apikey')).toBe('sb_secret_test')
        expect(headers.get('authorization')).toBeNull() // new-style secret keys aren't JWTs
        return jsonResponse({ allowed: false, reason: 'rate_day' })
      }
      return jsonResponse([FRAGELLA_FRESH])
    })
    const handle = await load()
    const res = await handle(req('search?q=light+blue'), 'search')
    expect(res.status).toBe(429)
    expect((await res.json()).error).toBe('rate_day')
    expect(fetchFn).toHaveBeenCalledTimes(1) // provider never called
  })
})
