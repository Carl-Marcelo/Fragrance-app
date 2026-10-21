import { useQueryClient, useIsMutating } from '@tanstack/react-query'
import { CloudOff, HardDrive, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSaveSettings, useSettings } from '../../hooks/queries'
import { cn } from '../../lib/cn'
import { keyIsPrivileged } from '../../lib/supabase'
import { useAuth, useIsOwner } from '../../providers/AuthProvider'
import { useTheme } from '../../providers/ThemeProvider'

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex items-baseline gap-2 text-ink', className)} aria-label="Sillage home">
      <svg viewBox="0 0 20 28" className="h-5 w-auto self-center stroke-accent" fill="none" strokeWidth="1.4" aria-hidden>
        <rect x="7.5" y="1" width="5" height="3.5" rx="0.8" />
        <path d="M8.5 4.5v2.5M11.5 4.5v2.5" />
        <rect x="2" y="7" width="16" height="20" rx="4" />
      </svg>
      <span className="font-display text-[1.6rem] leading-none font-medium tracking-[0.04em]">Sillage</span>
    </Link>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme()
  const dark = resolved === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn('rounded-md p-2 text-ink-2 transition-colors hover:bg-sunken hover:text-ink', className)}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      {dark ? <Sun className="size-[1.125rem]" /> : <Moon className="size-[1.125rem]" />}
    </button>
  )
}

/** Keeps the theme choice in the owner's cloud settings so it follows them across devices. */
export function ThemeCloudSync() {
  const owner = useIsOwner()
  const { stored, loaded } = useSettings()
  const save = useSaveSettings()
  const { preference, setPreference, lastSource } = useTheme()
  const appliedFromCloud = useRef(false)

  // On first load of settings this session, adopt the stored preference unless
  // the person already changed the theme before it arrived.
  useEffect(() => {
    if (!owner) {
      appliedFromCloud.current = false
      return
    }
    if (!loaded || appliedFromCloud.current) return
    appliedFromCloud.current = true
    if (stored && lastSource !== 'user' && stored.theme !== preference) setPreference(stored.theme, 'cloud')
  }, [owner, loaded, stored, lastSource, preference, setPreference])

  // Later manual changes are saved to the account.
  const saveRef = useRef(save.mutate)
  saveRef.current = save.mutate
  useEffect(() => {
    if (!owner || !loaded || lastSource !== 'user') return
    if (stored?.theme === preference) return
    saveRef.current({ theme: preference })
  }, [owner, loaded, lastSource, preference, stored?.theme])

  return null
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function StatusBanners() {
  const online = useOnline()
  const { mode, status } = useAuth()
  const pendingWrites = useIsMutating()
  const qc = useQueryClient()
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) {
      wasOffline.current = false
      qc.invalidateQueries()
    }
  }, [online, qc])

  return (
    <>
      {keyIsPrivileged && (
        <div role="alert" className="bg-danger px-4 py-2 text-center text-sm text-white">
          A secret Supabase key was configured in the browser build. Cloud mode is disabled. Replace it with the anon key
          and rotate the secret immediately.
        </div>
      )}
      {!online && (
        <div role="status" className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-sm text-ink">
          <CloudOff className="size-4 text-warning" aria-hidden />
          You’re offline.{' '}
          {mode === 'cloud' && pendingWrites > 0
            ? `${pendingWrites} change${pendingWrites > 1 ? 's' : ''} will sync when you reconnect. Keep this tab open.`
            : 'Showing what was already loaded.'}
        </div>
      )}
      {mode === 'local' && status === 'signed_in' && (
        <div role="status" className="flex items-center justify-center gap-2 bg-info-soft px-4 py-2 text-center text-sm text-ink">
          <HardDrive className="size-4 shrink-0 text-info" aria-hidden />
          <span>Local preview: data is saved in this browser only. Connect Supabase to sync across devices.</span>
        </div>
      )}
    </>
  )
}
