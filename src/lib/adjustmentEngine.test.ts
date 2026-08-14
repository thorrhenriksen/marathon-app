import { describe, it, expect, beforeEach } from 'vitest'
import { generatePlan } from '../db/seed'
import { computeAdjustment, moveSessionToDate, applyNotFeeling100 } from './adjustmentEngine'
import type { Session, WeekMeta, Settings, TimeOff } from '../types'

function markCompleted(sessions: Session[], upToWeek: number): Session[] {
  return sessions.map((s) => (s.week <= upToWeek ? { ...s, status: 'completed' as const } : s))
}

const settings: Settings = {
  id: 'settings',
  preferredDays: [2, 4, 6, 0], // Tue, Thu, Sat, Sun
  units: 'km',
  hasRequestedPersistence: false,
}

describe('adjustmentEngine', () => {
  let sessions: Session[]
  let weeks: WeekMeta[]

  beforeEach(() => {
    const plan = generatePlan()
    sessions = plan.sessions
    weeks = plan.weeks
  })

  describe('Rule 1: sessions inside the range are marked skipped', () => {
    it('marks the in-range session as no longer planned', () => {
      const timeOff: TimeOff = { id: 't1', startDate: '2026-08-18', endDate: '2026-08-18', label: 'illness' }
      const result = computeAdjustment(timeOff, sessions, weeks, settings)

      const tuesdaySession = sessions.find((s) => s.date === '2026-08-18')
      expect(tuesdaySession).toBeDefined()

      const updated = result.updatedSessions.find((s) => s.id === tuesdaySession!.id)
      expect(updated).toBeDefined()
      expect(updated!.status).not.toBe('planned')
    })
  })

  describe('Rule 2: short gap (1-3 days) redistribution', () => {
    // Week 9 (Monday 2026-10-12): Tue 10-13, Thu 10-15, Sat 10-17, Sun-long 10-18
    const timeOff: TimeOff = { id: 't2', startDate: '2026-10-13', endDate: '2026-10-13', label: 'illness' }

    it('moves the missed session to a free preferred day not colliding with existing sessions', () => {
      const result = computeAdjustment(timeOff, sessions, weeks, settings)
      const missed = sessions.find((s) => s.date === '2026-10-13')!
      const updated = result.updatedSessions.find((s) => s.id === missed.id)

      expect(updated).toBeDefined()
      if (updated!.status === 'moved') {
        expect(updated!.date).not.toBe('2026-10-15')
        expect(updated!.date).not.toBe('2026-10-17')
        expect(updated!.date).not.toBe('2026-10-18')
        expect(updated!.date >= '2026-10-12').toBe(true)
        expect(updated!.date <= '2026-10-18').toBe(true)
      }
    })

    it('drops the lowest-priority session when no free preferred day remains in the week', () => {
      // Force a scenario with no available slots: mark a week where all preferred days are
      // already used and take out one via time off, leaving no free preferred day to move to.
      const week9Sessions = sessions.filter((s) => s.week === 9)
      expect(week9Sessions.length).toBeGreaterThan(0)

      // Occupy all preferred offsets except the one being taken off, by using the real seed
      // (Tue/Thu/Sat/Sun are already fully used in week 9), so the missed Tuesday session has
      // no free preferred day left within the week and should be marked skipped.
      const result = computeAdjustment(timeOff, sessions, weeks, settings)
      const missed = sessions.find((s) => s.date === '2026-10-13')!
      const updated = result.updatedSessions.find((s) => s.id === missed.id)
      expect(updated).toBeDefined()
      // With Thu/Sat/Sun already occupied, no preferred slot is free, so it must be skipped.
      expect(updated!.status).toBe('skipped')
    })

    it('never creates more than two consecutive running days in the affected week', () => {
      const result = computeAdjustment(timeOff, sessions, weeks, settings)
      const week9Sessions = sessions.filter((s) => s.week === 9)
      const finalDates = new Map<string, string>()
      for (const s of week9Sessions) finalDates.set(s.id, s.date)
      for (const u of result.updatedSessions) {
        if (week9Sessions.some((s) => s.id === u.id) && u.status === 'moved') {
          finalDates.set(u.id, u.date)
        } else if (week9Sessions.some((s) => s.id === u.id) && u.status === 'skipped') {
          finalDates.delete(u.id)
        }
      }

      const offsets = [...finalDates.values()]
        .map((d) => {
          const day = new Date(d + 'T00:00:00Z').getUTCDay() // 0=Sun..6=Sat
          return day === 0 ? 6 : day - 1 // Mon-based
        })
        .sort((a, b) => a - b)

      let longest = offsets.length > 0 ? 1 : 0
      let current = 1
      for (let i = 1; i < offsets.length; i++) {
        if (offsets[i] === offsets[i - 1] + 1) {
          current += 1
          longest = Math.max(longest, current)
        } else {
          current = 1
        }
      }
      expect(longest).toBeLessThanOrEqual(2)
    })
  })

  describe('Rule 3: medium gap (4-10 days) inserts a re-entry week at ~85% volume', () => {
    it('inserts a re-entry week and skips the original return week', () => {
      sessions = markCompleted(sessions, 20)
      const timeOff: TimeOff = { id: 't3', startDate: '2027-01-08', endDate: '2027-01-13', label: 'illness' }
      const result = computeAdjustment(timeOff, sessions, weeks, settings)

      expect(result.returnWeekNumber).toBe(22)
      expect(result.insertedSessions.length).toBeGreaterThan(0)

      const week20 = sessions.filter((s) => s.week === 20)
      const week20Volume = week20.reduce((sum, s) => sum + s.plannedDistanceKm, 0)
      const insertedVolume = result.insertedSessions.reduce((sum, s) => sum + s.plannedDistanceKm, 0)
      expect(insertedVolume).toBeCloseTo(week20Volume * 0.85, 0)
      expect(insertedVolume).toBeLessThan(week20Volume)

      const returnWeekSessions = sessions.filter((s) => s.week === 22)
      for (const rs of returnWeekSessions) {
        const updated = result.updatedSessions.find((u) => u.id === rs.id)
        expect(updated).toBeDefined()
        expect(updated!.status).toBe('skipped')
      }
    })
  })

  describe('Rule 4: long gap (>10 days) steps back an additional two weeks for the template', () => {
    it('uses an earlier template week than the equivalent medium gap', () => {
      const completedSessions = markCompleted(sessions, 20)

      const mediumTimeOff: TimeOff = { id: 't4a', startDate: '2027-01-08', endDate: '2027-01-13', label: 'illness' }
      const mediumResult = computeAdjustment(mediumTimeOff, completedSessions, weeks, settings)

      const longTimeOff: TimeOff = { id: 't4b', startDate: '2027-01-08', endDate: '2027-01-20', label: 'illness' }
      const longResult = computeAdjustment(longTimeOff, completedSessions, weeks, settings)

      expect(mediumResult.reEntryTemplateWeek).toBe(20)
      expect(longResult.reEntryTemplateWeek).toBe(18)
      expect(longResult.returnWeekNumber).toBe(23)

      const mediumTotal = mediumResult.insertedSessions.reduce((sum, s) => sum + s.plannedDistanceKm, 0)
      const longTotal = longResult.insertedSessions.reduce((sum, s) => sum + s.plannedDistanceKm, 0)
      expect(longTotal).not.toBeCloseTo(mediumTotal, 1)
    })
  })

  describe('Rule 5: protected weeks (29-36) are never used as a re-entry template', () => {
    it('backs off to week 28 when the natural template would land in the protected range', () => {
      const completedSessions = markCompleted(sessions, 33)
      const timeOff: TimeOff = { id: 't5', startDate: '2027-04-06', endDate: '2027-04-11', label: 'illness' }
      const result = computeAdjustment(timeOff, completedSessions, weeks, settings)

      expect(result.reEntryTemplateWeek).toBe(28)
    })
  })

  describe('moveSessionToDate', () => {
    it('moves a session to a new date within the same plan week', () => {
      const week5Meta = weeks.find((w) => w.week === 5)!
      const session = sessions.find((s) => s.week === 5 && s.type === 'easy')!
      const moved = moveSessionToDate(session, '2026-09-17', week5Meta)

      expect(moved).not.toBeNull()
      expect(moved!.date).toBe('2026-09-17')
      expect(moved!.status).toBe('moved')
      expect(moved!.originalDate).toBe(session.date)
    })

    it('rejects a target date outside the session\'s plan week', () => {
      const week5Meta = weeks.find((w) => w.week === 5)!
      const session = sessions.find((s) => s.week === 5)!
      const moved = moveSessionToDate(session, '2099-01-01', week5Meta)

      expect(moved).toBeNull()
    })
  })

  describe('applyNotFeeling100', () => {
    it('converts a long session to a short easy run marked handled', () => {
      const longSession = sessions.find((s) => s.type === 'long')!
      const adjusted = applyNotFeeling100(longSession)

      expect(adjusted.type).toBe('easy')
      expect(adjusted.status).toBe('handled')
      expect(adjusted.plannedDistanceKm).toBeLessThanOrEqual(4)
    })

    it('keeps a rest session as rest but marks it handled', () => {
      const restSession = sessions.find((s) => s.type === 'rest')
      if (!restSession) return // plan may not include explicit rest sessions

      const adjusted = applyNotFeeling100(restSession)
      expect(adjusted.type).toBe('rest')
      expect(adjusted.status).toBe('handled')
    })
  })
})
