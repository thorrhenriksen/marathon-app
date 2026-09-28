import { describe, it, expect } from 'vitest'
import { generateStrengthSessions } from './strengthSchedule'
import { generatePlan } from '../db/seed'
import { WEEK_PLAN } from '../db/weekPlan'
import {
  blockForWeek,
  effectiveStrengthExercises,
  hasKeySessionWithin48h,
  planStrengthWeek,
  type StrengthWeekContext,
} from './strengthBlocks'
import { daysBetween } from './dates'
import type { Session } from '../types'

const all = generateStrengthSessions()
const byWeek = (w: number) => all.filter((s) => s.week === w).sort((a, b) => (a.date < b.date ? -1 : 1))
const ids = (s: Session) => (s.exercises ?? []).map((e) => e.exerciseId)
const isMobilityOnly = (s: Session) => /mobility only/.test(s.description)
const variantOf = (w: number, v: 'A' | 'B') => byWeek(w).find((s) => s.variant === v && !isMobilityOnly(s))!

describe('block boundaries', () => {
  it('maps weeks to the six blocks', () => {
    expect(blockForWeek(5)).toBeUndefined()
    expect([6, 10, 11, 16, 17, 22, 23, 29, 30, 32, 33, 35].map((w) => blockForWeek(w)!.block)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ])
  })

  it('switches block 1 → 2 between weeks 10 and 11 (squat→RFESS, bridge→SL RDL, adds Nordics)', () => {
    expect(ids(variantOf(10, 'A'))).toContain('box-goblet-squat')
    expect(ids(variantOf(11, 'A'))).toContain('rfess')
    expect(ids(variantOf(10, 'B'))).toContain('single-leg-glute-bridge')
    expect(ids(variantOf(12, 'B'))).toEqual(expect.arrayContaining(['single-leg-rdl', 'nordic-curl', 'copenhagen-long']))
    expect(ids(variantOf(11, 'A'))).toEqual(expect.arrayContaining(['weighted-dead-bug', 'hollow-hold', 'push-up-feet-elevated']))
  })

  it('progresses Nordics 2×4 → 3×5 within block 2', () => {
    const nordic = (w: number) => variantOf(w, 'B').exercises!.find((e) => e.exerciseId === 'nordic-curl')!
    expect(nordic(12).prescription).toMatch(/^2 × 4/)
    expect(nordic(14).prescription).toMatch(/^3 × 5/)
  })

  it('adds the plyo primer at block 3 and power plyos at block 4', () => {
    expect(ids(variantOf(16, 'A'))).not.toContain('plyo-primer')
    expect(ids(variantOf(17, 'A'))[0]).toBe('plyo-primer')
    expect(ids(variantOf(23, 'A'))[0]).toBe('plyo-power')
    expect(ids(variantOf(23, 'B'))).toContain('weighted-pull-up')
  })

  it('drops Nordics and caps plyos at block 5', () => {
    // Week 30's Monday follows a ≥26 km long run (mobility only), so check week 32.
    expect(byWeek(30)[0].status).toBe('planned')
    expect(byWeek(30)[0].description).toMatch(/mobility only/)
    expect(ids(variantOf(32, 'B'))).not.toContain('nordic-curl')
    const plyo = variantOf(32, 'A').exercises!.find((e) => e.isPlyo)!
    expect(plyo.prescription).toMatch(/≤40 contacts/)
    expect(variantOf(32, 'A').exercises!.filter((e) => !e.isPlyo).every((e) => e.sets === 2)).toBe(true)
  })

  it('keeps weeks 1–5 on the original A/B sessions', () => {
    expect(byWeek(3).every((s) => s.strengthBlock === undefined)).toBe(true)
    expect(ids(byWeek(3)[0])).toContain('goblet-squat')
  })
})

