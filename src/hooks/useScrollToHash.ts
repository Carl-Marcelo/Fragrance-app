import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Scrolls to the element named in the URL hash once the page has rendered it. */
export function useScrollToHash(ready = true) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!ready || !hash) return
    const id = decodeURIComponent(hash.slice(1))
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50)
    return () => window.clearTimeout(timer)
  }, [hash, ready])
}
