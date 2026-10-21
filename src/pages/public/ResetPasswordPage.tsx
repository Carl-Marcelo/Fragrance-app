import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { LoadingBlock, Notice } from '../../components/ui/States'
import { errorMessage } from '../../lib/format'
import { useAuth } from '../../providers/AuthProvider'
import { useToast } from '../../providers/ToastProvider'

export default function ResetPasswordPage() {
  const { status, mode, updatePassword } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (mode === 'local') {
    return (
      <div className="mx-auto max-w-sm py-12">
        <Notice>Password reset needs cloud sign-in, which isn’t configured.</Notice>
      </div>
    )
  }
  if (status === 'loading') return <LoadingBlock label="Checking your reset link" />

  if (status !== 'signed_in') {
    return (
      <div className="mx-auto max-w-sm py-12 text-center">
        <h1 className="text-4xl">Reset link needed</h1>
        <p className="mt-3 text-sm text-ink-2">
          This page works from the link in your password-reset email. The link may have expired. Request a new one.
        </p>
        <ButtonLink to="/login" variant="secondary" className="mt-6">
          Back to sign in
        </ButtonLink>
      </div>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 10) return setError('Use at least 10 characters.')
    if (password !== confirm) return setError('The passwords don’t match.')
    setBusy(true)
    try {
      await updatePassword(password)
      toast.success('Password updated')
      navigate('/app', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-6 sm:py-12">
      <h1 className="text-center text-4xl">Choose a new password</h1>
      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6" noValidate>
        <Field label="New password" hint="At least 10 characters. A passphrase works well.">
          <input
            type="password"
            autoComplete="new-password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            autoComplete="new-password"
            className="field-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={busy} icon={<KeyRound />}>
          Update password
        </Button>
      </form>
    </div>
  )
}
