// Philippine-weather spray guide. Pure functions, no network.
//
// Every number here is a practical starting point, not a measurement: the engine
// combines concentration, saved performance/character estimates, the occasion,
// and the environment (heat, humidity, rain, air-conditioning) into a spray
// range, placement, technique and risk notes. Users can shift the result with a
// profile offset or override any scenario per bottle.

import { concentrationLabel, SCENARIO_LABELS } from './constants'
import type {
  ApplicationPreference,
  Concentration,
  Fragrance,
  Scenario,
  SprayOverride,
  SprayProfile,
} from './types'

export type EnvKey = 'heat' | 'humidity' | 'rain' | 'aircon'
export type Environment = Record<EnvKey, boolean>
export type Surface = 'skin' | 'clothing' | 'both'
export type RiskLevel = 'low' | 'medium' | 'high'

/** The subset of fragrance data the engine reads. Everything is optional. */
export type SprayInput = Partial<
  Pick<
    Fragrance,
    | 'concentration'
    | 'projection'
    | 'longevity'
    | 'sweetness'
    | 'freshness'
    | 'darkness'
    | 'suit_hot'
    | 'suit_humid'
    | 'suit_rainy'
    | 'suit_aircon'
  >
>

export interface ScenarioMeta {
  label: string
  description: string
  env: Environment
  baseMin: number
  baseMax: number
  /** How much scent the setting tolerates before it becomes a nuisance. */
  tolerance: 'low' | 'medium'
}

export const SCENARIOS: Record<Scenario, ScenarioMeta> = {
  hot_day: {
    label: SCENARIO_LABELS.hot_day,
    description: 'Outdoors or commuting in 31–35 °C sun with high humidity.',
    env: { heat: true, humidity: true, rain: false, aircon: false },
    baseMin: 2,
    baseMax: 3,
    tolerance: 'low',
  },
  normal_day: {
    label: SCENARIO_LABELS.normal_day,
    description: 'Errands and casual days, moving between outdoors and indoors.',
    env: { heat: false, humidity: true, rain: false, aircon: false },
    baseMin: 3,
    baseMax: 4,
    tolerance: 'medium',
  },
  office: {
    label: SCENARIO_LABELS.office,
    description: 'Long hours in a shared, air-conditioned space at close quarters.',
    env: { heat: false, humidity: false, rain: false, aircon: true },
    baseMin: 2,
    baseMax: 3,
    tolerance: 'low',
  },
  night_date: {
    label: SCENARIO_LABELS.night_date,
    description: 'Cooler evening air and close-range moments.',
    env: { heat: false, humidity: true, rain: false, aircon: false },
    baseMin: 3,
    baseMax: 4,
    tolerance: 'medium',
  },
  special: {
    label: SCENARIO_LABELS.special,
    description: 'Weddings and formal events, often in air-conditioned halls for many hours.',
    env: { heat: false, humidity: false, rain: false, aircon: true },
    baseMin: 3,
    baseMax: 5,
    tolerance: 'medium',
  },
}

export const ENV_LABELS: Record<EnvKey, string> = {
  heat: 'Heat',
  humidity: 'Humidity',
  rain: 'Rain',
  aircon: 'Air-conditioning',
}

export const DEFAULT_SPRAY_PROFILE: SprayProfile = {
  globalOffset: 0,
  scenarioOffsets: {},
  application: 'auto',
}

const CONCENTRATION_STRENGTH: Record<Concentration, number> = {
  body_mist: 1,
  edc: 1.5,
  cologne: 1.5,
  edt: 2.5,
  edp: 3.5,
  parfum: 4,
  extrait: 4.5,
  elixir: 4.5,
  oil: 3.5,
  other: 3,
}

