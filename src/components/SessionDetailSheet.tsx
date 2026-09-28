import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addDays, formatDisplayDateLong, todayISO } from '../lib/dates'
import { canMarkMissed, canChangeOutcome } from '../lib/sessionStatus'
import {
  estimateSessionDurationMinutes,
  formatDuration,
  formatPace,
  formatPaceDelta,
} from '../lib/paceZones'
import { findLastComparableRun } from '../lib/comparableRun'
import { findLastComparableStrengthSession } from '../lib/comparableStrength'
import { isNearLongestLongRun, pickTips } from '../lib/sessionTips'
import { moveSessionToDate, applyNotFeeling100, applySwapToMobilityOnly } from '../lib/adjustmentEngine'
import { revertSessionToPlanned } from '../db/runs'
import { completeStrengthSession } from '../lib/completeStrengthSession'
import { applyInjuryVariant, INJURY_VARIANT_LABELS, restoreNormalStrength } from '../lib/injuryVariants'
import { primeAudioCue } from '../lib/audioCue'
import type { InjuryVariant, Session, SessionExercise } from '../types'
import BottomSheet from './BottomSheet'
import Modal from './Modal'
import LogRunForm from './LogRunForm'
import ExerciseDetailSheet from './ExerciseDetailSheet'
import GuidedStrengthSession from './GuidedStrengthSession'
import { effectiveStrengthExercises, exerciseDose, strengthSessionLabel } from '../lib/strengthBlocks'
import { SESSION_TYPE_LABELS, paceGuidanceFor, racePaceFor } from './SessionCard'
import { useGoalEngine } from '../lib/useGoalEngine'
import { computeTrainingZones, resolveGoals, marathonVdot, PROVISIONAL_MARATHON_SECONDS } from '../lib/goalEngine'

// Only used for the first render tick while the goal engine loads.
const FALLBACK_VDOT = marathonVdot(PROVISIONAL_MARATHON_SECONDS)
const FALLBACK_ZONES = computeTrainingZones(FALLBACK_VDOT, resolveGoals(undefined, FALLBACK_VDOT), false)

const INJURY_VARIANT_DETAIL: Record<InjuryVariant, string> = {
  'sore-knees': 'Wall sits, bilateral RDLs, hip abduction + clamshells, bridges; no plyos; short-lever Copenhagen.',
  'sore-toe': 'No toes-tucked or toe-extension work: knee push-ups and planks, half-height seated calf raises; no plyos.',
  'sore-knees-toe': 'Both of the above combined.',
}

