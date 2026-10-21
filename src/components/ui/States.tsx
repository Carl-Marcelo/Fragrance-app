import { CircleAlert, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { errorMessage } from '../../lib/format'
import { Button } from './Button'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-ink-3', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}…</span>
    </span>
  )
}

export function LoadingBlock({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex min-h-48 items-center justify-center', className)}>
      <Spinner label={label} />
    </div>
  )
}

/** Placeholder grid while cards load, so the layout doesn't jump. */
export function CardSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card animate-pulse overflow-hidden">
          <div className="aspect-[4/3] bg-sunken" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 rounded bg-sunken" />
            <div className="h-5 w-2/3 rounded bg-sunken" />
            <div className="h-3 w-1/2 rounded bg-sunken" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-12 text-center',
        className,
      )}
    >
      {icon && <div className="mb-3 text-ink-3 [&_svg]:size-8 [&_svg]:stroke-[1.25]">{icon}</div>}
      <h3 className="text-xl">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  title = 'Couldn’t load this',
  className,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
}) {
  return (
    <div role="alert" className={cn('rounded-lg border border-danger/30 bg-danger-soft p-5', className)}>
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{title}</p>
          <p className="mt-1 text-sm text-ink-2">{errorMessage(error)}</p>
          {onRetry && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry} icon={<RefreshCw />}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Notice({
  tone = 'info',
  icon,
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'success'
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  const tones = {
    info: 'border-info/25 bg-info-soft',
    warning: 'border-warning/30 bg-warning-soft',
    success: 'border-success/30 bg-success-soft',
  }
  const iconTone = { info: 'text-info', warning: 'text-warning', success: 'text-success' }
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-4 text-sm text-ink-2', tones[tone], className)}>
      {icon && <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', iconTone[tone])}>{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
