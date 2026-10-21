import { BACKUP_APP, BACKUP_VERSION, MAX_IMPORT_BYTES, backupSchema, describeIssues, type BackupFile } from './validation'
import type { CollectionItem, Fragrance, UserSettings, WearLog } from './types'

export function buildBackup(input: {
  fragrances: Fragrance[]
  items: CollectionItem[]
  wearLogs: WearLog[]
  settings: UserSettings | null
}): BackupFile {
  const strip = <T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
    const copy = { ...obj }
    keys.forEach((k) => delete copy[k])
    return copy
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    fragrances: input.fragrances.map((f) => strip(f, ['owner_id', 'updated_at'])),
    collection_items: input.items.map((i) => strip(i, ['user_id', 'updated_at', 'status_changed_at'])),
    wear_logs: input.wearLogs.map((w) => strip(w, ['user_id'])),
    settings: input.settings
      ? {
          theme: input.settings.theme,
          currency: input.settings.currency,
          low_bottle_threshold: input.settings.low_bottle_threshold,
          spray_profile: input.settings.spray_profile,
        }
      : null,
  } as BackupFile
}

export type ParseResult = { ok: true; data: BackupFile } | { ok: false; errors: string[] }

export async function parseBackupFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, errors: [`File is ${(file.size / 1048576).toFixed(1)} MB; the limit is 10 MB.`] }
  }
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    return { ok: false, errors: ['This is not a valid JSON file.'] }
  }
  return parseBackup(json)
}

export function parseBackup(json: unknown): ParseResult {
  const result = backupSchema.safeParse(json)
  if (!result.success) return { ok: false, errors: describeIssues(result.error) }
  return { ok: true, data: result.data }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const backupFilename = (date = new Date()) =>
  `sillage-backup-${date.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
