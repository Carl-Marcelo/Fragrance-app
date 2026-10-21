import { ButtonLink } from '../../components/ui/Button'

export default function NotFoundPage({ inApp }: { inApp?: boolean }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-5xl">Nothing here</h1>
      <p className="mt-3 text-sm text-ink-2">The page you’re looking for doesn’t exist or has moved.</p>
      <ButtonLink to={inApp ? '/app' : '/'} variant="secondary" className="mt-8">
        {inApp ? 'Back to the dashboard' : 'Back home'}
      </ButtonLink>
    </div>
  )
}
