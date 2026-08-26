import { describe, it, expect } from 'vitest'
import { generatePlan } from '../db/seed'
import { WEEK_PLAN } from '../db/weekPlan'
import { generateStrengthSessions } from './strengthSchedule'
import { computeAdjustment } from './adjustmentEngine'
import type { Settings, TimeOff } from '../types'

const settings: Settings = {
  id: 'settings',
  preferredDays: [2, 4, 6, 0], // Tue, Thu, Sat, Sun
  units: 'km',
  hasRequestedPersistence: false,
  theme: 'system',
}

describe('generateStrengthSessions', () => {
  const strengthSessions = generateStrengthSessions()

  describe('cutback-week reduction', () => {
    it('produces exactly one strength session in cutback weeks (22, 26, 31)', () => {
      for (const week of [22, 26, 31]) {
        const weekSessions = strengthSessions.filter((s) => s.week === week)
        expect(weekSessions.length).toBe(1)
      }
    })

    it('produces two strength sessions in a normal marathon-block week', () => {
      const weekSessions = strengthSessions.filter((s) => s.week === 20)
      expect(weekSessions.length).toBe(2)
    })
  })

  describe('post-26km downgrade', () => {
    it('downgrades the Monday session after a >=26km long run', () => {
      // Week 27's Sunday long run is 26km, so week 28's Monday session should
      // be downgraded to mobility-only.
      const week28Sessions = strengthSessions.filter((s) => s.week === 28).sort((a, b) => (a.date < b.date ? -1 : 1))
      const monday = week28Sessions[0]
      expect(monday.status).toBe('downgraded-to-mobility')
      expect(monday.exercises?.length).toBeGreaterThan(0)
      expect(monday.exercises?.every((e) => e.holdSeconds !== undefined)).toBe(true)
    })

    it('does not downgrade a control week without a preceding >=26km run', () => {
      // Week 28's Sunday session is a 21.1km half marathon (race), so week 29's
      // Monday session should not be downgraded.
      const week29Sessions = strengthSessions.filter((s) => s.week === 29).sort((a, b) => (a.date < b.date ? -1 : 1))
      const monday = week29Sessions[0]
      expect(monday.status).toBe('planned')
    })
  })

  describe('never-before-long-run placement', () => {
    it('never schedules a strength session the day before that week\'s long/race session', () => {
      // Re-derive each strength session's day offset from its date's weekday.
      const weekStartByWeek = new Map(WEEK_PLAN.map((w) => [w.week, w]))
      for (const strengthSession of strengthSessions) {
        const weekSeed = weekStartByWeek.get(strengthSession.week)!
        const longOrRace = weekSeed.sessions.find((s) => s.type === 'long' || s.type === 'race')
        if (!longOrRace) continue
        const dayIndex = new Date(strengthSession.date + 'T00:00:00Z').getUTCDay()
        const mondayOffset = dayIndex === 0 ? 6 : dayIndex - 1
        expect(mondayOffset).not.toBe(longOrRace.dayOffset - 1)
      }
    })
  })

  describe('holiday interaction', () => {
    it('marks strength sessions as skipped (never moved) during a short time-off gap', () => {
      const { sessions: runSessions, weeks } = generatePlan()
      const allSessions = [...runSessions, ...strengthSessions]

      const week8Strength = strengthSessions.filter((s) => s.week === 8).sort((a, b) => (a.date < b.date ? -1 : 1))
      expect(week8Strength.length).toBeGreaterThan(0)
      const targetSession = week8Strength[0]

      const timeOff: TimeOff = {
        id: 'strength-timeoff',
        startDate: targetSession.date,
        endDate: targetSession.date,
        label: 'illness',
      }

      const result = computeAdjustment(timeOff, allSessions, weeks, settings)
      const updated = result.updatedSessions.find((s) => s.id === targetSession.id)

      expect(updated).toBeDefined()
      expect(updated!.status).toBe('skipped')
    })
  })
})
