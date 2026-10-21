#!/usr/bin/env node
// Checks, from the outside, that a signed-out visitor holding the public anon key
// cannot read or write private data. Uses the same URL/key the browser uses.
//
//   npm run verify:rls
//
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the environment or
// from .env.local / .env in the project root.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(file) {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (set them in .env.local).')
  process.exit(2)
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
const results = []

async function check(name, fn) {
  try {
    const verdict = await fn()
    results.push({ name, ok: verdict === true, detail: verdict === true ? '' : String(verdict) })
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) })
  }
}

// A read is "blocked" when PostgREST refuses it or returns no rows.
async function readBlocked(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, { headers })
  if (res.status === 401 || res.status === 403) return true
  if (!res.ok) return `unexpected HTTP ${res.status}: ${await res.text()}`
  const rows = await res.json()
  return rows.length === 0 ? true : `returned ${rows.length} row(s)`
}

async function writeBlocked(table, body) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (res.status === 401 || res.status === 403) return true
  return `write was not rejected (HTTP ${res.status})`
}

for (const table of ['collection_items', 'wear_logs', 'user_settings', 'app_owners', 'api_usage', 'api_rate_limits']) {
  await check(`anon cannot read ${table}`, () => readBlocked(table))
}

await check('anon sees no unpublished fragrances', async () => {
  const res = await fetch(`${url}/rest/v1/fragrances?select=id&is_public=eq.false&limit=5`, { headers })
  if (!res.ok) return `unexpected HTTP ${res.status}`
  const rows = await res.json()
  return rows.length === 0 ? true : `returned ${rows.length} unpublished row(s)`
})

await check('anon can read the public catalog endpoint', async () => {
  const res = await fetch(`${url}/rest/v1/fragrances?select=id&is_public=eq.true&limit=1`, { headers })
  return res.ok ? true : `HTTP ${res.status} (the public catalog should be readable)`
})

await check('anon cannot create fragrances', () =>
  writeBlocked('fragrances', { name: 'RLS probe', brand: 'RLS probe', owner_id: '00000000-0000-0000-0000-000000000000' }),
)
await check('anon cannot create collection items', () =>
  writeBlocked('collection_items', { fragrance_id: '00000000-0000-0000-0000-000000000000' }),
)
await check('anon cannot write settings', () => writeBlocked('user_settings', { theme: 'dark' }))

await check('anon cannot call is_app_owner() as true', async () => {
  const res = await fetch(`${url}/rest/v1/rpc/is_app_owner`, { method: 'POST', headers, body: '{}' })
  if (!res.ok) return true
  return (await res.json()) === false ? true : 'returned true for an anonymous caller'
})

await check('anon cannot spend the search quota directly', async () => {
  const res = await fetch(`${url}/rest/v1/rpc/consume_discovery_quota`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_client: 'verify-rls-probe-0000', p_per_minute: 1, p_per_day: 1, p_monthly_cap: 1 }),
  })
  return res.ok ? `quota function callable by anon (HTTP ${res.status})` : true
})

await check('anon cannot list private bottle photos', async () => {
  const res = await fetch(`${url}/storage/v1/object/list/bottle-photos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix: '', limit: 10 }),
  })
  if (!res.ok) return true
  const items = await res.json()
  return Array.isArray(items) && items.length === 0 ? true : `listed ${items.length} item(s)`
})

let failed = 0
for (const r of results) {
  if (!r.ok) failed++
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`)
}
console.log(`\n${results.length - failed}/${results.length} checks passed against ${url}`)
process.exit(failed ? 1 : 0)
