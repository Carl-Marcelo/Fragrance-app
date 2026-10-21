import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useAuth, useIsOwner } from '../../providers/AuthProvider'
import { ButtonLink } from '../ui/Button'
import { Logo, StatusBanners, ThemeToggle } from './Chrome'

const NAV = [
  { to: '/discover', label: 'Discover' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/spray-guide', label: 'Spray guide' },
  { to: '/guides', label: 'Guides' },
]

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-2 text-sm transition-colors',
    isActive ? 'text-ink font-medium' : 'text-ink-2 hover:text-ink',
  )

export function PublicLayout() {
  const owner = useIsOwner()
  const { status } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <StatusBanners />
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {owner ? (
              <ButtonLink to="/app" size="sm" className="ml-1 hidden sm:inline-flex">
                My journal
              </ButtonLink>
            ) : (
              status !== 'loading' && (
                <NavLink to="/login" className={cn(navClass({ isActive: false }), 'hidden sm:inline-flex')}>
                  Sign in
                </NavLink>
              )
            )}
            <button
              type="button"
              className="rounded-md p-2 text-ink-2 hover:bg-sunken hover:text-ink md:hidden"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="public-mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="public-mobile-nav" aria-label="Main" className="border-t border-line px-4 py-3 md:hidden">
            <ul className="flex flex-col">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} className={({ isActive }) => cn(navClass({ isActive }), 'block')}>
                    {n.label}
                  </NavLink>
                </li>
              ))}
              <li className="mt-2 border-t border-line pt-2">
                <NavLink to={owner ? '/app' : '/login'} className={({ isActive }) => cn(navClass({ isActive }), 'block')}>
                  {owner ? 'My journal' : 'Sign in'}
                </NavLink>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Sillage is a personal fragrance journal. Fragrance details are entered by hand; check official sources before
            buying.
          </p>
          <nav aria-label="Footer" className="flex gap-4">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="hover:text-ink">
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
