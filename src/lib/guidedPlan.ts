// Step sequencing for guided strength sessions, in two formats:
//
//   • Straight sets — one step per exercise covering all of its sets (the
//     original guided-mode behavior).
//   • Circuit — one set of each exercise in listed order per round, looping
//     until every set is done. Exercises with fewer sets drop out of later
//     rounds. Plyo primers always run first, in full, before round 1 —
//     plyos must be done fresh, so they're never rotated into rounds.
//
// Timed holds fit the same structure: one hold = one set.

import type { GuidedProgress, SessionExercise, SessionFormat } from '../types'

export const DEFAULT_SESSION_FORMAT: SessionFormat = 'straight'
export const DEFAULT_REST_SECONDS = 45
export const DEFAULT_CIRCUIT_REST_SECONDS = 20

export const SESSION_FORMAT_LABELS: Record<SessionFormat, string> = {
  straight: 'Straight sets',
  circuit: 'Circuit',
}

export interface GuidedStep {
  exerciseIndex: number
  exerciseId: string
  /** Sets completed for this exercise once this step is done (1-based).
   *  Straight-sets and primer steps cover every set, so this equals `sets`. */
  setNumber: number
  /** Circuit round (1-based); 0 for primer steps and all straight-sets steps. */
  round: number
  isPrimer: boolean
}

export function buildGuidedSteps(exercises: SessionExercise[], format: SessionFormat): GuidedStep[] {
  if (format === 'straight') {
    return exercises.map((e, i) => ({ exerciseIndex: i, exerciseId: e.exerciseId, setNumber: e.sets, round: 0, isPrimer: false }))
  }
  const primers: GuidedStep[] = []
  const rest: { e: SessionExercise; i: number }[] = []
  exercises.forEach((e, i) => {
    if (e.isPlyo) primers.push({ exerciseIndex: i, exerciseId: e.exerciseId, setNumber: e.sets, round: 0, isPrimer: true })
    else rest.push({ e, i })
  })
  const rounds = Math.max(0, ...rest.map(({ e }) => e.sets))
  const steps = [...primers]
  for (let round = 1; round <= rounds; round++) {
    for (const { e, i } of rest) {
      if (e.sets >= round) steps.push({ exerciseIndex: i, exerciseId: e.exerciseId, setNumber: round, round, isPrimer: false })
    }
  }
  return steps
}

export function totalRounds(steps: GuidedStep[]): number {
  return Math.max(0, ...steps.map((s) => s.round))
}

/** Rest after completing `steps[index]`. In circuit mode the short rest runs
 *  between exercises within a round; the full rest runs between rounds and
 *  after the primer. Zero after the final step. */
export function restAfterStep(
  steps: GuidedStep[],
  index: number,
  format: SessionFormat,
  restSeconds: number,
  circuitRestSeconds: number,
): number {
  const current = steps[index]
  const next = steps[index + 1]
  if (!current || !next) return 0
  if (format === 'straight') return restSeconds
  const sameRound = !current.isPrimer && !next.isPrimer && current.round === next.round
  return sameRound ? circuitRestSeconds : restSeconds
}

/** Sets completed per exercise after the first `doneSteps` steps. */
export function completedSetsAfter(steps: GuidedStep[], doneSteps: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const step of steps.slice(0, doneSteps)) out[step.exerciseId] = step.setNumber
  return out
}

export function isExerciseComplete(exercise: SessionExercise, completedSets: Record<string, number>): boolean {
  return (completedSets[exercise.exerciseId] ?? 0) >= exercise.sets
}

/** The resume point to persist once `doneSteps` steps are complete. */
export function progressAfter(steps: GuidedStep[], doneSteps: number, format: SessionFormat, exercises: SessionExercise[]): GuidedProgress {
  const completedSets = completedSetsAfter(steps, doneSteps)
  const next = steps[doneSteps]
  return {
    format,
    stepIndex: doneSteps,
    round: next?.round ?? 0,
    currentExerciseIndex: next?.exerciseIndex ?? exercises.length,
    completedSets,
    completedExerciseIds: exercises.filter((e) => isExerciseComplete(e, completedSets)).map((e) => e.exerciseId),
  }
}

export interface ResumePoint {
  format: SessionFormat
  stepIndex: number
}

/** Where to (re)start guided mode. A stored resume point is trusted when it
 *  still lines up with the step list; otherwise (e.g. the exercises were
 *  swapped by an injury variant after progress was saved) the position is
 *  re-derived from the per-set counts. Legacy progress without a format was
 *  written by straight-sets guided mode. */
export function resolveResumePoint(
  exercises: SessionExercise[],
  progress: GuidedProgress | undefined,
  defaultFormat: SessionFormat,
): ResumePoint {
  if (!progress) return { format: defaultFormat, stepIndex: 0 }
  const format = progress.format ?? 'straight'
  const steps = buildGuidedSteps(exercises, format)

  const stored = progress.stepIndex ?? (progress.format ? undefined : progress.currentExerciseIndex)
  const completedSets =
    progress.completedSets ??
    Object.fromEntries(
      exercises.filter((e) => progress.completedExerciseIds.includes(e.exerciseId)).map((e) => [e.exerciseId, e.sets]),
    )

  if (stored !== undefined && stored >= 0 && stored <= steps.length) {
    const expected = completedSetsAfter(steps, stored)
    const consistent = exercises.every((e) => (expected[e.exerciseId] ?? 0) === Math.min(e.sets, completedSets[e.exerciseId] ?? 0))
    if (consistent) return { format, stepIndex: stored }
  }
  const firstUndone = steps.findIndex((s) => (completedSets[s.exerciseId] ?? 0) < s.setNumber)
  return { format, stepIndex: firstUndone === -1 ? steps.length : firstUndone }
}

/** Per-set dose for a circuit step — the prescription minus its "N × "
 *  sets prefix, e.g. "3 × 8/side · 2 s pause" → "8/side · 2 s pause",
 *  "3 × 15" → "15 reps". */
export function perSetDose(e: SessionExercise): string {
  if (e.prescription) {
    if (e.isPlyo) return e.prescription
    // A bare count ("15", "8–12") reads as reps once the sets prefix is gone.
    return e.prescription.replace(/^\d+\s*×\s*/, '').replace(/^(\d+(?:–\d+)?)(?=$| ·)/, '$1 reps')
  }
  return e.reps !== undefined ? `${e.reps} reps` : `${e.holdSeconds} s hold`
}
