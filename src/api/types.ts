import type { BackupFile } from '../lib/validation'
import type {
  CollectionEntry,
  Fragrance,
  FragranceInput,
  ItemInput,
  ItemPatch,
  SettingsPatch,
  UserSettings,
  WearLog,
  WearLogInput,
} from '../lib/types'

export type Bucket = 'fragrance-images' | 'bottle-photos'

export interface ImportSummary {
  fragrances: number
  items: number
  wearLogs: number
  settings: boolean
}

/** Everything the UI needs from storage. Implemented by Supabase (cloud) and localStorage (preview). */
export interface DataApi {
  readonly mode: 'cloud' | 'local'

  // Public reference data
  listPublicFragrances(): Promise<Fragrance[]>
  getFragrance(id: string): Promise<Fragrance | null>

  // Owner data
  listMyFragrances(userId: string): Promise<Fragrance[]>
  saveFragrance(input: FragranceInput): Promise<Fragrance>
  updateFragrance(id: string, patch: Partial<FragranceInput>): Promise<Fragrance>
  deleteFragrance(id: string): Promise<void>

  listEntries(): Promise<CollectionEntry[]>
  saveEntry(fragrance: FragranceInput, item: ItemInput): Promise<CollectionEntry>
  addToCollection(fragranceId: string, item: ItemInput): Promise<CollectionEntry>
  updateItem(id: string, patch: ItemPatch): Promise<CollectionEntry>
  deleteEntry(entry: CollectionEntry): Promise<{ fragranceRemoved: boolean }>

  listWearLogs(): Promise<WearLog[]>
  saveWearLog(input: WearLogInput): Promise<WearLog>
  deleteWearLog(id: string): Promise<void>

  getSettings(userId: string): Promise<UserSettings | null>
  saveSettings(userId: string, patch: SettingsPatch): Promise<UserSettings>

  // Images
  readonly supportsUploads: boolean
  uploadImage(bucket: Bucket, file: File, userId: string): Promise<{ path: string; publicUrl: string | null }>
  signedUrl(path: string): Promise<string | null>
  publicUrl(path: string): string | null
  removeImage(bucket: Bucket, path: string): Promise<void>

  // Fragrance database usage this month (cloud only; null when unknown)
  getDiscoverUsage(): Promise<{ period: string; calls: number } | null>

  // Backup
  exportData(userId: string): Promise<BackupFile>
  importData(userId: string, data: BackupFile, mode: 'merge' | 'replace'): Promise<ImportSummary>
}
