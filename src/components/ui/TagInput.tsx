import { X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { normalize } from '../../lib/filters'

interface TagInputProps {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  suggestions?: readonly string[]
  placeholder?: string
  hint?: string
  max?: number
  error?: string
}

/** Free-form tags with suggestions. Enter or comma adds; Backspace on empty removes the last. */
export function TagInput({ label, value, onChange, suggestions = [], placeholder, hint, max = 60, error }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const id = useId()
  const listId = `${id}-list`

  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean)
      .map((s) => s.slice(0, 80))
    if (!parts.length) return
    const existing = new Set(value.map(normalize))
    const next = [...value]
    for (const p of parts) {
      if (!existing.has(normalize(p)) && next.length < max) {
        next.push(p)
        existing.add(normalize(p))
      }
    }
    onChange(next)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-sunken py-0.5 pr-1 pl-2.5 text-[0.8125rem] text-ink">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded-full p-0.5 text-ink-3 hover:bg-line hover:text-ink"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={suggestions.length ? listId : undefined}
          value={draft}
          onChange={(e) => {
            const v = e.target.value
            // Choosing from the datalist fires a change without a key press.
            if (suggestions.includes(v)) add(v)
            else setDraft(v)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? '' : placeholder}
          aria-describedby={hint || error ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
      {(hint || error) && (
        <p id={`${id}-hint`} className={error ? 'text-xs font-medium text-danger' : 'text-xs text-ink-3'}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
