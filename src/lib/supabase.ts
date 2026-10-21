import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** Refuse privileged keys: they bypass Row Level Security and must never ship to a browser. */
function looksPrivileged(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const payload = key.split('.')[1]
  if (!payload) return false
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return json?.role === 'service_role'
  } catch {
    return false
  }
}

export const keyIsPrivileged = Boolean(anonKey && looksPrivileged(anonKey))

if (keyIsPrivileged) {
  console.error(
    'VITE_SUPABASE_ANON_KEY contains a service-role / secret key. Cloud mode is disabled. ' +
      'Replace it with the anon (publishable) key and rotate the leaked secret in Supabase.',
  )
}

export const isSupabaseConfigured = Boolean(
  url && anonKey && url.startsWith('https://') && !url.includes('your-project-ref') && !keyIsPrivileged,
)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export const siteUrl = (import.meta.env.VITE_SITE_URL?.trim() || window.location.origin).replace(/\/$/, '')
