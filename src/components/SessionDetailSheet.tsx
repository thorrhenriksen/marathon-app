import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addDays, formatDisplayDateLong } from '../lib/dates'
import {
  computePaceZones,
  DEFAULT_GOAL_SECONDS,
  estimateSessionDurationMinutes,
  formatDuration,
  formatPace,
  formatPaceDelta,
} from '../lib/paceZones'
import { findLastComparableRun } from '../lib/comparableRun'
import { isNearLongestLongRun, pickTips } from '../lib/sessionTips'
import { moveSessionToDate, applyNotFeeling100 } from '../lib/adjustmentEngine'
import type { Session } from '../types'
import BottomSheet from './BottomSheet'
import Modal from './Modal'
import LogRunForm from './LogRunForm'
import { SESSION_TYPE_LABELS, paceGuidanceFor } from './SessionCard'

interface SessionDetailSheetProps {
  session: Session
  onClose: () => void
}

export default function SessionDetailSheet({ session, onClose }: SessionDetailSheetProps) {
  const goal = useLiveQuery(() => db.goals.get('goal'), [])
  const weekMeta = useLiveQuery(() => db.weeks.get(session.week), [session.week])
  const allSessions = useLiveQuery(() => db.sessions.toArray(), [])
  const runs = useLiveQuery(() => db.runs.toArray(), [])
  const linkedRun = useLiveQuery(
    () => (session.linkedRunId ? db.runs.get(session.linkedRunId) : undefined),
    [session.linkedRunId],
  )

  const [logging, setLogging] = useState(false)
  const [moving, setMoving] = useState(false)
  const [moveDate, setMoveDate] = useState(session.date)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [confirmingNotFeeling100, setConfirmingNotFeeling100] = useState(false)

  const zones = computePaceZones(goal?.targetTimeSeconds ?? DEFAULT_GOAL_SECONDS)
  const estimatedMinutes = estimateSessionDurationMinutes(session.plannedDistanceKm, zones)

  const tips: string[] = [...pickTips(session, 3)]
  if (session.type === 'long' && estimatedMinutes > 90) {
    tips.unshift('This run is long enough to rehearse your race-day fueling and hydration plan.')
  }
  if (allSessions && isNearLongestLongRun(session, allSessions)) {
    tips.unshift('This is close to your longest long run — a good day to practice your race-day breakfast.')
  }

  const referencePaceSecPerKm = (() => {
    switch (session.type) {
      case 'tempo':
        return (zones.tempoPaceMinSecPerKm + zones.tempoPaceMaxSecPerKm) / 2
      case 'marathon-pace':
      case 'race':
        return zones.marathonPaceSecPerKm
      case 'easy':
      case 'long':
      case 'strides':
        return (zones.easyPaceMinSecPerKm + zones.easyPaceMaxSecPerKm) / 2
      case 'rest':
        return 0
    }
  })()

  const lastComparableRun =
    session.type !== 'rest' ? findLastComparableRun(session, runs ?? []) : undefined

  const canAct = session.status !== 'completed'
  const canLog = session.type !== 'rest' && session.status !== 'skipped'

  async function handleMove() {
    if (!weekMeta) return
    const updated = moveSessionToDate(session, moveDate, weekMeta)
    if (!updated) {
      setMoveError('Pick a date within this session\'s plan week.')
      return
    }
    await db.sessions.put(updated)
    onClose()
  }

  async function handleNotFeeling100() {
    const updated = applyNotFeeling100(session)
    await db.sessions.put(updated)
    onClose()
  }

  const weekStart = weekMeta ? weekMeta.startDate : session.date
  const weekEnd = weekMeta ? addDays(weekMeta.startDate, 6) : session.date

  return (
    <>
      <BottomSheet onClose={onClose}>
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">{SESSION_TYPE_LABELS[session.type]}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{formatDisplayDateLong(session.date)}</h2>
            {weekMeta && (
              <p className="mt-1 text-sm text-ink-faint">
                Week {weekMeta.week} · {weekMeta.phaseLabel}
              </p>
            )}
          </div>

          {session.type !== 'rest' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-surface-inset p-3">
                <p className="text-xs text-ink-faint">Distance</p>
                <p className="mt-1 text-lg font-semibold text-ink">{session.plannedDistanceKm} km</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-inset p-3">
                <p className="text-xs text-ink-faint">Target pace</p>
                <p className="mt-1 text-lg font-semibold text-ink">{paceGuidanceFor(session, zones)}</p>
              </div>
            </div>
          )}

          <p className="text-sm text-ink-muted">{session.description}</p>

          {tips.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Tips</h3>
              <ul className="flex flex-col gap-2">
                {tips.map((tip) => (
                  <li key={tip} className="rounded-xl border border-border bg-surface-inset p-3 text-sm text-ink-muted">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lastComparableRun && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Last comparable run</h3>
              <div className="rounded-xl border border-border bg-surface-inset p-3 text-sm text-ink-muted">
                <p>
                  {lastComparableRun.distanceKm} km on {formatDisplayDateLong(lastComparableRun.date)} at{' '}
                  {formatPace(lastComparableRun.paceSecPerKm)}
                </p>
                {referencePaceSecPerKm > 0 && (
                  <p className="mt-1 text-ink-faint">
                    {formatPaceDelta(lastComparableRun.paceSecPerKm, referencePaceSecPerKm)}
                  </p>
                )}
              </div>
            </div>
          )}

          {session.status === 'completed' ? (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Planned vs actual</h3>
              {linkedRun ? (
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
                  <p className="text-ink">
                    Ran {linkedRun.distanceKm} km in {formatDuration(linkedRun.durationSeconds)} (
                    {formatPace(linkedRun.paceSecPerKm)})
                  </p>
                  {referencePaceSecPerKm > 0 && (
                    <p className="mt-1 text-ink-muted">
                      {formatPaceDelta(linkedRun.paceSecPerKm, referencePaceSecPerKm)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-faint">No run details recorded.</p>
              )}
            </div>
          ) : (
            canAct && (
              <div className="flex flex-col gap-2">
                {canLog && (
                  <button
                    onClick={() => setLogging(true)}
                    className="w-full rounded-xl bg-accent py-3 text-base font-semibold text-accent-fg"
                  >
                    Log this run
                  </button>
                )}

                {!moving ? (
                  <button
                    onClick={() => {
                      setMoving(true)
                      setMoveError(null)
                    }}
                    className="w-full rounded-xl border border-border py-3 text-sm font-medium text-ink"
                  >
                    Move this session
                  </button>
                ) : (
                  <div className="rounded-xl border border-border p-3">
                    <label className="text-xs text-ink-faint">New date (within this plan week)</label>
                    <input
                      type="date"
                      value={moveDate}
                      min={weekStart}
                      max={weekEnd}
                      onChange={(e) => setMoveDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-ink"
                    />
                    {moveError && <p className="mt-1 text-xs text-danger">{moveError}</p>}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setMoving(false)}
                        className="flex-1 rounded-lg border border-border py-2 text-sm text-ink-muted"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleMove}
                        className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-accent-fg"
                      >
                        Confirm move
                      </button>
                    </div>
                  </div>
                )}

                {!confirmingNotFeeling100 ? (
                  <button
                    onClick={() => setConfirmingNotFeeling100(true)}
                    className="w-full rounded-xl border border-border py-3 text-sm font-medium text-ink"
                  >
                    Not feeling 100%
                  </button>
                ) : (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                    <p className="text-sm text-warning">
                      This will replace today's session with a short easy run (or rest). Confirm?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setConfirmingNotFeeling100(false)}
                        className="flex-1 rounded-lg border border-border py-2 text-sm text-ink-muted"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleNotFeeling100}
                        className="flex-1 rounded-lg bg-warning py-2 text-sm font-medium text-accent-fg"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </BottomSheet>

      {logging && (
        <Modal title="Log this run" onClose={() => setLogging(false)}>
          <LogRunForm
            session={session}
            onSaved={() => {
              setLogging(false)
              onClose()
            }}
            onCancel={() => setLogging(false)}
          />
        </Modal>
      )}
    </>
  )
}
