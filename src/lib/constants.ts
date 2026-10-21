import type {
  CollectionStatus,
  Concentration,
  InfoStatus,
  RatingsBasis,
  Scenario,
  SourceKind,
  WearWeather,
} from './types'

export const APP_NAME = 'Sillage'

export const CONCENTRATIONS: { value: Concentration; label: string; short: string; hint: string }[] = [
  { value: 'body_mist', label: 'Body mist', short: 'Mist', hint: 'Very light, about 1–3% aromatic oils' },
  { value: 'edc', label: 'Eau de Cologne', short: 'EDC', hint: 'Light, typically 2–5%' },
  { value: 'cologne', label: 'Cologne', short: 'Cologne', hint: 'Brand-defined; often light' },
  { value: 'edt', label: 'Eau de Toilette', short: 'EDT', hint: 'Typically 5–15%' },
  { value: 'edp', label: 'Eau de Parfum', short: 'EDP', hint: 'Typically 15–20%' },
  { value: 'parfum', label: 'Parfum', short: 'Parfum', hint: 'Typically 20–30%' },
  { value: 'extrait', label: 'Extrait de Parfum', short: 'Extrait', hint: 'Typically 20–40%' },
  { value: 'elixir', label: 'Elixir', short: 'Elixir', hint: 'Brand-defined; usually intense' },
  { value: 'oil', label: 'Perfume oil', short: 'Oil', hint: 'Applied by dab or roller' },
  { value: 'other', label: 'Other', short: 'Other', hint: 'Anything else' },
]

export const concentrationLabel = (c: Concentration | null | undefined, short = false) => {
  const found = CONCENTRATIONS.find((x) => x.value === c)
  return found ? (short ? found.short : found.label) : ''
}

export const FAMILIES = [
  'Amber',
  'Aromatic',
  'Aquatic',
  'Chypre',
  'Citrus',
  'Floral',
  'Fougère',
  'Fresh',
  'Fruity',
  'Gourmand',
  'Green',
  'Leather',
  'Musky',
  'Powdery',
  'Spicy',
  'Woody',
] as const

export const COMMON_ACCORDS = [
  'aldehydic', 'amber', 'animalic', 'aquatic', 'aromatic', 'balsamic', 'boozy', 'caramel', 'cherry',
  'chocolate', 'cinnamon', 'citrus', 'coconut', 'coffee', 'earthy', 'floral', 'fresh', 'fresh spicy',
  'fruity', 'gourmand', 'green', 'herbal', 'honey', 'iris', 'lactonic', 'lavender', 'leather',
  'marine', 'metallic', 'mineral', 'mossy', 'musky', 'oud', 'ozonic', 'patchouli', 'powdery',
  'rose', 'salty', 'smoky', 'soft spicy', 'sweet', 'tobacco', 'tropical', 'tuberose', 'vanilla',
  'violet', 'warm spicy', 'white floral', 'woody', 'yellow floral',
]

export const COMMON_NOTES = [
  'Agarwood (Oud)', 'Aldehydes', 'Almond', 'Amber', 'Ambergris', 'Ambroxan', 'Ambrette', 'Apple',
  'Bamboo', 'Basil', 'Bergamot', 'Benzoin', 'Birch', 'Black Currant', 'Black Pepper', 'Black Tea',
  'Blackberry', 'Bourbon Vanilla', 'Calabrian Bergamot', 'Calone', 'Cardamom', 'Caramel', 'Carrot Seeds',
  'Cashmeran', 'Cashmere Wood', 'Cedar', 'Chamomile', 'Cherry', 'Cinnamon', 'Cistus', 'Civet',
  'Clary Sage', 'Clove', 'Cocoa', 'Coconut', 'Coffee', 'Coriander', 'Cumin', 'Cypress', 'Elemi',
  'Freesia', 'Galbanum', 'Gardenia', 'Geranium', 'Ginger', 'Grapefruit', 'Green Apple', 'Green Tea',
  'Guaiac Wood', 'Hazelnut', 'Heliotrope', 'Honey', 'Incense', 'Iris', 'Jasmine', 'Juniper Berries',
  'Labdanum', 'Lavender', 'Leather', 'Lemon', 'Lily-of-the-Valley', 'Lime', 'Lychee', 'Magnolia',
  'Mandarin Orange', 'Mango', 'Melon', 'Mint', 'Moss', 'Musk', 'Myrrh', 'Neroli', 'Nutmeg',
  'Oakmoss', 'Olibanum', 'Orange', 'Orange Blossom', 'Orris Root', 'Osmanthus', 'Patchouli', 'Peach',
  'Pear', 'Peony', 'Pepper', 'Petitgrain', 'Pineapple', 'Pink Pepper', 'Plum', 'Praline', 'Raspberry',
  'Rhubarb', 'Rose', 'Rosemary', 'Rum', 'Saffron', 'Sage', 'Salt', 'Sandalwood', 'Sea Notes',
  'Sichuan Pepper', 'Suede', 'Tobacco', 'Tobacco Leaf', 'Tolu Balsam', 'Tonka Bean', 'Tuberose',
  'Vanilla', 'Vetiver', 'Violet', 'Violet Leaf', 'Water Notes', 'White Musk', 'Woody Notes', 'Ylang-Ylang',
  'Yuzu',
]

