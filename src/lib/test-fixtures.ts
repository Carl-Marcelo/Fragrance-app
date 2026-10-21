// Shared builders for unit tests.
import { blankFragrance, blankItem } from './defaults'
import type { CollectionEntry, Fragrance } from './types'

let counter = 0
const uuid = () => {
  counter++
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
}

export function makeFragrance(overrides: Partial<Fragrance> = {}): Fragrance {
  return {
    ...blankFragrance(),
    id: uuid(),
    owner_id: '00000000-0000-4000-8000-0000000000aa',
    name: 'Test Scent',
    brand: 'Test House',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeEntry(fragrance: Partial<Fragrance> = {}, item: Partial<CollectionEntry> = {}): CollectionEntry {
  const f = makeFragrance(fragrance)
  return {
    ...blankItem('owned'),
    id: uuid(),
    user_id: f.owner_id,
    fragrance_id: f.id,
    status_changed_at: f.created_at,
    created_at: f.created_at,
    updated_at: f.created_at,
    fragrance: f,
    ...item,
  }
}
