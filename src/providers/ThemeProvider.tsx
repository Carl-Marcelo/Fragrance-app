import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ThemePreference } from '../lib/types'

const STORAGE_KEY = 'sillage.theme'

interface ThemeContextValue {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  /** `source` lets cloud sync tell user choices apart from values it applied itself. */
  setPreference: (pref: ThemePreference, source?: 'user' | 'cloud') => void
  toggle: () => void
  lastSource: 'initial' | 'user' | 'cloud'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStored(): ThemePreference | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : null
  } catch {
    return null
  }
}

function useSystemDark() {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const mql = window.matchMedia?.(query)
    if (!mql) return
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return dark
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // No stored choice yet → follow the device (light when it has no preference).
  const [preference, setPref] = useState<ThemePreference>(() => readStored() ?? 'system')
  const [lastSource, setLastSource] = useState<ThemeContextValue['lastSource']>('initial')
  const systemDark = useSystemDark()
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const root = document.documentElement
    // Swap instantly instead of animating every colour transition on the page.
    root.classList.add('theme-switching')
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove('theme-switching')),
    )
    return () => cancelAnimationFrame(frame)
  }, [resolved])

  const setPreference = useCallback((pref: ThemePreference, source: 'user' | 'cloud' = 'user') => {
    try {
      localStorage.setItem(STORAGE_KEY, pref)
    } catch {
      /* storage unavailable: theme still applies for this visit */
    }
    setPref(pref)
    setLastSource(source)
  }, [])

  const toggle = useCallback(() => setPreference(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPreference])

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggle, lastSource }),
    [preference, resolved, setPreference, toggle, lastSource],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
