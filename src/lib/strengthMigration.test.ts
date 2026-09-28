import { describe, it, expect } from 'vitest'
import { reconcileStrengthPlan } from './strengthMigration'
import { generateStrengthSessions } from './strengthSchedule'
import type { Session } from '../types'

const TODAY = '2026-09-28' // Monday of week 6

function legacy(id: string, week: number, date: string, status: Session['status'], extra: Partial<Session> = {}): Session {
  return { id, week, date, type: 'strength', plannedDistanceKm: 0, description: 'Strength — Session A', status, variant: 'A', exercises: [], ...extra }
}

describe('reconcileStrengthPlan', () => {
  const generated = generateStrengthSessions()

  it('replaces untouched future planned sessions from week 6 with block sessions', () => {
    const existing = [legacy('w6mon', 6, '2026-09-28', 'planned'), legacy('w6wed', 6, '2026-09-30', 'planned')]
    const { deleteIds, add } = reconcileStrengthPlan(existing, generated, TODAY)
    expect(deleteIds.sort()).toEqual(['w6mon', 'w6wed'])
    const week6 = add.filter((s) => s.week === 6)
    expect(week6.map((s) => s.date)).toEqual(['2026-09-28', '2026-09-30'])
    expect(week6.every((s) => s.strengthBlock === 1)).toBe(true)
  })

  it('never touches completed, missed, handled, moved, skipped or past sessions', () => {
    const existing = [
      legacy('done', 6, '2026-09-28', 'completed'),
      legacy('moved', 6, '2026-10-01', 'moved', { originalDate: '2026-09-30' }),
      legacy('past', 5, '2026-09-21', 'planned'),
      legacy('pastUnlogged', 6, '2026-09-27', 'planned'),
      legacy('skipped', 7, '2026-10-05', 'skipped'),
      legacy('missed', 7, '2026-10-07', 'missed'),
    ]
    const { deleteIds, add } = reconcileStrengthPlan(existing, generated, TODAY)
    expect(deleteIds).toEqual([])
    // No block session is generated on a slot a kept session already occupies.
    for (const k of existing) {
      expect(add.some((a) => a.week === k.week && a.date === (k.originalDate ?? k.date))).toBe(false)
    }
    expect(add.every((a) => a.date >= TODAY && a.week >= 6)).toBe(true)
  })

  it('keeps sessions protected by an active time-off adjustment', () => {
    const existing = [legacy('reentry', 9, '2026-10-19', 'planned')]
    const { deleteIds, add } = reconcileStrengthPlan(existing, generated, TODAY, new Set(['reentry']))
    expect(deleteIds).toEqual([])
    expect(add.some((a) => a.week === 9 && a.date === '2026-10-19')).toBe(false)
  })

  it('re-running reproduces the same plan shape (the version guard prevents re-runs in practice)', () => {
    const first = reconcileStrengthPlan([], generated, TODAY)
    const second = reconcileStrengthPlan(first.add, generated, TODAY)
    const shape = (list: Session[]) =>
      list.map((s) => `${s.date}|${s.variant}|${(s.exercises ?? []).map((e) => e.exerciseId).join(',')}`).sort()
    const keptFromFirst = first.add.filter((s) => !second.deleteIds.includes(s.id))
    expect(shape([...keptFromFirst, ...second.add])).toEqual(shape(first.add))
  })
})