const CONCENTRATION_LONGEVITY: Record<Concentration, number> = {
  body_mist: 1,
  edc: 1.5,
  cologne: 2,
  edt: 2.5,
  edp: 3.5,
  parfum: 4,
  extrait: 4.5,
  elixir: 4.5,
  oil: 4,
  other: 3,
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round1 = (v: number) => Math.round(v * 10) / 10

export interface Profile {
  /** 1 (whisper) … 5 (beast mode) */
  strength: number
  /** 1 (airy, fresh) … 5 (dense, sweet/dark) */
  heaviness: number
  /** 1 … 5 */
  longevity: number
  sweetness: number
  /** True when the engine had to assume most values. */
  assumed: boolean
}

export function profileOf(f: SprayInput): Profile {
  const conc = f.concentration ? CONCENTRATION_STRENGTH[f.concentration] : null
  let strength: number
  if (f.projection != null && conc != null) strength = conc * 0.4 + f.projection * 0.6
  else if (f.projection != null) strength = f.projection
  else if (conc != null) strength = conc
  else strength = 3

  const heavyParts = [f.sweetness, f.darkness, f.freshness != null ? 6 - f.freshness : null].filter(
    (v): v is number => v != null,
  )
  const heaviness = heavyParts.length ? heavyParts.reduce((a, b) => a + b, 0) / heavyParts.length : 3

  const longevity = f.longevity ?? (f.concentration ? CONCENTRATION_LONGEVITY[f.concentration] : 3)

  return {
    strength: round1(strength),
    heaviness: round1(heaviness),
    longevity: round1(longevity),
    sweetness: f.sweetness ?? 3,
    assumed: f.projection == null && f.concentration == null,
  }
}

export interface EnvFit {
  key: EnvKey
  label: string
  rating: number
  verdict: 'Good' | 'Fair' | 'Use caution'
  note: string
  source: 'saved' | 'estimated'
}

const verdictOf = (r: number): EnvFit['verdict'] => (r >= 4 ? 'Good' : r >= 3 ? 'Fair' : 'Use caution')

/** How well the scent tends to behave in each condition (saved rating wins over estimate). */
export function environmentFit(f: SprayInput): EnvFit[] {
  const p = profileOf(f)
  const fresh = f.freshness ?? 3
  const dark = f.darkness ?? 3

  const estimates: Record<EnvKey, { saved: number | null | undefined; est: number; note: string }> = {
    heat: {
      saved: f.suit_hot,
      est: 3 + (fresh - 3) * 0.6 - (p.heaviness - 3) * 0.6 - (p.strength >= 4 ? 0.5 : 0),
      note:
        p.heaviness >= 3.5
          ? 'Dense, sweet or dark scents can turn cloying when the air is hot. Go light.'
          : 'Heat makes a scent evaporate and project faster; lighter compositions handle it best.',
    },
    humidity: {
      saved: f.suit_humid,
      est: 3 + (fresh - 3) * 0.5 - (p.sweetness - 3) * 0.6 - (dark - 3) * 0.3,
      note:
        p.sweetness >= 4
          ? 'Humid air makes sweet notes feel heavier and linger around you.'
          : 'Humidity keeps a scent close to you; fresh, clean profiles stay pleasant.',
    },
    rain: {
      saved: f.suit_rainy,
      est: 3 + (dark - 3) * 0.3 + (p.longevity - 3) * 0.2,
      note: 'Cooler, damp days suit slightly warmer scents; rain on exposed skin dilutes the fragrance.',
    },
    aircon: {
      saved: f.suit_aircon,
      est: 3 + (p.longevity - 3) * 0.3 + (p.strength - 3) * 0.15 - (p.strength >= 4.5 ? 0.6 : 0),
      note:
        p.strength >= 4
          ? 'Cold, recirculated air traps strong scents in closed rooms. Keep it modest.'
          : 'Cold, dry air mutes projection; clothing helps the scent last.',
    },
  }

  return (Object.keys(estimates) as EnvKey[]).map((key) => {
    const { saved, est, note } = estimates[key]
    const rating = saved != null ? saved : clamp(Math.round(est), 1, 5)
    return {
      key,
      label: ENV_LABELS[key],
      rating,
      verdict: verdictOf(rating),
      note,
      source: saved != null ? 'saved' : 'estimated',
    }
  })
}

export interface SprayRecommendation {
  scenario: Scenario
  min: number
  max: number
  rangeText: string
  customized: boolean
  userNote: string | null
  locations: string[]
  surface: Surface
  surfaceNote: string
  technique: string[]
  projection: { level: number; label: string }
  overspray: { level: RiskLevel; label: string; note: string }
  environment: EnvFit[]
  explanation: string
  adjustments: string[]
}

export interface RecommendOptions {
  env?: Partial<Environment>
  profile?: SprayProfile
  override?: SprayOverride | null
}

const strengthWord = (s: number) =>
  s < 1.8 ? 'very light' : s < 2.6 ? 'light' : s < 3.5 ? 'moderate' : s < 4.3 ? 'strong' : 'very strong'

const heavinessWord = (h: number) => (h < 2.4 ? 'airy, fresh' : h < 3.5 ? 'balanced' : 'rich, dense')

const surfaceLabel: Record<Surface, string> = {
  skin: 'Skin',
  clothing: 'Clothing',
  both: 'Skin and clothing',
}

export function rangeText(min: number, max: number) {
  const unit = max === 1 ? 'spray' : 'sprays'
  return min === max ? `${min} ${unit}` : `${min}–${max} ${unit}`
}

export function recommend(
  f: SprayInput,
  scenario: Scenario,
  { env: envOverride, profile = DEFAULT_SPRAY_PROFILE, override }: RecommendOptions = {},
): SprayRecommendation {
  const meta = SCENARIOS[scenario]
  const env: Environment = { ...meta.env, ...envOverride }
  const p = profileOf(f)
  const adjustments: string[] = []

  // ---- Spray count -------------------------------------------------------
  let min = meta.baseMin
  let max = meta.baseMax

  const strengthShift = Math.round(3 - p.strength)
  if (strengthShift !== 0) {
    min += strengthShift
    max += strengthShift
    adjustments.push(
      strengthShift < 0
        ? `${strengthShift} for a ${strengthWord(p.strength)} scent`
        : `+${strengthShift} for a ${strengthWord(p.strength)} scent`,
    )
  }
  // A saved rating of 4+ for heat/humidity outweighs the guess from character.
  const provenInHeat = (f.suit_hot ?? 0) >= 4
  const provenInHumidity = (f.suit_humid ?? 0) >= 4
  if (env.heat && p.heaviness >= 3.5 && !provenInHeat) {
    min -= 1
    max -= 1
    adjustments.push('−1 because rich scents bloom in heat')
  }
  if (env.humidity && p.sweetness >= 4 && !provenInHumidity) {
    max -= 1
    adjustments.push('−1 at the top end because humidity amplifies sweetness')
  }
  if (env.heat && p.heaviness >= 3.5 && provenInHeat) {
    adjustments.push('no heat reduction: it’s rated well for hot weather')
  }
  if (env.aircon && meta.tolerance === 'low' && p.strength >= 4) {
    max = Math.min(max, 2)
    adjustments.push('capped at 2 for a strong scent in a closed, air-conditioned room')
  }
  if (env.rain && p.heaviness < 2.5 && p.strength < 3) {
    max += 1
    adjustments.push('+1 at the top end because cool, damp air mutes light scents')
  }

  const offset = (profile.globalOffset ?? 0) + (profile.scenarioOffsets?.[scenario] ?? 0)
  if (offset !== 0) {
    min += offset
    max += offset
    adjustments.push(`${offset > 0 ? '+' : ''}${offset} from your spray preferences`)
  }

  const cap = f.concentration === 'body_mist' ? 10 : 8
  min = clamp(min, 1, cap)
  max = clamp(max, min, cap)

  let customized = false
  if (override && (override.min != null || override.max != null)) {
    const oMin = override.min ?? override.max ?? min
    const oMax = override.max ?? override.min ?? max
    min = clamp(Math.min(oMin, oMax), 0, 30)
    max = clamp(Math.max(oMin, oMax), min, 30)
    customized = true
  }

  // ---- Placement & surface ------------------------------------------------
  const locations = locationsFor(scenario, p)
  const surface = surfaceFor(profile.application, env, p, meta)
  const surfaceNote = surfaceNoteFor(surface, f, p)

  // ---- Technique -----------------------------------------------------------
  const technique = techniqueFor(scenario, env, p)

  // ---- Projection & overspray risk -----------------------------------------
  const mid = (min + max) / 2
  const baseMid = (meta.baseMin + meta.baseMax) / 2
  const projScore =
    p.strength +
    (mid - baseMid) * 0.35 +
    (env.heat ? 0.3 : 0) +
    (env.humidity && p.sweetness >= 4 ? 0.3 : 0) -
    (env.aircon ? 0.4 : 0) -
    (env.rain ? 0.2 : 0)
  const projLevel = projScore < 2.4 ? 1 : projScore < 3.6 ? 2 : projScore < 4.4 ? 3 : 4
  const projLabel = [
    '',
    'Intimate: noticeable when someone is close',
    'Moderate: about arm’s length',
    'Strong: fills a small room',
    'Very strong: noticeable across a room',
  ][projLevel]

  const riskScore =
    p.strength * 0.6 +
    p.heaviness * 0.3 +
    (max - 3) * 0.5 +
    (meta.tolerance === 'low' ? 0.8 : 0) +
    (env.heat && p.heaviness >= 3.5 ? 0.7 : 0) +
    (env.humidity && p.sweetness >= 4 ? 0.4 : 0) -
    (env.aircon && meta.tolerance !== 'low' ? 0.3 : 0)
  const riskLevel: RiskLevel = riskScore < 3.2 ? 'low' : riskScore < 4.1 ? 'medium' : 'high'
  const riskNote =
    riskLevel === 'high'
      ? `Stay at ${min} ${min === 1 ? 'spray' : 'sprays'}. You stop noticing your own scent within minutes, but others don’t.`
      : riskLevel === 'medium'
        ? 'Start at the low end and add one only if it fades from your clothes within an hour.'
        : 'Little risk of overdoing it at this range.'

  // ---- Explanation ---------------------------------------------------------
  const concText = f.concentration ? concentrationLabel(f.concentration) : 'An unspecified concentration'
  const character = heavinessWord(p.heaviness)
  const parts = [
    `${concText} with ${strengthWord(p.strength)} strength and ${/^[aeiou]/i.test(character) ? 'an' : 'a'} ${character} character.`,
    scenarioReason(scenario, env, p),
  ]
  if (p.assumed) parts.push('Concentration and projection aren’t recorded, so this assumes a moderate scent.')
  if (customized) parts.push('You set a custom spray count for this scenario.')

  return {
    scenario,
    min,
    max,
    rangeText: rangeText(min, max),
    customized,
    userNote: override?.note?.trim() || null,
    locations,
    surface,
    surfaceNote,
    technique,
    projection: { level: projLevel, label: projLabel },
    overspray: {
      level: riskLevel,
      label: riskLevel === 'low' ? 'Low' : riskLevel === 'medium' ? 'Medium' : 'High',
      note: riskNote,
    },
    environment: environmentFit(f),
    explanation: parts.join(' '),
    adjustments,
  }
}

function locationsFor(scenario: Scenario, p: Profile): string[] {
  switch (scenario) {
    case 'hot_day':
      return p.strength < 3
        ? ['Back of the neck', 'Chest, under your shirt', 'Inner elbows']
        : ['Back of the neck', 'Chest, under your shirt']
    case 'normal_day':
      return ['Sides of the neck', 'Chest', 'One wrist, without rubbing']
    case 'office':
      return ['Chest, under your shirt', 'Back of the neck']
    case 'night_date':
      return ['Sides of the neck', 'Behind the ears', 'Chest']
    case 'special':
      return ['Sides of the neck', 'Chest', 'Inside a jacket lapel or dress lining']
  }
}

function surfaceFor(pref: ApplicationPreference, env: Environment, p: Profile, meta: ScenarioMeta): Surface {
  if (pref !== 'auto') return pref
  if (p.longevity <= 2) return 'both'
  if (env.heat && p.strength >= 4) return 'skin'
  if (env.aircon && p.longevity <= 3) return 'both'
  if (meta.tolerance === 'medium' && !env.heat && p.longevity < 4) return 'both'
  return 'skin'
}

function surfaceNoteFor(surface: Surface, f: SprayInput, p: Profile): string {
  const staining =
    (f.darkness ?? 0) >= 4 || ['extrait', 'parfum', 'oil', 'elixir'].includes(f.concentration ?? '')
  const base: Record<Surface, string> = {
    skin: 'Skin lets the scent develop with body heat.',
    clothing: 'Fabric holds the scent longer and softens the opening.',
    both: `${surfaceLabel.both}: skin for warmth and development, one spray on fabric for longevity${p.longevity <= 2 ? ' (helps a short-lived scent)' : ''}.`,
  }
  if (surface === 'skin' && p.strength >= 4) {
    base.skin += ' Skip fabric: it holds strong scents long after you want it to.'
  }
  if (surface !== 'skin' && staining) {
    return `${base[surface]} Test on a hidden spot first; dark or oily formulas can stain light fabrics. Avoid silk and leather.`
  }
  return base[surface]
}

function techniqueFor(scenario: Scenario, env: Environment, p: Profile): string[] {
  const t = ['Spray from about 15–20 cm so the mist spreads evenly.', 'Don’t rub. Let it dry on its own.']
  if (env.heat || env.humidity) {
    t.push('Apply to clean, dry skin right after showering; sweat dilutes and distorts the scent.')
  }
  if (p.longevity <= 3 || env.heat) {
    t.push('An unscented moisturiser underneath helps it last longer.')
  }
  if (scenario === 'office') {
    t.push('Apply 20–30 minutes before you arrive so the opening settles before close contact.')
  }
  if (scenario === 'night_date') {
    t.push('Keep it at the neck and chest, where someone close will notice it. Skip the wrists if you’re eating.')
  }
  if (scenario === 'special' || p.longevity <= 2) {
    t.push('Bring a travel atomiser for a top-up after 4–5 hours instead of over-applying at the start.')
  }
  if (env.rain) {
    t.push('On rainy days keep the sprays under clothing, where rain won’t wash them off.')
  }
  return t
}

function scenarioReason(scenario: Scenario, env: Environment, p: Profile): string {
  switch (scenario) {
    case 'hot_day':
      return p.heaviness >= 3.5
        ? 'Philippine midday heat and humidity make dense scents loud and cloying, so the range is kept low and close to the body.'
        : 'Heat speeds up evaporation, so a few well-placed sprays under clothing work better than many on exposed skin.'
    case 'normal_day':
      return 'A typical humid day moving in and out of air-conditioning; a moderate range keeps it noticeable without crowding anyone.'
    case 'office':
      return env.aircon
        ? 'Recirculated office air keeps scent in the room for hours, so it should stay within your personal space.'
        : 'Shared workspaces call for a scent that stays within your personal space.'
    case 'night_date':
      return 'Cooler evening air lets richer notes show without overwhelming, and close-range placement matters more than volume.'
    case 'special':
      return 'Long formal events reward steady longevity; air-conditioned venues mute projection, so clothing helps.'
  }
}

/** Ranks how well a fragrance suits a scenario (0–100). Uses saved suitability first. */
export function scenarioScore(f: SprayInput & Partial<Fragrance>, scenario: Scenario): number {
  const fit = Object.fromEntries(environmentFit(f).map((e) => [e.key, e.rating])) as Record<EnvKey, number>
  const occasion: Record<Scenario, number | null | undefined> = {
    hot_day: f.suit_day,
    normal_day: f.suit_day,
    office: f.suit_office,
    night_date: f.suit_date ?? f.suit_night,
    special: f.suit_special,
  }
  const env = SCENARIOS[scenario].env
  const envParts: number[] = []
  if (env.heat) envParts.push(fit.heat)
  if (env.humidity) envParts.push(fit.humidity)
  if (env.aircon) envParts.push(fit.aircon)
  if (env.rain) envParts.push(fit.rain)
  const envScore = envParts.length ? envParts.reduce((a, b) => a + b, 0) / envParts.length : 3
  const occ = occasion[scenario]
  const p = profileOf(f)
  let score = occ != null ? occ * 0.6 + envScore * 0.4 : envScore
  if (scenario === 'office' && p.strength >= 4.3) score -= 0.5
  if (scenario === 'night_date' && p.heaviness >= 3.5) score += 0.3
  return Math.round(clamp(((score - 1) / 4) * 100, 0, 100))
}
