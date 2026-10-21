import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { createLocalApi } from './localApi'
import { createSupabaseApi } from './supabaseApi'
import type { DataApi } from './types'

export const api: DataApi = isSupabaseConfigured && supabase ? createSupabaseApi(supabase) : createLocalApi()

export type { DataApi, ImportSummary, Bucket } from './types'