describe('session shape', () => {
  it('keeps every block session at 5–6 exercises and ≤25 min', () => {
    for (const s of all.filter((x) => x.week >= 6 && !isMobilityOnly(x))) {
      expect(s.exercises!.length).toBeGreaterThanOrEqual(4)
      expect(s.exercises!.length).toBeLessThanOrEqual(6)
      expect(s.estimatedMinutes!).toBeLessThanOrEqual(25)
    }
    for (const s of all.filter((x) => x.week >= 6 && x.week <= 32 && !isMobilityOnly(x))) {
      expect(s.exercises!.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('alternates A (Monday) and B (Wednesday) in normal weeks', () => {
    const w = byWeek(8)
    expect(w.map((s) => s.variant)).toEqual(['A', 'B'])
    expect(new Date(`${w[0].date}T00:00:00Z`).getUTCDay()).toBe(1)
    expect(new Date(`${w[1].date}T00:00:00Z`).getUTCDay()).toBe(3)
  })

  it('takes one set off everything in cutback weeks', () => {
    const normal = variantOf(12, 'A').exercises!
    const cutback = variantOf(11, 'A').exercises!
    for (let i = 0; i < normal.length; i++) {
      expect(cutback[i].sets).toBe(Math.max(1, normal[i].sets - 1))
    }
    expect(byWeek(22)).toHaveLength(2)
  })

  it('never places session A within 48 h before a long run, MP/tempo session, or race', () => {
    const { sessions: runs } = generatePlan()
    for (const a of all.filter((s) => s.variant === 'A' && s.week >= 6 && !isMobilityOnly(s))) {
      const key = runs.filter((r) => ['long', 'tempo', 'marathon-pace', 'race'].includes(r.type))
      expect(key.some((r) => daysBetween(a.date, r.date) > 0 && daysBetween(a.date, r.date) <= 2)).toBe(false)
    }
  })

  it('never schedules strength the day before the long/race run', () => {
    for (const s of all) {
      const seed = WEEK_PLAN.find((w) => w.week === s.week)!
      const longOrRace = seed.sessions.find((x) => x.type === 'long' || x.type === 'race')
      if (!longOrRace) continue
      const day = new Date(`${s.date}T00:00:00Z`).getUTCDay()
      expect(day === 0 ? 6 : day - 1).not.toBe(longOrRace.dayOffset - 1)
    }
  })
})

describe('scheduling rules (synthetic weeks)', () => {
  const base: StrengthWeekContext = {
    week: 12,
    weekStart: '2026-11-09',
    isCutback: false,
    isGateRaceWeek: false,
    runs: [],
  }

  it('swaps A to Wednesday when a key session is within 48 h of Monday', () => {
    const plan = planStrengthWeek({ ...base, runs: [{ week: 12, date: '2026-11-11', type: 'tempo', plannedDistanceKm: 7 }] })
    // Monday→Wednesday tempo is 2 days: A moves to Wednesday? Wednesday itself is day 0 → allowed.
    expect(plan.find((p) => p.variant === 'A')!.dayOffset).toBe(2)
    expect(plan.find((p) => p.variant === 'B')!.dayOffset).toBe(0)
  })

  it('drops plyos when neither slot avoids a key session', () => {
    const plan = planStrengthWeek({
      ...base,
      week: 18,
      runs: [
        { week: 18, date: '2026-11-11', type: 'tempo', plannedDistanceKm: 7 },
        { week: 18, date: '2026-11-13', type: 'marathon-pace', plannedDistanceKm: 10 },
      ],
    })
    const a = plan.find((p) => p.variant === 'A')!
    expect(a.dayOffset).toBe(0)
    expect(a.exercises.some((e) => e.isPlyo)).toBe(false)
  })

  it('skips session A in a gate-race week when it lands within 48 h of the race', () => {
    const plan = planStrengthWeek({
      ...base,
      week: 23,
      isGateRaceWeek: true,
      runs: [
        { week: 23, date: '2026-11-11', type: 'race', plannedDistanceKm: 10 },
        { week: 23, date: '2026-11-13', type: 'easy', plannedDistanceKm: 6 },
      ],
    })
    // Monday and Wednesday both sit within 48 h of Wednesday's race → A dropped.
    expect(plan.some((p) => p.variant === 'A')).toBe(false)
    expect(plan.some((p) => p.variant === 'B')).toBe(true)
  })

  it('hasKeySessionWithin48h ignores easy runs and sessions before the date', () => {
    expect(hasKeySessionWithin48h('2026-11-09', [{ week: 1, date: '2026-11-10', type: 'easy', plannedDistanceKm: 5 }])).toBe(false)
    expect(hasKeySessionWithin48h('2026-11-09', [{ week: 1, date: '2026-11-08', type: 'long', plannedDistanceKm: 20 }])).toBe(false)
    expect(hasKeySessionWithin48h('2026-11-09', [{ week: 1, date: '2026-11-11', type: 'long', plannedDistanceKm: 20 }])).toBe(true)
  })
})

describe('taper (block 6)', () => {
  const raceDate = generatePlan().sessions.find((s) => s.type === 'race' && s.plannedDistanceKm > 40)!.date

  it('week 33: two sessions at ~60% volume, last plyos', () => {
    const w = byWeek(33)
    expect(w).toHaveLength(2)
    expect(w[0].exercises!.some((e) => e.isPlyo)).toBe(true)
  })

  it('week 34: light Monday (last loaded, ~13 days out) + midweek activation', () => {
    const w = byWeek(34)
    expect(w).toHaveLength(2)
    expect(daysBetween(w[0].date, raceDate)).toBe(13)
    expect(w[0].exercises!.some((e) => e.isPlyo)).toBe(false)
    expect(w[1].estimatedMinutes).toBe(10)
    expect(w[1].exercises!.every((e) => e.slot === 'activation')).toBe(true)
  })

  it('week 35: one early activation, nothing within 4 days of the race', () => {
    const w = byWeek(35)
    expect(w).toHaveLength(1)
    expect(w[0].estimatedMinutes).toBeGreaterThanOrEqual(10)
    expect(w[0].estimatedMinutes).toBeLessThanOrEqual(15)
    expect(daysBetween(w[0].date, raceDate)).toBeGreaterThan(4)
  })
})

describe('effectiveStrengthExercises (plyo guard)', () => {
  const session = variantOf(17, 'A')

  it('keeps plyos with no recent injury variant', () => {
    expect(effectiveStrengthExercises(session, all).some((e) => e.isPlyo)).toBe(true)
  })

  it('drops plyos when a knee/toe variant was used in the prior 2 weeks', () => {
    const earlier: Session = { ...variantOf(16, 'B'), id: 'x', injuryVariant: 'sore-toe' }
    const result = effectiveStrengthExercises(session, [...all, earlier])
    expect(result.some((e) => e.isPlyo)).toBe(false)
    expect(result.length).toBe(session.exercises!.length - 1)
  })
})

describe('catalog coverage', () => {
  it('every generated exercise has a catalog entry and an illustration', async () => {
    const { getCatalogEntry } = await import('./strengthCatalog')
    const { BLOCK_ILLUSTRATIONS } = await import('../components/exerciseIllustrationsBlocks')
    const legacy = ['goblet-squat', 'single-leg-rdl', 'single-leg-calf-raise', 'side-plank', 'hip-flexor-stretch', 'couch-stretch', 'ankle-rocks', 'reverse-lunge', 'single-leg-glute-bridge', 'pull-ups', 'dead-bug', 'front-plank', 'hamstring-stretch', 'thoracic-rotations', 'calf-stretch']
    for (const s of all) {
      for (const e of s.exercises ?? []) {
        expect(getCatalogEntry(e.exerciseId), e.exerciseId).toBeDefined()
        expect(legacy.includes(e.exerciseId) || e.exerciseId in BLOCK_ILLUSTRATIONS, e.exerciseId).toBe(true)
      }
    }
  })
})
