import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { completeStrengthSession } from '../lib/completeStrengthSession'
import { playAudioCue } from '../lib/audioCue'
import { requestWakeLock, releaseWakeLock } from '../lib/wakeLock'
import type { Session, SessionFormat } from '../types'
import { ExerciseIllustration } from './exerciseIllustrations'
import { getCatalogEntry } from '../lib/strengthCatalog'
import { exerciseDose } from '../lib/strengthBlocks'
import {
  DEFAULT_CIRCUIT_REST_SECONDS,
  DEFAULT_REST_SECONDS,
  DEFAULT_SESSION_FORMAT,
  buildGuidedSteps,
  perSetDose,
  progressAfter,
  resolveResumePoint,
  restAfterStep,
  totalRounds,
} from '../lib/guidedPlan'
import SessionFormatToggle from './SessionFormatToggle'

interface GuidedStrengthSessionProps {
  session: Session
  /** Format to start in when the session has no saved progress. */
  initialFormat?: SessionFormat
  onClose: () => void
}

export default function GuidedStrengthSession({ session, initialFormat, onClose }: GuidedStrengthSessionProps) {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const exercises = session.exercises ?? []
  const restSeconds = settings?.restTimerSeconds ?? DEFAULT_REST_SECONDS
  const circuitRestSeconds = settings?.circuitRestSeconds ?? DEFAULT_CIRCUIT_REST_SECONDS
  const audioCueEnabled = settings?.audioCueEnabled ?? true
  const wakeLockPreferred = settings?.wakeLockEnabled ?? true

  const [resume] = useState(() =>
    resolveResumePoint(exercises, session.guidedProgress, initialFormat ?? DEFAULT_SESSION_FORMAT),
  )
  const [format, setFormat] = useState<SessionFormat>(resume.format)
  const [stepIndex, setStepIndex] = useState(resume.stepIndex)
  const [phase, setPhase] = useState<'exercise' | 'rest'>('exercise')
  // Rest is tracked as a deadline rather than a decrementing counter so the
  // countdown stays correct if the app is backgrounded mid-rest.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // Exercise ids are stable for the life of this overlay, so key the memo on them.
  const exerciseKey = exercises.map((e) => `${e.exerciseId}:${e.sets}:${e.isPlyo ? 1 : 0}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const steps = useMemo(() => buildGuidedSteps(exercises, format), [exerciseKey, format])
  const rounds = totalRounds(steps)
  const isCircuit = format === 'circuit'

  const currentStep = steps[stepIndex]
  const nextStep = steps[stepIndex + 1]
  const currentExercise = currentStep ? exercises[currentStep.exerciseIndex] : undefined
  const nextExercise = nextStep ? exercises[nextStep.exerciseIndex] : undefined
  const isLastStep = stepIndex >= steps.length - 1
  const entry = currentExercise ? getCatalogEntry(currentExercise.exerciseId) : undefined
  // The format can be switched only before anything has been done.
  const canSwitchFormat = stepIndex === 0 && phase === 'exercise'

  useEffect(() => {
    if (!wakeLockPreferred) return
    let cancelled = false
    requestWakeLock().then((ok) => {
      if (!cancelled) setWakeLockActive(ok)
    })
    function handleVisibility() {
      if (document.visibilityState === 'visible' && wakeLockPreferred) {
        requestWakeLock().then((ok) => setWakeLockActive(ok))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      releaseWakeLock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restRemaining = restEndsAt === null ? 0 : Math.max(0, Math.ceil((restEndsAt - now) / 1000))

  useEffect(() => {
    if (phase !== 'rest') return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'rest' || restEndsAt === null || now < restEndsAt) return
    if (audioCueEnabled) playAudioCue()
    advanceToNextStep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restEndsAt, now])

  function advanceToNextStep() {
    setRestEndsAt(null)
    setPhase('exercise')
    setStepIndex((i) => i + 1)
  }

  async function persistProgress(doneSteps: number) {
    const progress = progressAfter(steps, doneSteps, format, exercises)
    // Mirror per-set progress onto the stored checklist so the manual view
    // stays in sync if the user exits guided mode early. Read the stored
    // list rather than the effective one so display-time filtering (plyos
    // hidden after a recent injury variant) never rewrites saved exercises.
    const stored = await db.sessions.get(session.id)
    const storedExercises = stored?.exercises ?? exercises
    await db.sessions.update(session.id, {
      exercises: storedExercises.map((e) =>
        progress.completedExerciseIds.includes(e.exerciseId) ? { ...e, completed: true } : e,
      ),
      guidedProgress: progress,
    })
  }

  async function handleChangeFormat(next: SessionFormat) {
    setFormat(next)
    await db.settings.update('settings', { strengthSessionFormat: next })
  }

  async function handleDoneNext() {
    if (!currentStep) return

    if (isLastStep) {
      setFinishing(true)
      await completeStrengthSession(session)
      onClose()
      return
    }

    await persistProgress(stepIndex + 1)
    const rest = restAfterStep(steps, stepIndex, format, restSeconds, circuitRestSeconds)
    if (rest <= 0) {
      advanceToNextStep()
      return
    }
    const start = Date.now()
    setNow(start)
    setRestEndsAt(start + rest * 1000)
    setPhase('rest')
  }

  function handleSkipRest() {
    advanceToNextStep()
  }

  async function toggleWakeLockPreference() {
    const next = !wakeLockPreferred
    await db.settings.update('settings', { wakeLockEnabled: next })
    if (next) {
      const ok = await requestWakeLock()
      setWakeLockActive(ok)
    } else {
      await releaseWakeLock()
      setWakeLockActive(false)
    }
  }

  if (!currentStep || !currentExercise) {
    return null
  }

  const headerLabel = !isCircuit
    ? `Exercise ${stepIndex + 1} of ${steps.length}`
    : currentStep.isPrimer
      ? 'Plyo primer · before the circuit'
      : `Round ${currentStep.round} of ${rounds}`
  // During rest the header describes what's coming up.
  const restHeaderLabel =
    isCircuit && nextStep && !nextStep.isPrimer ? `Round ${nextStep.round} of ${rounds}` : headerLabel
  const nextIsNewRound =
    isCircuit && nextStep && !currentStep.isPrimer && !nextStep.isPrimer && nextStep.round !== currentStep.round

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-5 pt-4">
        <p className="text-xs uppercase tracking-wide text-ink-faint">{phase === 'rest' ? restHeaderLabel : headerLabel}</p>
        <button onClick={onClose} className="rounded-full p-2 text-ink-muted hover:text-ink" aria-label="Close">
          ✕
        </button>
      </div>

      {canSwitchFormat && (
        <div className="flex justify-center px-5 pt-2">
          <SessionFormatToggle value={format} onChange={handleChangeFormat} />
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-5 py-6">
        {phase === 'exercise' ? (
          <>
            <ExerciseIllustration exerciseId={currentExercise.exerciseId} className="h-40 w-40 text-ink" />
            <div className="text-center">
              <h2 className="text-xl font-semibold text-ink">{currentExercise.name}</h2>
              {entry && <p className="mt-1 text-sm text-ink-faint">{entry.targetArea}</p>}
            </div>
            <div className="rounded-xl border border-border bg-surface-inset p-3 text-center">
              {isCircuit && !currentStep.isPrimer ? (
                <>
                  <p className="text-xs text-ink-faint">
                    Set {currentStep.setNumber} of {currentExercise.sets}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-ink">{perSetDose(currentExercise)}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-ink-faint">Prescription</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{exerciseDose(currentExercise)}</p>
                </>
              )}
            </div>
            {entry && entry.cues.length > 0 && (
              <ul className="flex w-full max-w-sm flex-col gap-2">
                {entry.cues.map((cue) => (
                  <li key={cue} className="rounded-xl border border-border bg-surface-inset p-3 text-sm text-ink-muted">
                    {cue}
                  </li>
                ))}
              </ul>
            )}
            {isCircuit && nextExercise && (
              <p className="text-sm text-ink-faint">
                Next: {nextExercise.name}
                {nextIsNewRound && ` · round ${nextStep.round}`}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              {nextIsNewRound ? 'Rest between rounds' : currentStep.isPrimer && isCircuit ? 'Rest before the circuit' : 'Rest'}
            </p>
            <p className="text-5xl font-semibold text-ink">{restRemaining}s</p>
            <p className="text-sm text-ink-faint">
              Next: {nextExercise?.name}
              {isCircuit && nextStep && !nextStep.isPrimer && nextExercise && ` · set ${nextStep.setNumber} of ${nextExercise.sets}`}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-5 pb-4">
        <button
          onClick={toggleWakeLockPreference}
          className="w-full rounded-xl border border-border py-2 text-xs font-medium text-ink-muted"
        >
          Keep screen awake: {wakeLockPreferred ? (wakeLockActive ? 'on' : 'requested (unavailable)') : 'off'}
        </button>

        {phase === 'rest' ? (
          <button
            onClick={handleSkipRest}
            className="w-full rounded-xl border border-border py-3 text-sm font-medium text-ink"
          >
            Skip rest
          </button>
        ) : (
          <button
            onClick={handleDoneNext}
            disabled={finishing}
            className="w-full rounded-xl bg-accent py-3 text-base font-semibold text-accent-fg disabled:opacity-60"
          >
            {isLastStep ? 'Finish session' : 'Done — next'}
          </button>
        )}
      </div>
    </div>
  )
}
