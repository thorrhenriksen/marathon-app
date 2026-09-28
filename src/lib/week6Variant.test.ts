import { describe, it, expect } from 'vitest'
import { week6VariantUpdates } from './week6Variant'
import { generateStrengthSessions } from './strengthSchedule'
import { generatePlan } from '../db/seed'
import type { Session } from '../types'

const { sessions: runs, weeks } = generatePlan()
const strength = generateStrengthSessions()
const all = [...runs, ...strength]

describe('week-6 sore knees + toe conversion', () => {
  it('converts only week 6 Monday and Wednesday strength, keeping them planned', () => {
    const updates = week6VariantUpdates(all, weeks, '2026-09-28')
    expect(updates.map((s) => s.date).sort()).toEqual(['2026-09-28', '2026-09-30'])
    expect(updates.every((s) => s.injuryVariant === 'sore-knees-toe' && s.status === 'planned')).toBe(true)
    expect(updates.every((s) => s.exercises!.every((e) => !e.isPlyo))).toBe(true)
    expect(updates.find((s) => s.variant === 'A')!.exercises!.map((e) => e.exerciseId)).toContain('wall-sit')
    // Same ids — an in-place update, not new sessions.
    const originalIds = strength.filter((s) => s.week === 6).map((s) => s.id).sort()
    expect(updates.map((s) => s.id).sort()).toEqual(originalIds)
  })

  it('leaves sessions with an outcome alone', () => {
    const done: Session[] = all.map((s) => (s.week === 6 && s.type === 'strength' && s.variant === 'A' ? { ...s, status: 'completed' } : s))
    expect(week6VariantUpdates(done, weeks, '2026-09-28').map((s) => s.variant)).toEqual(['B'])
  })

  it('does nothing once the week is over', () => {
    expect(week6VariantUpdates(all, weeks, '2026-10-05')).toEqual([])
  })
})
