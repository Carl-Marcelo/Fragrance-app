import {
  Archive,
  BookOpen,
  Bookmark,
  Columns3,
  Compass,
  GalleryVerticalEnd,
  Globe,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Plus,
  Settings,
  Sparkles,
  SprayCan,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useAuth } from '../../providers/AuthProvider'
import { useToast } from '../../providers/ToastProvider'
import { ButtonLink } from '../ui/Button'
import { Logo, StatusBanners, ThemeToggle } from './Chrome'

const GROUPS = [
  {
    label: 'Journal',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/app/discover', label: 'Discover', icon: Compass },
      { to: '/app/collection', label: 'My Collection', icon: GalleryVerticalEnd },
      { to: '/app/wishlist', label: 'Wishlist', icon: Bookmark },
      { to: '/app/favorites', label: 'Favourites', icon: Heart },
      { to: '/app/previously-owned', label: 'Previously owned', icon: Archive },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/app/spray-guide', label: 'Spray guide', icon: SprayCan },
      { to: '/app/wear-log', label: 'Wear log', icon: NotebookPen },
      { to: '/app/compare', label: 'Compare', icon: Columns3 },
      { to: '/app/recommendations', label: 'Recommendations', icon: Sparkles },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/app/library', label: 'Fragrance library', icon: BookOpen },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
]

function SidebarNav({ onSignOut }: { onSignOut: () => void }) {
  const { user, mode } = useAuth()
  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Journal" className="flex-1 space-y-6 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="eyebrow mb-1.5 px-3">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive ? 'bg-accent-soft font-medium text-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mt-6 space-y-0.5 border-t border-line pt-4">
        <Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
          <Globe className="size-4" aria-hidden /> Public site
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <LogOut className="size-4" aria-hidden /> {mode === 'local' ? 'Leave preview' : 'Sign out'}
        </button>
        <p className="truncate px-3 pt-2 text-xs text-ink-3" title={user?.email ?? undefined}>
          {mode === 'local' ? 'Local preview' : user?.email}
        </p>
      </div>
    </div>
  )
}

export function AppLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawer = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const el = drawer.current
    if (!el) return
    if (drawerOpen && !el.open) el.showModal()
    if (!drawerOpen && el.open) el.close()
  }, [drawerOpen])

  const handleSignOut = async () => {
    await signOut()
    toast.info('Signed out')
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <StatusBanners />

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-canvas/90 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="-ml-2 rounded-md p-2 text-ink-2 hover:bg-sunken hover:text-ink"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>
        <Logo to="/app" />
        <div className="flex items-center">
          <ThemeToggle />
          <Link to="/app/perfume/new" className="rounded-md p-2 text-accent hover:bg-accent-soft" aria-label="Add perfume">
            <Plus className="size-5" />
          </Link>
        </div>
      </header>

      <dialog
        ref={drawer}
        aria-label="Navigation"
        onCancel={(e) => {
          e.preventDefault()
          setDrawerOpen(false)
        }}
        onClick={(e) => e.target === drawer.current && setDrawerOpen(false)}
        className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-line bg-canvas p-0 text-ink lg:hidden"
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 flex items-center justify-between">
            <Logo to="/app" />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-md p-2 text-ink-2 hover:bg-sunken"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav onSignOut={handleSignOut} />
        </div>
      </dialog>

      <div className="lg:grid lg:grid-cols-[15rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-6 lg:flex">
          <div className="mb-8 flex items-center justify-between px-2">
            <Logo to="/app" />
            <ThemeToggle />
          </div>
          <ButtonLink to="/app/perfume/new" className="mb-6 w-full" icon={<Plus />}>
            Add perfume
          </ButtonLink>
          <SidebarNav onSignOut={handleSignOut} />
        </aside>

        <main id="main" className="mx-auto w-full max-w-6xl min-w-0 px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
