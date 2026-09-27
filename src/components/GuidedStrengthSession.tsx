import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { completeStrengthSession } from '../lib/completeStrengthSession'
import { playAudioCue } from '../lib/audioCue'
import { requestWakeLock, releaseWakeLock } from '../lib/wakeLock'
import type { Session } from '../types'
import { ExerciseIllustration } from './exerciseIllustrations'
import { getCatalogEntry } from '../lib/strengthCatalog'

const DEFAULT_REST_SECONDS = 45

interface GuidedStrengthSessionProps {
  session: Session
  onClose: () => void
}

export default function GuidedStrengthSession({ session, onClose }: GuidedStrengthSessionProps) {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const exercises = session.exercises ?? []
  const restSeconds = settings?.restTimerSeconds ?? DEFAULT_REST_SECONDS
  const audioCueEnabled = settings?.audioCueEnabled ?? true
  const wakeLockPreferred = settings?.wakeLockEnabled ?? true

  const [currentIndex, setCurrentIndex] = useState(session.guidedProgress?.currentExerciseIndex ?? 0)
  const [completedIds, setCompletedIds] = useState<string[]>(session.guidedProgress?.completedExerciseIds ?? [])
  const [phase, setPhase] = useState<'exercise' | 'rest'>('exercise')
  // Rest is tracked as a deadline rather than a decrementing counter so the
  // countdown stays correct if the app is backgrounded mid-rest.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const currentExercise = exercises[currentIndex]
  const isLastExercise = currentIndex >= exercises.length - 1
  const entry = currentExercise ? getCatalogEntry(currentExercise.exerciseId) : undefined

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
    advanceToNextExercise()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restEndsAt, now])

  function advanceToNextExercise() {
    setRestEndsAt(null)
    setPhase('exercise')
    setCurrentIndex((i) => i + 1)
  }

  async function persistProgress(nextIndex: number, nextCompletedIds: string[]) {
    // Mirror guided completions onto the exercise checklist so the manual
    // view stays in sync if the user exits guided mode early.
    await db.sessions.update(session.id, {
      exercises: exercises.map((e) => (nextCompletedIds.includes(e.exerciseId) ? { ...e, completed: true } : e)),
      guidedProgress: { currentExerciseIndex: nextIndex, completedExerciseIds: nextCompletedIds },
    })
  }

  async function handleDoneNext() {
    if (!currentExercise) return
    const nextCompletedIds = completedIds.includes(currentExercise.exerciseId)
      ? completedIds
      : [...completedIds, currentExercise.exerciseId]
    setCompletedIds(nextCompletedIds)

    if (isLastExercise) {
      setFinishing(true)
      await completeStrengthSession(session)
      onClose()
      return
    }

    await persistProgress(currentIndex + 1, nextCompletedIds)
    if (restSeconds <= 0) {
      advanceToNextExercise()
      return
    }
    const start = Date.now()
    setNow(start)
    setRestEndsAt(start + restSeconds * 1000)
    setPhase('rest')
  }

  function handleSkipRest() {
    advanceToNextExercise()
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

  if (!currentExercise) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-5 pt-4">
        <p className="text-xs uppercase tracking-wide text-ink-faint">
          Exercise {currentIndex + 1} of {exercises.length}
        </p>
        <button onClick={onClose} className="rounded-full p-2 text-ink-muted hover:text-ink" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-5 py-6">
        {phase === 'exercise' ? (
          <>
            <ExerciseIllustration exerciseId={currentExercise.exerciseId} className="h-40 w-40 text-ink" />
            <div className="text-center">
              <h2 className="text-xl font-semibold text-ink">{currentExercise.name}</h2>
              {entry && <p className="mt-1 text-sm text-ink-faint">{entry.targetArea}</p>}
            </div>
            <div className="rounded-xl border border-border bg-surface-inset p-3 text-center">
              <p className="text-xs text-ink-faint">Prescription</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {currentExercise.sets} x {currentExercise.reps ?? `${currentExercise.holdSeconds}s hold`}
              </p>
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
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Rest</p>
            <p className="text-5xl font-semibold text-ink">{restRemaining}s</p>
            <p className="text-sm text-ink-faint">Next: {exercises[currentIndex + 1]?.name}</p>
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
            {isLastExercise ? 'Finish session' : 'Done — next'}
          </button>
        )}
      </div>
    </div>
  )
}
