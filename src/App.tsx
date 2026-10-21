import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ThemeCloudSync } from './components/layout/Chrome'
import { PublicLayout } from './components/layout/PublicLayout'
import { RequireOwner } from './components/layout/RequireOwner'
import { LoadingBlock } from './components/ui/States'
import { HomePage } from './pages/public/HomePage'

const DiscoverPage = lazy(() => import('./pages/public/DiscoverPage'))
const DiscoverFragrancePage = lazy(() => import('./pages/public/DiscoverFragrancePage'))
const CatalogPage = lazy(() => import('./pages/public/CatalogPage'))
const FragrancePage = lazy(() => import('./pages/public/FragrancePage'))
const PublicSprayGuidePage = lazy(() => import('./pages/public/PublicSprayGuidePage'))
const GuidesPage = lazy(() => import('./pages/public/GuidesPage'))
const LoginPage = lazy(() => import('./pages/public/LoginPage'))
const ResetPasswordPage = lazy(() => import('./pages/public/ResetPasswordPage'))
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage'))

const DashboardPage = lazy(() => import('./pages/app/DashboardPage'))
const CollectionPage = lazy(() => import('./pages/app/CollectionPage'))
const PerfumePage = lazy(() => import('./pages/app/PerfumePage'))
const PerfumeFormPage = lazy(() => import('./pages/app/PerfumeFormPage'))
const LibraryPage = lazy(() => import('./pages/app/LibraryPage'))
const ComparePage = lazy(() => import('./pages/app/ComparePage'))
const SprayGuidePage = lazy(() => import('./pages/app/SprayGuidePage'))
const WearLogPage = lazy(() => import('./pages/app/WearLogPage'))
const RecommendationsPage = lazy(() => import('./pages/app/RecommendationsPage'))
const SettingsPage = lazy(() => import('./pages/app/SettingsPage'))

function ScrollToTop() {
  const { pathname } = useLocation()
  // Block body on purpose: newer browsers return a Promise from scrollTo, which
  // React would treat as an invalid effect cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <ThemeCloudSync />
      <Suspense fallback={<LoadingBlock className="min-h-[60dvh]" />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="discover/:ref" element={<DiscoverFragrancePage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="fragrance/:id" element={<FragrancePage />} />
            <Route path="spray-guide" element={<PublicSprayGuidePage />} />
            <Route path="guides" element={<GuidesPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route
            path="app"
            element={
              <RequireOwner>
                <AppLayout />
              </RequireOwner>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="discover/:ref" element={<DiscoverFragrancePage />} />
            <Route path="collection" element={<CollectionPage view="owned" />} />
            <Route path="wishlist" element={<CollectionPage view="wishlist" />} />
            <Route path="favorites" element={<CollectionPage view="favorites" />} />
            <Route path="previously-owned" element={<CollectionPage view="previously_owned" />} />
            <Route path="perfume/new" element={<PerfumeFormPage mode="new-entry" />} />
            <Route path="perfume/:id" element={<PerfumePage />} />
            <Route path="perfume/:id/edit" element={<PerfumeFormPage mode="edit-entry" />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="library/new" element={<PerfumeFormPage mode="new-fragrance" />} />
            <Route path="library/:fragranceId/edit" element={<PerfumeFormPage mode="edit-fragrance" />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="spray-guide" element={<SprayGuidePage />} />
            <Route path="wear-log" element={<WearLogPage />} />
            <Route path="recommendations" element={<RecommendationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage inApp />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
