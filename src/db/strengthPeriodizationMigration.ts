// One-time move of stored strength sessions onto the six-block periodization
// (see lib/strengthMigration.ts for exactly what is and isn't touched).
// Guarded by Settings.strengthPlanVersion and run in one transaction.

import { db } from './db'
import { generateStrengthSessions } from '../lib/strengthSchedule'
import { reconcileStrengthPlan } from '../lib/strengthMigration'
import { todayISO } from '../lib/dates'

export const STRENGTH_PLAN_VERSION = 2

export async function runStrengthPeriodizationMigration(): Promise<void> {
  await db.transaction('rw', db.settings, db.sessions, db.timeOffAdjustments, async () => {
    const settings = await db.settings.get('settings')
    if (!settings || (settings.strengthPlanVersion ?? 1) >= STRENGTH_PLAN_VERSION) return

    // 'type' isn't indexed, so filter in memory (≤ a few hundred rows).
    const existing = (await db.sessions.toArray()).filter((s) => s.type === 'strength')
    const activeAdjustments = (await db.timeOffAdjustments.toArray()).filter((a) => !a.undone)
    const protectedIds = new Set(
      activeAdjustments.flatMap((a) => [...a.insertedSessionIds, ...a.previousSessions.map((s) => s.id)]),
    )
    const { deleteIds, add } = reconcileStrengthPlan(existing, generateStrengthSessions(), todayISO(), protectedIds)
    await db.sessions.bulkDelete(deleteIds)
    await db.sessions.bulkAdd(add)
    await db.settings.update('settings', { strengthPlanVersion: STRENGTH_PLAN_VERSION })
  })
}
