import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { computeAchievements, type Achievement } from './achievements'
import { todayISO } from './dates'

/** Live, fully-derived achievement list (undefined while loading). */
export function useAchievements(): Achievement[] | undefined {
  const weeks = useLiveQuery(() => db.weeks.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const runs = useLiveQuery(() => db.runs.toArray(), [])
  const timeOffEntries = useLiveQuery(() => db.timeOff.toArray(), [])
  const today = todayISO()
  return useMemo(
    () =>
      weeks && sessions && runs && timeOffEntries
        ? computeAchievements({ sessions, runs, weeks, timeOffEntries, today })
        : undefined,
    [weeks, sessions, runs, timeOffEntries, today],
  )
}
