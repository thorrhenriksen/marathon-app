import { db } from './db'
import { todayISO } from '../lib/dates'
import { week6VariantUpdates } from '../lib/week6Variant'

/** Runs the one-off week-6 variant conversion once (see lib/week6Variant.ts). */
export async function runWeek6VariantMigration(): Promise<void> {
  await db.transaction('rw', db.settings, db.sessions, db.weeks, async () => {
    const settings = await db.settings.get('settings')
    if (!settings || settings.week6InjuryVariantAppliedAt) return
    const updates = week6VariantUpdates(await db.sessions.toArray(), await db.weeks.toArray(), todayISO())
    if (updates.length > 0) await db.sessions.bulkPut(updates)
    await db.settings.update('settings', { week6InjuryVariantAppliedAt: new Date().toISOString() })
  })
}
