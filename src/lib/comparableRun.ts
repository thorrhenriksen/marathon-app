// Finds the most relevant past run to compare against a planned session, so
// the session detail sheet can show "last time you did a similar run...".

import type { Run, Session } from '../types'

const DISTANCE_TOLERANCE = 0.3

/** Finds the most recent logged run of the same type and comparable distance
 *  (within 30%) to the given session, excluding the run already linked to it.
 *  Returns undefined if there's no match. */
export function findLastComparableRun(session: Session, runs: Run[]): Run | undefined {
  const minDistance = session.plannedDistanceKm * (1 - DISTANCE_TOLERANCE)
  const maxDistance = session.plannedDistanceKm * (1 + DISTANCE_TOLERANCE)

  const candidates = runs.filter(
    (run) =>
      run.type === session.type &&
      run.id !== session.linkedRunId &&
      run.distanceKm >= minDistance &&
      run.distanceKm <= maxDistance,
  )

  if (candidates.length === 0) return undefined

  return candidates.reduce((mostRecent, candidate) =>
    candidate.date > mostRecent.date ? candidate : mostRecent,
  )
}