export const STATUSES: { value: CollectionStatus; label: string; plural: string }[] = [
  { value: 'owned', label: 'Owned', plural: 'My Collection' },
  { value: 'wishlist', label: 'Wishlist', plural: 'My Wishlist' },
  { value: 'previously_owned', label: 'Previously owned', plural: 'Previously Owned' },
]

export const statusLabel = (s: CollectionStatus) => STATUSES.find((x) => x.value === s)?.label ?? s

export const INFO_STATUS: Record<InfoStatus, { label: string; description: string }> = {
  verified: {
    label: 'Verified',
    description: 'Facts (notes, concentration, year) checked against an official or reputable source.',
  },
  unverified: {
    label: 'Unverified',
    description: 'Entered manually and not yet checked against a reliable source.',
  },
  needs_review: {
    label: 'Needs review',
    description: 'Some details may be wrong or incomplete.',
  },
}

export const RATINGS_BASIS: Record<RatingsBasis, string> = {
  personal: 'My own impressions',
  estimate: 'Estimate',
  community: 'Community consensus',
}

export const SOURCE_KINDS: { value: SourceKind; label: string }[] = [
  { value: 'official', label: 'Official brand site' },
  { value: 'reference', label: 'Fragrance reference' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'other', label: 'Other' },
]

export const SCENARIO_ORDER: Scenario[] = ['hot_day', 'normal_day', 'office', 'night_date', 'special']

export const SCENARIO_LABELS: Record<Scenario, string> = {
  hot_day: 'Hot daytime',
  normal_day: 'Normal daytime',
  office: 'Office',
  night_date: 'Night date',
  special: 'Special occasion',
}

export const WEAR_WEATHER: { value: WearWeather; label: string }[] = [
  { value: 'hot', label: 'Hot & sunny' },
  { value: 'humid', label: 'Humid' },
  { value: 'rainy', label: 'Rainy' },
  { value: 'mild', label: 'Mild' },
  { value: 'aircon', label: 'Mostly air-conditioned' },
]

export const CHARACTER_SCALES = [
  { key: 'sweetness', label: 'Sweetness', low: 'Dry', high: 'Sweet' },
  { key: 'freshness', label: 'Freshness', low: 'Warm', high: 'Fresh' },
  { key: 'darkness', label: 'Darkness', low: 'Bright', high: 'Dark' },
  { key: 'masculinity', label: 'Feminine ↔ Masculine', low: 'Feminine', high: 'Masculine' },
] as const

export const PERFORMANCE_SCALES = [
  { key: 'projection', label: 'Projection', low: 'Intimate', high: 'Enormous' },
  { key: 'longevity', label: 'Longevity', low: 'Under 2 h', high: '12 h +' },
] as const

export const WEATHER_SUITABILITY = [
  { key: 'suit_hot', filter: 'hot', label: 'Heat' },
  { key: 'suit_humid', filter: 'humid', label: 'Humidity' },
  { key: 'suit_rainy', filter: 'rainy', label: 'Rainy days' },
  { key: 'suit_aircon', filter: 'aircon', label: 'Air-conditioned' },
] as const

export const OCCASION_SUITABILITY = [
  { key: 'suit_day', filter: 'day', label: 'Daytime' },
  { key: 'suit_night', filter: 'night', label: 'Night' },
  { key: 'suit_office', filter: 'office', label: 'Office' },
  { key: 'suit_date', filter: 'date', label: 'Date night' },
  { key: 'suit_special', filter: 'special', label: 'Special occasion' },
] as const

export const SCALE_WORDS = ['', 'Very low', 'Low', 'Moderate', 'High', 'Very high'] as const

export const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'HKD', 'AED'] as const

export const DEFAULT_CURRENCY = 'PHP'
export const DEFAULT_LOW_BOTTLE_THRESHOLD = 20
