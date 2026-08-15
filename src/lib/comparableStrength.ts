// Finds the most recent completed strength session of the same variant, so
// the session detail sheet can show "last time you did Session A...".

import type { Session } from '../types'

/** Finds the most recently completed strength session with the same variant
 *  as the given session, excluding the session itself. Returns undefined if
 *  there's no match. */
export function findLastComparableStrengthSession(
  session: Session,
  allSessions: Session[],
): Session | undefined {
  const candidates = allSessions.filter(
    (s) =>
      s.type === 'strength' &&
      s.variant === session.variant &&
      s.status === 'completed' &&
      s.id !== session.id,
  )

  if (candidates.length === 0) return undefined

  return candidates.reduce((mostRecent, candidate) => (candidate.date > mostRecent.date ? candidate : mostRecent))
}
