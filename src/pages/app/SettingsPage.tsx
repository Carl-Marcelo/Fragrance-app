import { CircleAlert, Download, FileJson, KeyRound, LogOut, Monitor, Moon, Sun, Upload } from 'lucide-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { Notice } from '../../components/ui/States'
import { useQuery } from '@tanstack/react-query'
import { useDiscoverStatus } from '../../hooks/discover'
import { useImportData, useSaveSettings, useSettings } from '../../hooks/queries'
import { useScrollToHash } from '../../hooks/useScrollToHash'
import { CURRENCIES, SCENARIO_LABELS, SCENARIO_ORDER } from '../../lib/constants'
import { backupFilename, downloadJson, parseBackupFile } from '../../lib/backup'
import { cn } from '../../lib/cn'
import { errorMessage, formatDate, plural } from '../../lib/format'
import { DEFAULT_SPRAY_PROFILE, recommend } from '../../lib/spray'
import type { ApplicationPreference, SprayProfile, ThemePreference } from '../../lib/types'
import type { BackupFile } from '../../lib/validation'
import { useAuth } from '../../providers/AuthProvider'
import { useConfirm } from '../../providers/ConfirmProvider'
import { useTheme } from '../../providers/ThemeProvider'
import { useToast } from '../../providers/ToastProvider'

