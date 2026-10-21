import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider'
import { Button, ButtonLink } from '../ui/Button'
import { ErrorState, LoadingBlock } from '../ui/States'

/**
 * Route guard for the private journal. This is a convenience only: the real
 * protection is Row Level Security, which refuses private rows to anyone else.
 */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { status, ownerCheck, isOwner, mode, user, signOut, recheckOwner } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingBlock label="Checking your session" className="min-h-dvh" />
  if (status === 'signed_out') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />

  if (mode === 'cloud' && (ownerCheck === 'pending' || ownerCheck === 'idle')) {
    return <LoadingBlock label="Checking access" className="min-h-dvh" />
  }
  if (ownerCheck === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <ErrorState error="Couldn’t confirm access to your journal. Check your connection." onRetry={recheckOwner} />
      </div>
    )
  }
  if (!isOwner) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <Lock className="size-8 text-ink-3" aria-hidden />
        <h1 className="mt-4 text-3xl">This journal is private</h1>
        <p className="mt-2 text-sm text-ink-2">
          {user?.email ? <>Signed in as {user.email}, which </> : 'This account '}
          doesn’t have access to the private collection.
        </p>
        <div className="mt-6 flex gap-2">
          <ButtonLink to="/" variant="secondary">
            Public site
          </ButtonLink>
          <Button onClick={() => signOut()}>Sign out</Button>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
