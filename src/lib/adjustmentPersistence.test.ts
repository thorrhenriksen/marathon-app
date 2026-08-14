import { describe, it, expect } from 'vitest'
import { generatePlan } from '../db/seed'
import { computeAdjustment } from './adjustmentEngine'
import { buildTimeOffAdjustmentRecord, previewReversal } from './adjustmentPersistence'
import type { Session, Settings, TimeOff } from '../types'

const settings: Settings = {
  id: 'settings',
  preferredDays: [2, 4, 6, 0], // Tue, Thu, Sat, Sun
  units: 'km',
  hasRequestedPersistence: false,
  theme: 'system',
}

function markCompleted(sessions: Session[], upToWeek: number): Session[] {
  return sessions.map((s) => (s.week <= upToWeek ? { ...s, status: 'completed' as const } : s))
}

/** Mimics what src/db/timeOffAdjustments.ts's applyTimeOff does, but against a
 *  plain in-memory array instead of Dexie tables. */
function applyInMemory(sessions: Session[], preview: ReturnType<typeof computeAdjustment>) {
  const previousSessions = preview.updatedSessions.map(
    (updated) => sessions.find((s) => s.id === updated.id)!,
  )

  let result = sessions.map((s) => {
    const updated = preview.updatedSessions.find((u) => u.id === s.id)
    return updated ?? s
  })
  result = [...result, ...preview.insertedSessions]

  return { result, previousSessions }
}

/** Mimics reverseTimeOff against a plain in-memory array. */
function reverseInMemory(sessions: Session[], previousSessions: Session[], insertedSessionIds: string[]) {
  const withoutInserted = sessions.filter((s) => !insertedSessionIds.includes(s.id))
  return withoutInserted.map((s) => previousSessions.find((p) => p.id === s.id) ?? s)
}

describe('adjustmentPersistence', () => {
  describe('buildTimeOffAdjustmentRecord', () => {
    it('computes affectedWeeks from both previousSessions and insertedSessions', () => {
      const { sessions, weeks } = generatePlan()
      const completed = markCompleted(sessions, 20)
      const timeOff: TimeOff = { id: 't1', startDate: '2027-01-08', endDate: '2027-01-13', label: 'illness' }
      const preview = computeAdjustment(timeOff, completed, weeks, settings)

      const previousSessions = preview.updatedSessions.map(
        (updated) => completed.find((s) => s.id === updated.id)!,
      )
      const record = buildTimeOffAdjustmentRecord(timeOff, preview, previousSessions)

      const expectedWeeks = new Set<number>()
      for (const s of previousSessions) expectedWeeks.add(s.week)
      for (const s of preview.insertedSessions) expectedWeeks.add(s.week)

      expect(record.affectedWeeks).toEqual(Array.from(expectedWeeks).sort((a, b) => a - b))
      expect(record.timeOffId).toBe(timeOff.id)
      expect(record.undone).toBe(false)
      expect(record.summary).toEqual(preview.summary)
      expect(record.insertedSessionIds).toEqual(preview.insertedSessions.map((s) => s.id))
    })

    it('produces an empty affectedWeeks set when nothing changed', () => {
      const { sessions, weeks } = generatePlan()
      const timeOff: TimeOff = { id: 't2', startDate: '2099-01-01', endDate: '2099-01-01', label: 'illness' }
      const preview = computeAdjustment(timeOff, sessions, weeks, settings)
      const record = buildTimeOffAdjustmentRecord(timeOff, preview, [])

      expect(record.affectedWeeks).toEqual([])
    })
  })

  describe('previewReversal', () => {
    it('describes both restored and inserted sessions when both are present', () => {
      const { sessions, weeks } = generatePlan()
      const completed = markCompleted(sessions, 20)
      const timeOff: TimeOff = { id: 't3', startDate: '2027-01-08', endDate: '2027-01-13', label: 'illness' }
      const preview = computeAdjustment(timeOff, completed, weeks, settings)
      const previousSessions = preview.updatedSessions.map(
        (updated) => completed.find((s) => s.id === updated.id)!,
      )
      const record = buildTimeOffAdjustmentRecord(timeOff, preview, previousSessions)

      const lines = previewReversal(record)
      expect(lines.length).toBe(4)
      expect(lines[0]).toMatch(/^Restore \d+ session/)
      expect(lines[1]).toMatch(/^Remove \d+ inserted re-entry session/)
      expect(lines[2]).toMatch(/^Affects/)
      expect(lines.at(-1)).toBe('Delete this time-off entry')
    })

    it('omits the restore/remove lines when their counts are zero', () => {
      const record = buildTimeOffAdjustmentRecord(
        { id: 't4', startDate: '2026-08-18', endDate: '2026-08-18', label: 'illness' },
        { timeOffId: 't4', updatedSessions: [], insertedSessions: [], summary: [] },
        [],
      )
      const lines = previewReversal(record)
      expect(lines).toEqual(['Delete this time-off entry'])
    })
  })

  describe('apply then reverse round trip', () => {
    it('restores the original sessions array after applying and reversing an adjustment', () => {
      const { sessions, weeks } = generatePlan()
      const original = sessions.map((s) => ({ ...s }))
      const timeOff: TimeOff = { id: 't5', startDate: '2026-10-13', endDate: '2026-10-13', label: 'illness' }
      const preview = computeAdjustment(timeOff, sessions, weeks, settings)

      const { result: afterApply, previousSessions } = applyInMemory(sessions, preview)
      const record = buildTimeOffAdjustmentRecord(timeOff, preview, previousSessions)

      const afterReverse = reverseInMemory(afterApply, record.previousSessions, record.insertedSessionIds)

      const sortedOriginal = [...original].sort((a, b) => a.id.localeCompare(b.id))
      const sortedReversed = [...afterReverse].sort((a, b) => a.id.localeCompare(b.id))
      expect(sortedReversed).toEqual(sortedOriginal)
    })
  })
})
