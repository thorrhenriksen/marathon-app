import { describe, it, expect } from 'vitest'
import {
  buildGuidedSteps,
  completedSetsAfter,
  isExerciseComplete,
  perSetDose,
  progressAfter,
  resolveResumePoint,
  restAfterStep,
  totalRounds,
  type GuidedStep,
} from './guidedPlan'
import { generateStrengthSessions } from './strengthSchedule'
import { applyInjuryVariant } from './injuryVariants'
import { buildMobilityOnlyExercises } from './strengthCatalog'
import type { SessionExercise } from '../types'

function ex(id: string, sets: number, extra: Partial<SessionExercise> = {}): SessionExercise {
  return { exerciseId: id, name: id, sets, reps: 10, formCue: '', completed: false, ...extra }
}

const seq = (steps: GuidedStep[]) => steps.map((s) => `${s.round}:${s.exerciseId}#${s.setNumber}`)

const all = generateStrengthSessions()
const pick = (week: number, variant: 'A' | 'B') =>
  all.find((s) => s.week === week && s.variant === variant && !/mobility only/.test(s.description))!

describe('straight sets', () => {
  it('is one step per exercise covering all its sets (unchanged behavior)', () => {
    const steps = buildGuidedSteps([ex('a', 3), ex('b', 2)], 'straight')
    expect(seq(steps)).toEqual(['0:a#3', '0:b#2'])
    expect(restAfterStep(steps, 0, 'straight', 45, 20)).toBe(45)
    expect(restAfterStep(steps, 1, 'straight', 45, 20)).toBe(0)
  })

  it('keeps a plyo primer in its listed position', () => {
    const steps = buildGuidedSteps([ex('a', 3), ex('plyo', 1, { isPlyo: true })], 'straight')
    expect(seq(steps)).toEqual(['0:a#3', '0:plyo#1'])
  })
})

describe('circuit round sequencing', () => {
  it('runs one set of each exercise per round in listed order', () => {
    const steps = buildGuidedSteps([ex('a', 3), ex('b', 3), ex('c', 3)], 'circuit')
    expect(seq(steps)).toEqual([
      '1:a#1', '1:b#1', '1:c#1',
      '2:a#2', '2:b#2', '2:c#2',
      '3:a#3', '3:b#3', '3:c#3',
    ])
    expect(totalRounds(steps)).toBe(3)
  })

  it('drops exercises with fewer sets out of later rounds', () => {
    const steps = buildGuidedSteps([ex('squat', 3), ex('side-plank', 2, { reps: undefined, holdSeconds: 30 }), ex('rdl', 4)], 'circuit')
    expect(seq(steps)).toEqual([
      '1:squat#1', '1:side-plank#1', '1:rdl#1',
      '2:squat#2', '2:side-plank#2', '2:rdl#2',
      '3:squat#3', '3:rdl#3',
      '4:rdl#4',
    ])
    expect(totalRounds(steps)).toBe(4)
  })

  it('uses the short rest within a round and the full rest between rounds', () => {
    const steps = buildGuidedSteps([ex('a', 2), ex('b', 2)], 'circuit')
    expect([0, 1, 2, 3].map((i) => restAfterStep(steps, i, 'circuit', 45, 20))).toEqual([20, 45, 20, 0])
  })

  it('treats a round-final drop-out correctly (rest after the last exercise still in the round)', () => {
    const steps = buildGuidedSteps([ex('a', 3), ex('b', 2)], 'circuit')
    // a1 b1 | a2 b2 | a3
    expect(steps.map((_, i) => restAfterStep(steps, i, 'circuit', 45, 20))).toEqual([20, 45, 20, 45, 0])
  })

  it('fits timed holds in the same structure — one hold is one set', () => {
    const b = pick(6, 'B')
    const steps = buildGuidedSteps(b.exercises!, 'circuit')
    const copenhagen = steps.filter((s) => s.exerciseId === 'copenhagen-short')
    expect(copenhagen.map((s) => s.round)).toEqual([1, 2, 3])
    const sidePlank = steps.filter((s) => s.exerciseId === 'side-plank')
    expect(sidePlank.map((s) => s.round)).toEqual([1, 2])
    expect(perSetDose(b.exercises!.find((e) => e.exerciseId === 'side-plank')!)).toBe('30 s/side')
  })
})

describe('plyo primer', () => {
  it('always runs first and in full, never rotated into rounds', () => {
    const a = pick(18, 'A')
    expect(a.exercises!.some((e) => e.isPlyo)).toBe(true)
    const steps = buildGuidedSteps(a.exercises!, 'circuit')
    expect(steps[0]).toMatchObject({ exerciseId: 'plyo-primer', isPrimer: true, round: 0 })
    expect(steps.filter((s) => s.exerciseId === 'plyo-primer')).toHaveLength(1)
    expect(steps.slice(1).every((s) => s.round >= 1)).toBe(true)
    // Primer → round 1 is a full rest, not the short circuit rest.
    expect(restAfterStep(steps, 0, 'circuit', 45, 20)).toBe(45)
  })

  it('is moved ahead of the circuit even when not listed first', () => {
    const steps = buildGuidedSteps([ex('a', 2), ex('plyo', 1, { isPlyo: true }), ex('b', 2)], 'circuit')
    expect(seq(steps)).toEqual(['0:plyo#1', '1:a#1', '1:b#1', '2:a#2', '2:b#2'])
  })

  it('per-set dose drops the sets prefix and labels bare counts as reps', () => {
    expect(perSetDose(ex('a', 3, { prescription: '3 × 15' }))).toBe('15 reps')
    expect(perSetDose(ex('a', 3, { prescription: '3 × 8–12 · incline if under 8' }))).toBe('8–12 reps · incline if under 8')
    expect(perSetDose(ex('a', 3, { prescription: '4 × 6/side · 2 s pause' }))).toBe('6/side · 2 s pause')
    expect(perSetDose(ex('a', 3, { prescription: '3 × max − 2 (or slow negatives)' }))).toBe('max − 2 (or slow negatives)')
    expect(perSetDose(ex('a', 1, { reps: undefined, holdSeconds: 45 }))).toBe('45 s hold')
  })

  it('shows the whole plyo prescription rather than a per-set slice', () => {
    const primer = pick(18, 'A').exercises!.find((e) => e.isPlyo)!
    expect(perSetDose(primer)).toBe(primer.prescription)
  })
})

