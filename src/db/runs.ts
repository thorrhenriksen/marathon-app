// Thin Dexie I/O wrapper for run mutations that also need to keep a linked
// session in sync.

import { db } from './db'

/** Deletes a run. If a scheduled session was marked completed against it,
 *  reverts that session back to 'planned' and clears its run link. */
export async function deleteRun(runId: string): Promise<void> {
  await db.transaction('rw', db.runs, db.sessions, async () => {
    const linkedSession = await db.sessions.filter((s) => s.linkedRunId === runId).first()
    if (linkedSession) {
      const { linkedRunId: _linkedRunId, ...rest } = linkedSession
      await db.sessions.put({ ...rest, status: 'planned' })
    }
    await db.runs.delete(runId)
  })
}
