import { describe, expect, it } from 'vitest'
import { SCENARIO_ORDER } from './constants'
import { environmentFit, profileOf, rangeText, recommend, scenarioScore } from './spray'

const freshEdt = { concentration: 'edt' as const, projection: 2, longevity: 2, sweetness: 1, freshness: 5, darkness: 1 }
const heavyExtrait = { concentration: 'extrait' as const, projection: 5, longevity: 5, sweetness: 5, freshness: 1, darkness: 5 }

describe('profileOf', () => {
  it('blends concentration and projection into strength', () => {
    expect(profileOf({ concentration: 'edp', projection: 3 }).strength).toBeCloseTo(3.2)
  })
  it('assumes a moderate scent when nothing is known', () => {
    const p = profileOf({})
    expect(p.strength).toBe(3)
    expect(p.heaviness).toBe(3)
    expect(p.assumed).toBe(true)
  })
})

describe('recommend', () => {
  it('always returns a sane range for every scenario and extreme', () => {
    for (const input of [{}, freshEdt, heavyExtrait, { concentration: 'body_mist' as const }]) {
      for (const s of SCENARIO_ORDER) {
        const r = recommend(input, s)
        expect(r.min).toBeGreaterThanOrEqual(1)
        expect(r.max).toBeGreaterThanOrEqual(r.min)
        expect(r.max).toBeLessThanOrEqual(10)
        expect(r.locations.length).toBeGreaterThan(0)
        expect(r.technique.length).toBeGreaterThan(0)
        expect(r.explanation.length).toBeGreaterThan(20)
        expect(r.environment).toHaveLength(4)
      }
    }
  })

  it('suggests fewer sprays for a heavy extrait than a fresh EDT on a hot day', () => {
    const heavy = recommend(heavyExtrait, 'hot_day')
    const fresh = recommend(freshEdt, 'hot_day')
    expect(heavy.max).toBeLessThan(fresh.max)
    expect(heavy.overspray.level).toBe('high')
  })

  it('caps strong scents in an air-conditioned office', () => {
    const r = recommend(heavyExtrait, 'office')
    expect(r.max).toBeLessThanOrEqual(2)
  })

  it('applies profile offsets and clamps to at least one spray', () => {
    const base = recommend(freshEdt, 'normal_day')
    const plus = recommend(freshEdt, 'normal_day', { profile: { globalOffset: 2, scenarioOffsets: {}, application: 'auto' } })
    expect(plus.min).toBe(base.min + 2)
    const minus = recommend(heavyExtrait, 'office', {
      profile: { globalOffset: -2, scenarioOffsets: { office: -2 }, application: 'auto' },
    })
    expect(minus.min).toBe(1)
  })

  it('honours per-bottle overrides and marks them as customised', () => {
    const r = recommend(freshEdt, 'night_date', { override: { min: 6, max: 4, note: 'one on the scarf' } })
    expect([r.min, r.max]).toEqual([4, 6])
    expect(r.customized).toBe(true)
    expect(r.userNote).toBe('one on the scarf')
  })

  it('respects an explicit application preference', () => {
    const r = recommend(freshEdt, 'hot_day', { profile: { globalOffset: 0, scenarioOffsets: {}, application: 'clothing' } })
    expect(r.surface).toBe('clothing')
  })

  it('trusts a saved hot-weather rating over the heaviness guess', () => {
    const rich = { concentration: 'edp' as const, projection: 3, sweetness: 4, darkness: 4, freshness: 2 }
    const guessed = recommend(rich, 'hot_day')
    const proven = recommend({ ...rich, suit_hot: 5 }, 'hot_day')
    expect(proven.max).toBeGreaterThan(guessed.max)
    expect(proven.adjustments.join(' ')).toMatch(/rated well for hot weather/)
  })

  it('responds to environment toggles', () => {
    const dry = recommend(heavyExtrait, 'normal_day', { env: { heat: false, humidity: false } })
    const hot = recommend(heavyExtrait, 'normal_day', { env: { heat: true, humidity: true } })
    expect(hot.max).toBeLessThan(dry.max)
    expect(hot.adjustments.some((a) => a.includes('heat'))).toBe(true)
  })
})

describe('environmentFit', () => {
  it('prefers saved ratings over estimates', () => {
    const fit = environmentFit({ ...heavyExtrait, suit_hot: 5 })
    const heat = fit.find((f) => f.key === 'heat')!
    expect(heat.rating).toBe(5)
    expect(heat.source).toBe('saved')
  })
  it('estimates fresh scents as better in heat than heavy ones', () => {
    const fresh = environmentFit(freshEdt).find((f) => f.key === 'heat')!
    const heavy = environmentFit(heavyExtrait).find((f) => f.key === 'heat')!
    expect(fresh.rating).toBeGreaterThan(heavy.rating)
    expect(heavy.verdict).toBe('Use caution')
  })
})

describe('scenarioScore', () => {
  it('ranks a fresh scent above a heavy one for hot days', () => {
    expect(scenarioScore(freshEdt, 'hot_day')).toBeGreaterThan(scenarioScore(heavyExtrait, 'hot_day'))
  })
})

describe('rangeText', () => {
  it('formats single and ranged counts', () => {
    expect(rangeText(1, 1)).toBe('1 spray')
    expect(rangeText(2, 2)).toBe('2 sprays')
    expect(rangeText(2, 4)).toBe('2–4 sprays')
  })
})
