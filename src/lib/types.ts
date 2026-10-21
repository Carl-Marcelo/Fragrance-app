// Domain types. Shapes mirror the Supabase tables in supabase/migrations.

export type Concentration =
  | 'body_mist'
  | 'edc'
  | 'cologne'
  | 'edt'
  | 'edp'
  | 'parfum'
  | 'extrait'
  | 'elixir'
  | 'oil'
  | 'other'

export type CollectionStatus = 'owned' | 'wishlist' | 'previously_owned'
export type InfoStatus = 'verified' | 'unverified' | 'needs_review'
export type RatingsBasis = 'personal' | 'estimate' | 'community'
export type Scenario = 'hot_day' | 'normal_day' | 'office' | 'night_date' | 'special'
export type WearWeather = 'hot' | 'humid' | 'rainy' | 'mild' | 'aircon'
export type ThemePreference = 'light' | 'dark' | 'system'
export type SourceKind = 'official' | 'reference' | 'retailer' | 'other'

export interface SourceLink {
  label: string
  url: string
  kind: SourceKind
}

/** 1–5 subjective scale; null when unknown. */
export type ScaleValue = number | null

export interface Fragrance {
  id: string
  owner_id: string
  is_public: boolean
  name: string
  brand: string
  concentration: Concentration | null
  release_year: number | null
  family: string | null
  perfumers: string[]
  description: string | null
  notes_top: string[]
  notes_middle: string[]
  notes_base: string[]
  accords: string[]
  sweetness: ScaleValue
  freshness: ScaleValue
  darkness: ScaleValue
  masculinity: ScaleValue
  projection: ScaleValue
  longevity: ScaleValue
  suit_hot: ScaleValue
  suit_humid: ScaleValue
  suit_rainy: ScaleValue
  suit_aircon: ScaleValue
  suit_day: ScaleValue
  suit_night: ScaleValue
  suit_office: ScaleValue
  suit_date: ScaleValue
  suit_special: ScaleValue
  info_status: InfoStatus
  ratings_basis: RatingsBasis
  source_links: SourceLink[]
  image_url: string | null
  image_path: string | null
  image_credit: string | null
  /** Set when the record was added from the external fragrance database. */
  external_source: 'fragella' | null
  external_id: string | null
  brand_country: string | null
  created_at: string
  updated_at: string
}

export interface SprayOverride {
  min?: number | null
  max?: number | null
  note?: string | null
}

export type SprayOverrides = Partial<Record<Scenario, SprayOverride>>

export interface CollectionItem {
  id: string
  user_id: string
  fragrance_id: string
  status: CollectionStatus
  is_favorite: boolean
  personal_rating: number | null
  personal_notes: string | null
  want_reason: string | null
  wishlist_priority: number | null
  bottle_size_ml: number | null
  remaining_percent: number | null
  is_decant: boolean
  purchase_price: number | null
  currency: string
  purchase_date: string | null
  purchase_from: string | null
  bottle_image_path: string | null
  spray_overrides: SprayOverrides
  status_changed_at: string
  created_at: string
  updated_at: string
}

/** A private collection record joined with its fragrance reference. */
export interface CollectionEntry extends CollectionItem {
  fragrance: Fragrance
}

export interface WearLog {
  id: string
  user_id: string
  collection_item_id: string
  worn_on: string
  scenario: Scenario | null
  weather: WearWeather | null
  sprays: number | null
  longevity_hours: number | null
  rating: number | null
  compliments: number | null
  notes: string | null
  created_at: string
}

export type ApplicationPreference = 'auto' | 'skin' | 'clothing' | 'both'

export interface SprayProfile {
  /** Added to every recommendation, -2…+2. */
  globalOffset: number
  /** Extra per-scenario adjustment, -2…+2. */
  scenarioOffsets: Partial<Record<Scenario, number>>
  application: ApplicationPreference
}

export interface UserSettings {
  user_id: string
  theme: ThemePreference
  currency: string
  low_bottle_threshold: number
  spray_profile: SprayProfile
  updated_at: string
}

// ----- Inputs ---------------------------------------------------------------

type ServerManaged = 'id' | 'owner_id' | 'created_at' | 'updated_at'

export type FragranceInput = Omit<Fragrance, ServerManaged> & { id?: string }

export type ItemInput = Omit<
  CollectionItem,
  'id' | 'user_id' | 'fragrance_id' | 'created_at' | 'updated_at' | 'status_changed_at'
> & { id?: string }

export type ItemPatch = Partial<ItemInput>

export type WearLogInput = Omit<WearLog, 'id' | 'user_id' | 'created_at'> & { id?: string }

export type SettingsPatch = Partial<Omit<UserSettings, 'user_id' | 'updated_at'>>