describe('per-set checklist ticking', () => {
  const exercises = [ex('a', 3), ex('b', 2), ex('c', 1)]

  it('circuit: an exercise completes only when its last set is done', () => {
    const steps = buildGuidedSteps(exercises, 'circuit')
    // a1 b1 c1 | a2 b2 | a3
    const doneAfter = (n: number) => progressAfter(steps, n, 'circuit', exercises).completedExerciseIds
    expect(doneAfter(2)).toEqual([])
    expect(doneAfter(3)).toEqual(['c'])
    expect(doneAfter(5)).toEqual(['b', 'c'])
    expect(doneAfter(6)).toEqual(['a', 'b', 'c'])
    expect(completedSetsAfter(steps, 4)).toEqual({ a: 2, b: 1, c: 1 })
  })

  it('straight sets: each exercise completes as its step is done', () => {
    const steps = buildGuidedSteps(exercises, 'straight')
    const doneAfter = (n: number) => progressAfter(steps, n, 'straight', exercises).completedExerciseIds
    expect(doneAfter(0)).toEqual([])
    expect(doneAfter(1)).toEqual(['a'])
    expect(doneAfter(2)).toEqual(['a', 'b'])
    expect(isExerciseComplete(exercises[0], completedSetsAfter(steps, 1))).toBe(true)
  })
})

describe('resume', () => {
  const exercises = [ex('a', 3), ex('b', 2), ex('c', 3)]

  it('captures format, round and position mid-circuit and resumes exactly there', () => {
    const steps = buildGuidedSteps(exercises, 'circuit')
    // a1 b1 c1 | a2 b2 c2 | a3 c3 — kill after a2 (4 steps done)
    const progress = progressAfter(steps, 4, 'circuit', exercises)
    expect(progress).toMatchObject({ format: 'circuit', stepIndex: 4, round: 2, currentExerciseIndex: 1 })
    const resume = resolveResumePoint(exercises, progress, 'straight')
    expect(resume).toEqual({ format: 'circuit', stepIndex: 4 })
    expect(steps[resume.stepIndex]).toMatchObject({ exerciseId: 'b', setNumber: 2, round: 2 })
  })

  it('resumes in the saved format even if the default changed since', () => {
    const steps = buildGuidedSteps(exercises, 'straight')
    const progress = progressAfter(steps, 1, 'straight', exercises)
    expect(resolveResumePoint(exercises, progress, 'circuit')).toEqual({ format: 'straight', stepIndex: 1 })
  })

  it('uses the default format with no saved progress', () => {
    expect(resolveResumePoint(exercises, undefined, 'circuit')).toEqual({ format: 'circuit', stepIndex: 0 })
  })

  it('reads progress saved before circuit mode existed as straight sets', () => {
    const legacy = { currentExerciseIndex: 2, completedExerciseIds: ['a', 'b'] }
    expect(resolveResumePoint(exercises, legacy, 'circuit')).toEqual({ format: 'straight', stepIndex: 2 })
  })

  it('re-derives the position when the exercises changed after progress was saved', () => {
    const steps = buildGuidedSteps(exercises, 'circuit')
    const progress = progressAfter(steps, 4, 'circuit', exercises) // a:2 b:1 c:1
    const swapped = [ex('a', 3), ex('z', 2), ex('c', 3)]
    const resume = resolveResumePoint(swapped, progress, 'straight')
    const swappedSteps = buildGuidedSteps(swapped, 'circuit')
    // First undone set in order: z#1 in round 1.
    expect(swappedSteps[resume.stepIndex]).toMatchObject({ exerciseId: 'z', setNumber: 1 })
  })
})

describe('other session shapes', () => {
  it('injury-variant sessions sequence in both formats', () => {
    const variant = applyInjuryVariant(pick(18, 'A'), 'sore-knees-toe', '2026-01-01')
    const list = variant.exercises!
    expect(list.some((e) => e.isPlyo)).toBe(false)
    const circuit = buildGuidedSteps(list, 'circuit')
    expect(circuit).toHaveLength(list.reduce((n, e) => n + e.sets, 0))
    expect(buildGuidedSteps(list, 'straight')).toHaveLength(list.length)
    expect(progressAfter(circuit, circuit.length, 'circuit', list).completedExerciseIds).toHaveLength(list.length)
  })

  it('mobility-only sessions are a single round in circuit mode', () => {
    const list = buildMobilityOnlyExercises('A')
    const steps = buildGuidedSteps(list, 'circuit')
    expect(totalRounds(steps)).toBe(1)
    expect(steps.map((s) => s.exerciseId)).toEqual(list.map((e) => e.exerciseId))
    expect(restAfterStep(steps, 0, 'circuit', 45, 20)).toBe(20)
  })
})
