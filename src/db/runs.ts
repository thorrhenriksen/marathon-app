// Thin Dexie I/O wrapper for run mutations that also need to keep a linked
// session in sync.

import { db } from './db'
import { resetSessionOutcome } from '../lib/adjustmentEngine'
import type { Session } from '../types'

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

/** Resets a session's outcome back to 'planned' (see resetSessionOutcome),
 *  unlinking any logged run without deleting it. */
export async function revertSessionToPlanned(session: Session): Promise<void> {
  await db.transaction('rw', db.runs, db.sessions, async () => {
    if (session.linkedRunId) {
      const run = await db.runs.get(session.linkedRunId)
      if (run) {
        const { linkedSessionId: _linkedSessionId, ...rest } = run
        await db.runs.put(rest)
      }
    }
    await db.sessions.put(resetSessionOutcome(session))
  })
}