function ChangeOption({ title, detail, active, onClick }: { title: string; detail: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left ${active ? 'border-strength bg-strength/10' : 'border-border active:bg-surface-inset'}`}
    >
      <p className="text-sm font-medium text-ink">
        {title}
        {active && <span className="ml-2 text-xs text-strength">Current</span>}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{detail}</p>
    </button>
  )
}

interface SessionDetailSheetProps {
  session: Session
  onClose: () => void
}

export default function SessionDetailSheet({ session, onClose }: SessionDetailSheetProps) {
  const engine = useGoalEngine()
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
  const [storedExercises, setExercises] = useState<SessionExercise[]>(session.exercises ?? [])
  // Plyos drop out when a knee/toe variant was used in the prior two weeks.
  const exercises = allSessions
    ? effectiveStrengthExercises({ ...session, exercises: storedExercises }, allSessions)
    : storedExercises
  const [confirmingComplete, setConfirmingComplete] = useState(false)
  const [completionNote, setCompletionNote] = useState('')
  const [changingStrength, setChangingStrength] = useState(false)
  const [confirmingChangeOutcome, setConfirmingChangeOutcome] = useState(false)
  const [detailExercise, setDetailExercise] = useState<SessionExercise | null>(null)
  const [guiding, setGuiding] = useState(false)

  const zones = engine?.zones ?? FALLBACK_ZONES
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
        return zones.marathonPaceSecPerKm
      case 'race':
        return racePaceFor(session, zones)
      case 'easy':
      case 'long':
      case 'strides':
        return (zones.easyPaceMinSecPerKm + zones.easyPaceMaxSecPerKm) / 2
      case 'rest':
      case 'strength':
        return 0
    }
  })()

  const lastComparableRun =
    session.type !== 'rest' && session.type !== 'strength'
      ? findLastComparableRun(session, runs ?? [])
      : undefined

  const lastComparableStrengthSession =
    session.type === 'strength' ? findLastComparableStrengthSession(session, allSessions ?? []) : undefined

  const canAct = session.status !== 'completed'
  const canLog = session.type !== 'rest' && session.type !== 'strength' && session.status !== 'skipped'
  const canMissThisSession = canMarkMissed(session, todayISO())
  const canRevertOutcome = canChangeOutcome(session, todayISO())

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

  function handleToggleExercise(exerciseId: string) {
    const updated = storedExercises.map((e) => (e.exerciseId === exerciseId ? { ...e, completed: !e.completed } : e))
    setExercises(updated)
    db.sessions.update(session.id, { exercises: updated })
  }

  async function handleCompleteSession() {
    await completeStrengthSession({ ...session, exercises }, completionNote)
    onClose()
  }

  function handleStartGuidedSession() {
    primeAudioCue()
    setGuiding(true)
  }

  async function handleSwapToMobilityOnly() {
    const updated = applySwapToMobilityOnly(session)
    await db.sessions.put(updated)
    onClose()
  }

  async function handleRestoreNormal() {
    await db.sessions.put(restoreNormalStrength(session))
    onClose()
  }

  async function handleApplyVariant(variant: InjuryVariant) {
    await db.sessions.put(applyInjuryVariant(session, variant, todayISO()))
    onClose()
  }

  async function handleMarkMissed() {
    await db.sessions.put({ ...session, status: 'missed' })
    onClose()
  }

  async function handleChangeOutcome() {
    await revertSessionToPlanned(session)
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

          {session.type !== 'rest' && session.type !== 'strength' && (
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

          {session.type === 'strength' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-surface-inset p-3">
                <p className="text-xs text-ink-faint">Session</p>
                <p className="mt-1 text-lg font-semibold text-ink">{strengthSessionLabel(session)}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-inset p-3">
                <p className="text-xs text-ink-faint">Duration</p>
                <p className="mt-1 text-lg font-semibold text-ink">{session.estimatedMinutes ?? 25} min</p>
              </div>
            </div>
          )}

          <p className="text-sm text-ink-muted">{session.description}</p>

          {session.type === 'strength' && session.status !== 'completed' && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Exercises</h3>
              <ul className="flex flex-col gap-2">
                {exercises.map((exercise) => (
                  <li key={exercise.exerciseId} className="flex items-start gap-3 rounded-xl border border-border bg-surface-inset p-3">
                    <input
                      type="checkbox"
                      checked={exercise.completed}
                      onChange={() => handleToggleExercise(exercise.exerciseId)}
                      className="mt-1 h-4 w-4 accent-strength"
                    />
                    <button
                      onClick={() => setDetailExercise(exercise)}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-medium text-ink">{exercise.name}</p>
                      <p className="text-xs text-ink-faint">
                        {exerciseDose(exercise)}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">{exercise.formCue}</p>
                    </button>
                  </li>
                ))}
              </ul>
              {session.strengthBlock && session.variant && (
                <p className="mt-2 text-xs text-ink-faint">
                  Double progression: once you hit the top of the rep range on every set at RPE ≤8, add load next
                  time — then slow the tempo when the dumbbells max out.
                </p>
              )}
              {canAct && (
                <button
                  onClick={handleStartGuidedSession}
                  className="mt-3 w-full rounded-xl bg-strength py-3 text-sm font-semibold text-accent-fg"
                >
                  {session.guidedProgress ? 'Resume session' : 'Start session'}
                </button>
              )}
            </div>
          )}

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

          {lastComparableStrengthSession && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Last comparable session</h3>
              <div className="rounded-xl border border-border bg-surface-inset p-3 text-sm text-ink-muted">
                <p>
                  Session {lastComparableStrengthSession.variant} on{' '}
                  {formatDisplayDateLong(lastComparableStrengthSession.date)}
                </p>
                {lastComparableStrengthSession.completionNote && (
                  <p className="mt-1 text-ink-faint">{lastComparableStrengthSession.completionNote}</p>
                )}
              </div>
            </div>
          )}

          {session.status === 'missed' ? (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-3">
              <p className="text-sm text-danger">Marked as missed.</p>
            </div>
          ) : session.status === 'completed' ? (
            session.type === 'strength' ? (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Exercises completed</h3>
                <ul className="flex flex-col gap-2">
                  {(session.exercises ?? []).map((exercise) => (
                    <li
                      key={exercise.exerciseId}
                      className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm text-ink"
                    >
                      ✓ {exercise.name}
                    </li>
                  ))}
                </ul>
                {session.completionNote && (
                  <p className="mt-2 text-sm text-ink-muted">{session.completionNote}</p>
                )}
              </div>
            ) : (
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
            )
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

                {canMissThisSession && session.type !== 'strength' && (
                  <button
                    onClick={handleMarkMissed}
                    className="w-full rounded-xl border border-danger/40 py-3 text-sm font-medium text-danger"
                  >
                    Mark as missed
                  </button>
                )}

                {session.type === 'strength' &&
                  (!confirmingComplete ? (
                    <button
                      onClick={() => setConfirmingComplete(true)}
                      className="w-full rounded-xl bg-accent py-3 text-base font-semibold text-accent-fg"
                    >
                      Complete session
                    </button>
                  ) : (
                    <div className="rounded-xl border border-border p-3">
                      <label className="text-xs text-ink-faint">Note (optional)</label>
                      <textarea
                        value={completionNote}
                        onChange={(e) => setCompletionNote(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-ink"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setConfirmingComplete(false)}
                          className="flex-1 rounded-lg border border-border py-2 text-sm text-ink-muted"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCompleteSession}
                          className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-accent-fg"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  ))}

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

                {session.type === 'strength' ? (
                  <button
                    onClick={() => setChangingStrength(true)}
                    className="w-full rounded-xl border border-border py-3 text-sm font-medium text-ink"
                  >
                    Change…
                  </button>
                ) : !confirmingNotFeeling100 ? (
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

          {canRevertOutcome &&
            (!confirmingChangeOutcome ? (
              <button
                onClick={() => setConfirmingChangeOutcome(true)}
                className="w-full rounded-xl border border-border py-3 text-sm font-medium text-ink-muted"
              >
                Change outcome
              </button>
            ) : (
              <div className="rounded-xl border border-border bg-surface-inset p-3">
                <p className="text-sm text-ink-muted">
                  This resets the session back to planned, unlinking any logged run (the run itself won't be
                  deleted). Confirm?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setConfirmingChangeOutcome(false)}
                    className="flex-1 rounded-lg border border-border py-2 text-sm text-ink-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangeOutcome}
                    className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-accent-fg"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ))}
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

      {changingStrength && (
        <Modal title="Change this session" onClose={() => setChangingStrength(false)}>
          <div className="flex flex-col gap-2">
            {(session.injuryVariant || session.status === 'downgraded-to-mobility') && session.strengthBlock !== undefined && (
              <ChangeOption
                title="Normal session"
                detail="Back to this week's full block session."
                active={false}
                onClick={handleRestoreNormal}
              />
            )}
            <ChangeOption
              title="Mobility only"
              detail="Just the 5-minute mobility block."
              active={session.status === 'downgraded-to-mobility' && !session.injuryVariant}
              onClick={handleSwapToMobilityOnly}
            />
            {(Object.keys(INJURY_VARIANT_LABELS) as InjuryVariant[]).map((v) => (
              <ChangeOption
                key={v}
                title={INJURY_VARIANT_LABELS[v]}
                detail={INJURY_VARIANT_DETAIL[v]}
                active={session.injuryVariant === v}
                onClick={() => handleApplyVariant(v)}
              />
            ))}
            {canMissThisSession && (
              <button
                onClick={handleMarkMissed}
                className="mt-1 w-full rounded-xl border border-danger/40 py-3 text-sm font-medium text-danger"
              >
                Mark missed
              </button>
            )}
            <p className="mt-1 text-xs text-ink-faint">
              Variants count as a handled session — never a miss. You can still do and complete the session afterwards.
            </p>
          </div>
        </Modal>
      )}

      {detailExercise && (
        <ExerciseDetailSheet exercise={detailExercise} onClose={() => setDetailExercise(null)} />
      )}

      {guiding && (
        <GuidedStrengthSession
          session={{ ...session, exercises }}
          onClose={() => {
            setGuiding(false)
            onClose()
          }}
        />
      )}
    </>
  )
}
