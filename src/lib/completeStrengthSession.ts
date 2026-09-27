// Shared strength-session completion logic, used by both the manual
// checklist flow (SessionDetailSheet) and guided mode (GuidedStrengthSession).

import { db } from '../db/db'
import type { Session } from '../types'

export async function completeStrengthSession(session: Session, completionNote?: string): Promise<void> {
  const completedExercises = (session.exercises ?? []).map((e) => ({ ...e, completed: true }))
  await db.sessions.put({
    ...session,
    exercises: completedExercises,
    status: 'completed',
    completionNote: completionNote?.trim() || undefined,
    completedAt: new Date().toISOString(),
    guidedProgress: undefined,
  })
}
