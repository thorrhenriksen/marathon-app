import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { todayISO } from './dates'
import { computeGoalEngineState, type GoalEngineState } from './goalEngine'

/** Live goal-engine state (current fitness, goals, gates, training zones).
 *  Undefined while loading. */
export function useGoalEngine(): GoalEngineState | undefined {
  const goal = useLiveQuery(() => db.goals.get('goal'), [])
  const runs = useLiveQuery(() => db.runs.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const weeks = useLiveQuery(() => db.weeks.toArray(), [])
  const today = todayISO()
  return useMemo(
    () => (runs && sessions && weeks ? computeGoalEngineState({ goal, runs, sessions, weeks, today }) : undefined),
    [goal, runs, sessions, weeks, today],
  )
}
