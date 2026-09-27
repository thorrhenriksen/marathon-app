import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { celebrate } from '../lib/celebrate'
import { formatDuration, formatPace } from '../lib/paceZones'
import { useGoalEngine } from '../lib/useGoalEngine'

/** One-time Today card when every gate passes and A-goal pace unlocks. */
export default function GoalUnlockCard() {
  const engine = useGoalEngine()
  const goal = useLiveQuery(() => db.goals.get('goal'), [])
  if (!engine || !goal || !engine.gateStatus.unlocked) return null
  if (goal.aGoalUnlockCelebratedForSeconds === engine.goals.aSeconds) return null

  async function handleTap() {
    celebrate()
    await db.goals.update('goal', { aGoalUnlockCelebratedForSeconds: engine!.goals.aSeconds })
  }

  return (
    <button
      onClick={handleTap}
      className="w-full rounded-2xl border border-accent/50 bg-accent/10 p-4 text-left active:bg-accent/20"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-accent">Gates passed — tap to celebrate</p>
      <p className="mt-1 text-sm font-semibold text-ink">
        You've earned {formatDuration(engine.goals.aSeconds)} pace
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Marathon-pace sessions and race day now target {formatPace(engine.zones.marathonPaceSecPerKm)}.
      </p>
    </button>
  )
}
