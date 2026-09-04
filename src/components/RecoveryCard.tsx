import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addDays, formatDisplayDate, todayISO } from '../lib/dates'
import {
  computeActivityLoad,
  computeRecoveryState,
  computeRefuelPrompt,
  runToActivity,
  strengthSessionToActivity,
  type ActivityLoadLevel,
  type ActivitySource,
  type RecoveryBand,
} from '../lib/recovery'
import BottomSheet from './BottomSheet'

const BAND_STYLE: Record<RecoveryBand, { badge: string; label: string }> = {
  recovered: { badge: 'bg-accent/20 text-accent', label: 'Recovered' },
  recovering: { badge: 'bg-warning/20 text-warning', label: 'Recovering' },
  'recently-worked': { badge: 'bg-info/20 text-info', label: 'Recently worked' },
}

const LOAD_BAR_STYLE: Record<ActivityLoadLevel, string> = {
  light: 'bg-accent/50',
  moderate: 'bg-warning/60',
  hard: 'bg-danger/60',
}

const REFUEL_EXAMPLES = ['Banana + Greek yogurt', 'Chocolate milk', 'Toast with eggs']

const LOOKBACK_DAYS = 6

function buildActivities(runs: ActivitySource[], sessions: ActivitySource[]): ActivitySource[] {
  return [...runs, ...sessions]
}

export default function RecoveryCard() {
  const today = todayISO()
  const [showDetail, setShowDetail] = useState(false)

  const runs = useLiveQuery(() => db.runs.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const todaysSession = useLiveQuery(() => db.sessions.where('date').equals(today).first(), [today])

  if (!runs || !sessions) return null

  const plannedDistanceBySessionId = new Map(sessions.map((s) => [s.id, s.plannedDistanceKm]))
  const runActivities = runs.map((r) =>
    runToActivity(r, r.linkedSessionId ? plannedDistanceBySessionId.get(r.linkedSessionId) : undefined),
  )
  const strengthActivities = sessions
    .filter((s) => s.type === 'strength' && s.status === 'completed')
    .map(strengthSessionToActivity)
  const activities = buildActivities(runActivities, strengthActivities)

  const recovery = computeRecoveryState(activities, today, todaysSession)
  const refuel = computeRefuelPrompt(activities, new Date())
  const bandStyle = BAND_STYLE[recovery.band]

  const last7Days = Array.from({ length: LOOKBACK_DAYS + 1 }, (_, i) => addDays(today, i - LOOKBACK_DAYS))
  const loadByDay = last7Days.map((date) => {
    const dayActivities = activities.filter((a) => a.date === date)
    if (dayActivities.length === 0) return { date, level: undefined as ActivityLoadLevel | undefined }
    const levels = dayActivities.map((a) => computeActivityLoad(a).level)
    const level: ActivityLoadLevel = levels.includes('hard') ? 'hard' : levels.includes('moderate') ? 'moderate' : 'light'
    return { date, level }
  })

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className="w-full rounded-2xl border border-border bg-surface p-4 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${bandStyle.badge}`}>
            {bandStyle.label}
          </span>
          {refuel.active && (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-warning/20 px-2 py-1 text-[11px] font-medium text-warning">
              Refuel: {refuel.minutesRemaining}m left
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-ink-muted">{recovery.reasoning}</p>
      </button>

      {showDetail && (
        <BottomSheet onClose={() => setShowDetail(false)}>
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold text-ink">Recovery</h2>
              <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[11px] font-medium ${bandStyle.badge}`}>
                {bandStyle.label}
              </span>
              <p className="mt-2 text-sm text-ink-muted">{recovery.reasoning}</p>
              {recovery.nextQualityDate && (
                <p className="mt-1 text-xs text-ink-faint">
                  Next quality session: {formatDisplayDate(recovery.nextQualityDate)}
                </p>
              )}
            </div>

            {refuel.active && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                <p className="text-sm font-medium text-warning">Refuel window — {refuel.minutesRemaining} min left</p>
                <p className="mt-1 text-xs text-warning">
                  Aim for ~45-60g carbs and 15-20g protein: {REFUEL_EXAMPLES.join(', ')}.
                </p>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Last 7 days</h3>
              <div className="flex items-end gap-1">
                {loadByDay.map(({ date, level }) => (
                  <div key={date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`h-8 w-full rounded ${level ? LOAD_BAR_STYLE[level] : 'bg-surface-inset'}`}
                      title={level ?? 'rest'}
                    />
                    <span className="text-[10px] text-ink-faint">
                      {formatDisplayDate(date).slice(0, 2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-[11px] text-ink-faint">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-accent/50" /> Light
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-warning/60" /> Moderate
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-danger/60" /> Hard
                </span>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">How this works</h3>
              <ul className="flex flex-col gap-2 text-sm text-ink-muted">
                <li className="rounded-xl border border-border bg-surface-inset p-3">
                  Easy runs under 45 min are light — no real recovery time needed.
                </li>
                <li className="rounded-xl border border-border bg-surface-inset p-3">
                  Longer easy runs, tempo, marathon-pace, long runs, and strength sessions are
                  moderate-to-hard efforts — allow 24-48h before your next quality session.
                </li>
                <li className="rounded-xl border border-border bg-surface-inset p-3">
                  A very high effort (8+/10) or running well over the planned distance bumps the load
                  up a band.
                </li>
                <li className="rounded-xl border border-border bg-surface-inset p-3">
                  If today has a scheduled run and yesterday went to plan, guidance won't fight the
                  plan — it'll just suggest keeping today genuinely easy.
                </li>
              </ul>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  )
}
