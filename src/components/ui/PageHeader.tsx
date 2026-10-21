import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-4xl leading-tight sm:text-[2.75rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[0.9375rem] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionHeading({
  title,
  action,
  className,
  id,
}: {
  title: ReactNode
  action?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <div className={cn('mb-4 flex items-baseline justify-between gap-4', className)}>
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      {action && <div className="shrink-0 text-sm">{action}</div>}
    </div>
  )
}