function Section({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="card scroll-mt-24 p-5 sm:p-6">
      <h2 id={`${id}-h`} className="text-2xl">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-line p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors [&_svg]:size-4',
            value === o.value ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const OFFSETS = [-2, -1, 0, 1, 2].map((v) => ({ value: v, label: v > 0 ? `+${v}` : String(v) }))

export default function SettingsPage() {
  const { settings, loaded } = useSettings()
  const save = useSaveSettings()
  const theme = useTheme()
  const toast = useToast()
  useScrollToHash(loaded || api.mode === 'local')

  const saveField = (patch: Parameters<typeof save.mutate>[0], message = 'Saved') =>
    save.mutate(patch, {
      onSuccess: () => toast.success(message),
      onError: (e) => toast.error('Couldn’t save settings', errorMessage(e)),
    })

  const profile: SprayProfile = { ...DEFAULT_SPRAY_PROFILE, ...settings.spray_profile }
  const setProfile = (patch: Partial<SprayProfile>) => saveField({ spray_profile: { ...profile, ...patch } }, 'Spray preferences saved')

  const example = recommend({ concentration: 'edp', projection: 3, sweetness: 3, freshness: 3, darkness: 3 }, 'normal_day', {
    profile,
  })

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Manage" title="Settings" />

      <Section id="appearance" title="Appearance" description="Your choice is saved to your account and follows you across devices.">
        <Segmented<ThemePreference>
          label="Theme"
          value={theme.preference}
          onChange={(v) => theme.setPreference(v)}
          options={[
            { value: 'light', label: (<><Sun /> Light</>) },
            { value: 'dark', label: (<><Moon /> Dark</>) },
            { value: 'system', label: (<><Monitor /> Match device</>) },
          ]}
        />
      </Section>

      <Section id="preferences" title="Preferences">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Default currency" hint="Used for new records. Existing prices keep their own currency.">
            <select className="field-input" value={settings.currency} onChange={(e) => saveField({ currency: e.target.value })}>
              {[...new Set([settings.currency, ...CURRENCIES])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label={`Low-bottle alert at ${settings.low_bottle_threshold}%`} hint="Owned bottles at or below this level are flagged.">
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              defaultValue={settings.low_bottle_threshold}
              key={settings.low_bottle_threshold}
              onPointerUp={(e) => saveField({ low_bottle_threshold: Number((e.target as HTMLInputElement).value) })}
              onKeyUp={(e) => saveField({ low_bottle_threshold: Number((e.target as HTMLInputElement).value) })}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </Field>
        </div>
      </Section>

      <Section
        id="spray"
        title="Spray preferences"
        description="Shift every recommendation up or down to match your skin and atomisers. Per-bottle overrides are set on each perfume."
      >
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">All scenarios</p>
            <Segmented label="Overall adjustment" value={profile.globalOffset} options={OFFSETS} onChange={(v) => setProfile({ globalOffset: v })} />
            <p className="mt-2 text-xs text-ink-3">
              Example: a moderate EDP on a normal day becomes <span className="font-medium text-ink">{example.rangeText}</span>.
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Per scenario</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {SCENARIO_ORDER.map((s) => (
                <li key={s} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-ink">{SCENARIO_LABELS[s]}</span>
                  <Segmented
                    label={`${SCENARIO_LABELS[s]} adjustment`}
                    value={profile.scenarioOffsets[s] ?? 0}
                    options={OFFSETS}
                    onChange={(v) => setProfile({ scenarioOffsets: { ...profile.scenarioOffsets, [s]: v } })}
                  />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Where to apply</p>
            <Segmented<ApplicationPreference>
              label="Application surface"
              value={profile.application}
              onChange={(v) => setProfile({ application: v })}
              options={[
                { value: 'auto', label: 'Let the guide decide' },
                { value: 'skin', label: 'Skin' },
                { value: 'clothing', label: 'Clothing' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </div>
        </div>
      </Section>

      <DiscoverSection />

      <DataSection />

      <AccountSection />
    </div>
  )
}

function DiscoverSection() {
  const status = useDiscoverStatus()
  const usage = useQuery({ queryKey: ['discover-usage'], queryFn: () => api.getDiscoverUsage(), staleTime: 60_000 })
  const s = status.data

  return (
    <Section
      id="database"
      title="Fragrance database"
      description="Live search on Discover and when adding perfumes, powered by the Fragella API."
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-3">Status</dt>
          <dd className="mt-1 text-sm font-medium text-ink">
            {status.isPending ? '…' : s?.available ? 'Connected' : s?.configured ? 'Key set, safeguards missing' : 'Not connected'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Shared search limits</dt>
          <dd className="mt-1 text-sm font-medium text-ink">{s?.limitsShared ? 'Enforced in Supabase' : 'Not configured'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Paid calls this month</dt>
          <dd className="mt-1 font-display text-2xl text-ink tabular-nums">{usage.data ? usage.data.calls : '—'}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-ink-2">
        Repeated searches are served from Vercel’s cache for 24 hours and don’t count. Each visitor is rate-limited, and
        searching pauses once the monthly cap is reached. Change the key and limits in your Vercel environment variables
        (<code className="rounded bg-sunken px-1">FRAGELLA_API_KEY</code>,{' '}
        <code className="rounded bg-sunken px-1">DISCOVER_MONTHLY_CAP</code>), then redeploy.
      </p>
    </Section>
  )
}

function DataSection() {
  const { user } = useAuth()
  const importData = useImportData()
  const confirm = useConfirm()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [pending, setPending] = useState<{ file: string; data: BackupFile } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')

  const exportNow = async (silent = false) => {
    if (!user) return false
    setExporting(true)
    try {
      const data = await api.exportData(user.id)
      downloadJson(backupFilename(), data)
      if (!silent) {
        toast.success(
          'Backup downloaded',
          `${plural(data.collection_items.length, 'record')}, ${plural(data.fragrances.length, 'fragrance')}, ${plural(data.wear_logs.length, 'wear entry', 'wear entries')}.`,
        )
      }
      return true
    } catch (e) {
      toast.error('Export failed', errorMessage(e))
      return false
    } finally {
      setExporting(false)
    }
  }

  const onFile = async (file: File) => {
    setErrors([])
    setPending(null)
    const result = await parseBackupFile(file)
    if (!result.ok) setErrors(result.errors)
    else setPending({ file: file.name, data: result.data })
  }

  const runImport = async () => {
    if (!pending) return
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace everything?',
        description:
          'All current fragrances, collection records and wear entries in this account are deleted and replaced with the file’s contents. A safety backup of your current data is downloaded first.',
        confirmLabel: 'Replace my data',
        tone: 'danger',
        requireText: 'REPLACE',
      })
      if (!ok) return
      const backedUp = await exportNow(true)
      if (!backedUp) return
    }
    try {
      const summary = await importData.mutateAsync({ data: pending.data, mode })
      toast.success(
        'Import complete',
        `${plural(summary.items, 'record')}, ${plural(summary.fragrances, 'fragrance')}, ${plural(summary.wearLogs, 'wear entry', 'wear entries')}${summary.settings ? ', settings' : ''}.`,
      )
      setPending(null)
    } catch (e) {
      toast.error('Import failed', `${errorMessage(e)} Nothing after the failed step was imported; your backup file is unchanged.`)
    }
  }

  return (
    <Section
      id="data"
      title="Backup & restore"
      description="Your collection lives in the cloud database. Exports are an extra copy you control."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => exportNow()} loading={exporting} icon={<Download />}>
            Export JSON backup
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()} icon={<Upload />}>
            Import from file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
        </div>

        {errors.length > 0 && (
          <Notice tone="warning" icon={<CircleAlert />}>
            <p className="font-medium text-ink">This file can’t be imported</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Notice>
        )}

        {pending && (
          <div className="rounded-lg border border-line p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <FileJson className="size-4 text-accent" aria-hidden /> {pending.file}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              Exported {formatDate(pending.data.exported_at)} · {plural(pending.data.collection_items.length, 'record')} ·{' '}
              {plural(pending.data.fragrances.length, 'fragrance')} ·{' '}
              {plural(pending.data.wear_logs.length, 'wear entry', 'wear entries')}
              {pending.data.settings ? ' · settings' : ''}
            </p>
            <fieldset className="mt-4 space-y-2">
              <legend className="mb-1 text-sm font-medium text-ink">How should it be imported?</legend>
              {(
                [
                  ['merge', 'Merge', 'Add new records and update ones with the same ID. Nothing is deleted.'],
                  ['replace', 'Replace', 'Delete everything in this account first, then import the file.'],
                ] as const
              ).map(([value, label, desc]) => (
                <label key={value} className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input
                    type="radio"
                    name="import-mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="font-medium text-ink">{label}</span>
                    <span className="block text-ink-3">{desc}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={runImport} loading={importData.isPending}>
                {mode === 'replace' ? 'Replace and import' : 'Import'}
              </Button>
            </div>
          </div>
        )}

        <details className="rounded-lg border border-line p-4 text-sm text-ink-2">
          <summary className="cursor-pointer font-medium text-ink select-none">Backup and restore instructions</summary>
          <div className="mt-3 space-y-3 leading-relaxed">
            <p>
              <strong className="text-ink">Regular backups.</strong> Export a JSON backup monthly and after big changes.
              Keep it somewhere private, such as a personal cloud drive. The file contains your prices, ratings and
              notes, so don’t share it.
            </p>
            <p>
              <strong className="text-ink">What’s included.</strong> Fragrance profiles, collection records, wear log and
              settings. Uploaded image files aren’t inside the JSON: download them from Supabase Storage (buckets
              <code className="mx-1 rounded bg-sunken px-1">fragrance-images</code>and
              <code className="mx-1 rounded bg-sunken px-1">bottle-photos</code>) if you need copies. Image links keep
              working while the original storage exists.
            </p>
            <p>
              <strong className="text-ink">Restore.</strong> Sign in, open this page, choose <em>Import from file</em>,
              check the summary, then pick <em>Merge</em> to combine or <em>Replace</em> for a clean restore. The file is
              validated before anything is written.
            </p>
            <p>
              <strong className="text-ink">Moving to a new Supabase project.</strong> Run the SQL migrations, create
              your owner account, then import the backup. See <code className="rounded bg-sunken px-1">docs/BACKUP.md</code>{' '}
              in the project for database-level backups.
            </p>
          </div>
        </details>
      </div>
    </Section>
  )
}

function AccountSection() {
  const { user, mode, signOut, updatePassword } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 10) return setError('Use at least 10 characters.')
    setBusy(true)
    try {
      await updatePassword(password)
      setPassword('')
      toast.success('Password changed')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section id="account" title="Account">
      <div className="space-y-5">
        <p className="text-sm text-ink-2">
          {mode === 'local' ? (
            'Local preview. Data is stored in this browser only and is not backed up to the cloud.'
          ) : (
            <>
              Signed in as <span className="font-medium text-ink">{user?.email}</span>. Data syncs to your Supabase
              database and is protected by Row Level Security.
            </>
          )}
        </p>
        {mode === 'cloud' && (
          <form onSubmit={changePassword} className="flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
            <Field label="New password" error={error ?? undefined} className="flex-1 sm:max-w-xs">
              <input
                type="password"
                autoComplete="new-password"
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="secondary" loading={busy} icon={<KeyRound />} className={error ? 'sm:mb-5' : undefined}>
              Change password
            </Button>
          </form>
        )}
        <Button
          variant="secondary"
          icon={<LogOut />}
          onClick={async () => {
            await signOut()
            navigate('/', { replace: true })
          }}
        >
          {mode === 'local' ? 'Leave preview' : 'Sign out'}
        </Button>
      </div>
    </Section>
  )
}
