// Moves the legacy single goal time into the goal engine's A goal. Additive
// only: targetTimeSeconds is left in place so older backups/readers keep
// working, and the B goal starts in "auto" mode (derived live from current
// fitness), which seeds it from current fitness without storing a stale copy.

import { db } from './db'

export async function runGoalEngineMigration(): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const goal = await db.goals.get('goal')
    if (!goal || goal.aGoalSeconds !== undefined) return
    await db.goals.update('goal', { aGoalSeconds: goal.targetTimeSeconds })
  })
}
