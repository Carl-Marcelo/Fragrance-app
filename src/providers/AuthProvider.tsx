import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LOCAL_USER_ID } from '../api/localApi'
import { isSupabaseConfigured, siteUrl, supabase } from '../lib/supabase'

const LOCAL_FLAG = 'sillage.localPreview'

type Status = 'loading' | 'signed_out' | 'signed_in'
type OwnerCheck = 'idle' | 'pending' | 'done' | 'error'

interface AuthContextValue {
  mode: 'cloud' | 'local'
  status: Status
  user: { id: string; email: string | null } | null
  isOwner: boolean
  ownerCheck: OwnerCheck
  /** True after following a password-reset link, until a new password is set. */
  recovery: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  recheckOwner: () => void
  enterLocalPreview: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readLocalFlag() {
  try {
    return localStorage.getItem(LOCAL_FLAG) === '1'
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const mode = isSupabaseConfigured ? 'cloud' : 'local'

  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<Status>(() =>
    mode === 'local' ? (readLocalFlag() ? 'signed_in' : 'signed_out') : 'loading',
  )
  const [isOwner, setIsOwner] = useState(mode === 'local')
  const [ownerCheck, setOwnerCheck] = useState<OwnerCheck>(mode === 'local' ? 'done' : 'idle')
  const [recovery, setRecovery] = useState(false)
  const [ownerNonce, setOwnerNonce] = useState(0)

  // Track the Supabase session.
  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'signed_in' : 'signed_out')
    })
    // Keep this callback synchronous: Supabase warns against awaiting other
    // client calls inside it. The owner lookup runs in a separate effect.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setStatus(next ? 'signed_in' : 'signed_out')
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  const userId = session?.user.id ?? null

  // Ask the database whether this account is the owner (the same check RLS uses).
  useEffect(() => {
    if (!supabase) return
    if (!userId) {
      setIsOwner(false)
      setOwnerCheck('idle')
      return
    }
    let active = true
    setOwnerCheck('pending')
    supabase.rpc('is_app_owner').then(({ data, error }) => {
      if (!active) return
      if (error) {
        setOwnerCheck('error')
        return
      }
      setIsOwner(data === true)
      setOwnerCheck('done')
    })
    return () => {
      active = false
    }
  }, [userId, ownerNonce])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sign-in is not configured.')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      throw new Error(
        /invalid login credentials/i.test(error.message) ? 'Email or password is incorrect.' : error.message,
      )
    }
  }, [])

  const signOut = useCallback(async () => {
    if (mode === 'local') {
      try {
        localStorage.removeItem(LOCAL_FLAG)
      } catch {
        /* ignore */
      }
      setStatus('signed_out')
      queryClient.clear()
      return
    }
    await supabase?.auth.signOut()
    queryClient.clear()
  }, [mode, queryClient])

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Cloud sign-in is not configured.')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/reset-password`,
    })
    if (error) throw new Error(error.message)
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error('Cloud sign-in is not configured.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    setRecovery(false)
  }, [])

  const enterLocalPreview = useCallback(() => {
    if (mode !== 'local') return
    try {
      localStorage.setItem(LOCAL_FLAG, '1')
    } catch {
      /* ignore */
    }
    setStatus('signed_in')
  }, [mode])

  const value = useMemo<AuthContextValue>(() => {
    const user =
      mode === 'local'
        ? status === 'signed_in'
          ? { id: LOCAL_USER_ID, email: null }
          : null
        : session
          ? { id: session.user.id, email: session.user.email ?? null }
          : null
    return {
      mode,
      status,
      user,
      isOwner: mode === 'local' ? status === 'signed_in' : isOwner,
      ownerCheck,
      recovery,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      recheckOwner: () => setOwnerNonce((n) => n + 1),
      enterLocalPreview,
    }
  }, [mode, status, session, isOwner, ownerCheck, recovery, signIn, signOut, sendPasswordReset, updatePassword, enterLocalPreview])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** True when the signed-in account may read private data. */
export function useIsOwner() {
  const { status, isOwner } = useAuth()
  return status === 'signed_in' && isOwner
}
