import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'

interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  /** When set, the person must type this text to enable the confirm button. */
  requireText?: string
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [typed, setTyped] = useState('')
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    setTyped('')
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  const blocked = Boolean(options?.requireText && typed.trim() !== options.requireText)

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(options)} onClose={() => close(false)} title={options?.title ?? ''} size="sm">
        {options?.description && <div className="text-sm leading-relaxed text-ink-2">{options.description}</div>}
        {options?.requireText && (
          <label className="mt-4 block text-sm text-ink-2">
            Type <span className="font-mono font-medium text-ink">{options.requireText}</span> to confirm
            <input
              className="field-input mt-1.5"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </label>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => close(false)}>
            {options?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={options?.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => close(true)}
            disabled={blocked}
            autoFocus={!options?.requireText}
          >
            {options?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
