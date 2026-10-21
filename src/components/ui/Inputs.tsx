import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null
  onChange: (value: number | null) => void
  decimals?: boolean
}

/**
 * Text-backed numeric input: keeps what the person typed (e.g. "12.") while
 * reporting a number, null when empty, or NaN when it isn't a number so
 * validation can flag it.
 */
export function NumberInput({ value, onChange, decimals = true, className, ...rest }: NumberInputProps) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const lastEmitted = useRef<number | null>(value)

  useEffect(() => {
    if (value !== lastEmitted.current && !(Number.isNaN(value) && Number.isNaN(lastEmitted.current))) {
      setText(value == null ? '' : String(value))
      lastEmitted.current = value
    }
  }, [value])

  return (
    <input
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const t = e.target.value
        setText(t)
        const cleaned = t.replace(/,/g, '').trim()
        const next = cleaned === '' ? null : /^-?\d*\.?\d+$|^-?\d+\.?$/.test(cleaned) ? Number(cleaned) : Number.NaN
        lastEmitted.current = next
        onChange(next)
      }}
      className={cn('field-input tabular-nums', className)}
      {...rest}
    />
  )
}

/** Image picker with preview, used for reference images and private bottle photos. */
export function ImagePicker({
  previewUrl,
  onPick,
  onRemove,
  busy,
  disabled,
  label,
}: {
  previewUrl: string | null
  onPick: (file: File) => void
  onRemove: () => void
  busy?: boolean
  disabled?: boolean
  label: string
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-sunken">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="size-full object-contain" referrerPolicy="no-referrer" />
        ) : (
          <ImagePlus className="size-6 text-ink-3" aria-hidden />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPick(file)
            e.target.value = ''
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          disabled={disabled}
          onClick={() => input.current?.click()}
          icon={<ImagePlus />}
        >
          {previewUrl ? 'Replace' : label}
        </Button>
        {previewUrl && (
          <Button variant="ghost" size="sm" onClick={onRemove} disabled={busy} icon={<Trash2 />}>
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
