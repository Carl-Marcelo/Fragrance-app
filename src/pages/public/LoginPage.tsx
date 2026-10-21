import { HardDrive, KeyRound, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Notice } from '../../components/ui/States'
import { errorMessage } from '../../lib/format'
import { useAuth, useIsOwner } from '../../providers/AuthProvider'

export default function LoginPage() {
  const { mode, status, signIn, sendPasswordReset, enterLocalPreview } = useAuth()
  const owner = useIsOwner()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  const [view, setView] = useState<'signin' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  if (status === 'signed_in' && owner) return <Navigate to={from} replace />

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onReset = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter the email address for your account.')
      return
    }
    setBusy(true)
    try {
      await sendPasswordReset(email)
      setResetSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-6 sm:py-12">
      <p className="eyebrow mb-3 text-center">Private journal</p>
      <h1 className="text-center text-4xl">{view === 'signin' ? 'Sign in' : 'Reset password'}</h1>

      {mode === 'local' ? (
        <div className="mt-8 space-y-4">
          <Notice tone="info" icon={<HardDrive />}>
            <p className="font-medium text-ink">Cloud sign-in isn’t set up yet</p>
            <p className="mt-1">
              Add your Supabase URL and anon key to enable sign-in and sync across devices (see the README). Until then,
              you can explore the private journal in <strong>local preview</strong> mode. Data stays in this browser.
            </p>
          </Notice>
          <Button
            className="w-full"
            onClick={() => {
              enterLocalPreview()
              navigate(from, { replace: true })
            }}
          >
            Open local preview
          </Button>
        </div>
      ) : view === 'signin' ? (
        <form onSubmit={onSignIn} className="card mt-8 space-y-4 p-6" noValidate>
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={busy} icon={<KeyRound />}>
            Sign in
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-ink-2 hover:text-ink"
            onClick={() => {
              setView('reset')
              setError(null)
            }}
          >
            Forgot your password?
          </button>
        </form>
      ) : (
        <form onSubmit={onReset} className="card mt-8 space-y-4 p-6" noValidate>
          {resetSent ? (
            <Notice tone="success" icon={<Mail />}>
              If an account exists for that address, a reset link is on its way. Open it on this device to choose a new
              password.
            </Notice>
          ) : (
            <>
              <Field label="Email">
                <input
                  type="email"
                  autoComplete="email"
                  className="field-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              {error && (
                <p role="alert" className="text-sm font-medium text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" loading={busy} icon={<Mail />}>
                Send reset link
              </Button>
            </>
          )}
          <button
            type="button"
            className="w-full text-center text-sm text-ink-2 hover:text-ink"
            onClick={() => {
              setView('signin')
              setResetSent(false)
              setError(null)
            }}
          >
            Back to sign in
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-ink-3">
        This is a private, single-owner journal. New accounts can’t be created here.
      </p>
    </div>
  )
}
