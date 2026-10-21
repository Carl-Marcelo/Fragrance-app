const moneyFormatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(amount: number | null | undefined, currency = 'PHP'): string {
  if (amount == null) return '—'
  let fmt = moneyFormatters.get(currency)
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 2 })
    } catch {
      fmt = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 })
    }
    moneyFormatters.set(currency, fmt)
  }
  return fmt.format(amount)
}

/** Sums recorded prices per currency, never mixing currencies. */
export function totalsByCurrency(rows: { purchase_price: number | null; currency: string }[]) {
  const totals = new Map<string, { total: number; count: number }>()
  for (const r of rows) {
    if (r.purchase_price == null) continue
    const t = totals.get(r.currency) ?? { total: 0, count: 0 }
    t.total += r.purchase_price
    t.count++
    totals.set(r.currency, t)
  }
  return [...totals.entries()]
    .map(([currency, t]) => ({ currency, ...t }))
    .sort((a, b) => b.count - a.count)
}

export function pricePerMl(price: number | null, size: number | null): number | null {
  if (price == null || !size) return null
  return price / size
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return '—'
  // Plain dates (YYYY-MM-DD) are calendar days; avoid timezone shifts.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', ...opts })
}

export function relativeDays(value: string | null | undefined, now = new Date()): string {
  if (!value) return 'never'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "1 record", "3 records"; pass the plural for irregular words. */
export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`
}

export function formatRating(r: number | null | undefined) {
  if (r == null) return '—'
  return `${Number.isInteger(r) ? r : r.toFixed(1)}/10`
}

export function remainingMl(size: number | null, percent: number | null): number | null {
  if (!size || percent == null) return null
  return Math.round((size * percent) / 100)
}

export function errorMessage(error: unknown): string {
  if (!error) return 'Something went wrong.'
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    if (/Failed to fetch|NetworkError|Load failed/i.test(error.message)) {
      return 'Can’t reach the server. Check your connection and try again.'
    }
    return error.message
  }
  if (typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return 'Something went wrong.'
}
