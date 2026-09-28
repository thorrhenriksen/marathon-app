import { describe, it, expect } from 'vitest'
import { applyInjuryVariant, restoreNormalStrength, substituteExercises } from './injuryVariants'
import { generateStrengthSessions } from './strengthSchedule'
import type { Session } from '../types'

const all = generateStrengthSessions()
const pick = (week: number, variant: 'A' | 'B') =>
  all.find((s) => s.week === week && s.variant === variant && !/mobility only/.test(s.description))!
const ids = (list: { exerciseId: string }[]) => list.map((e) => e.exerciseId)

describe('sore knees', () => {
  it('block 1 A: squat → wall sit, hinge kept bilateral soft-knee, calf/push/core kept', () => {
    const out = substituteExercises(pick(6, 'A').exercises!, 'sore-knees')
    expect(ids(out)).toEqual(['wall-sit', 'db-rdl', 'seated-soleus-raise', 'push-up', 'dead-bug', 'side-lying-hip-abduction'])
    expect(out[0].prescription).toBe('5 × 30–45 s · ~45° knee bend')
    expect(out[1].prescription).toMatch(/soft knee/)
  })

  it('block 3 B: step → abduction + clamshells, SL RDL → bilateral RDL, Nordic → SL bridge, long → short Copenhagen', () => {
    const out = substituteExercises(pick(18, 'B').exercises!, 'sore-knees')
    expect(ids(out)).toEqual(['hip-abduction-clamshell', 'db-rdl', 'single-leg-glute-bridge', 'pull-ups', 'copenhagen-short', 'side-plank'])
  })

  it('drops plyos', () => {
    expect(substituteExercises(pick(18, 'A').exercises!, 'sore-knees').some((e) => e.isPlyo)).toBe(false)
  })
})

describe('sore toe', () => {
  it('block 3 A: no plyos, knee push-ups, knee plank, half-height seated calf raise, hinge kept', () => {
    const out = substituteExercises(pick(18, 'A').exercises!, 'sore-toe')
    expect(ids(out)).toEqual(['rfess-pause', 'db-rdl', 'seated-calf-raise-half', 'knee-push-up', 'plank-knees'])
    expect(out[0].prescription).toMatch(/rear foot laces-down/)
  })

  it('block 2 B: keeps pull-ups and hinge, Nordics laces-down only, side plank from knees', () => {
    const out = substituteExercises(pick(12, 'B').exercises!, 'sore-toe')
    expect(ids(out)).toEqual(['step-up', 'single-leg-rdl', 'nordic-curl', 'pull-ups', 'copenhagen-long', 'side-plank-knees'])
    expect(out.find((e) => e.exerciseId === 'nordic-curl')!.prescription).toMatch(/laces-down anchoring/)
    expect(out.find((e) => e.exerciseId === 'step-up')!.prescription).toMatch(/flat foot/)
  })
})

describe('sore knees + toe (union)', () => {
  it('block 1 A', () => {
    const out = substituteExercises(pick(6, 'A').exercises!, 'sore-knees-toe')
    expect(ids(out)).toEqual(['wall-sit', 'db-rdl', 'seated-calf-raise-half', 'knee-push-up', 'dead-bug', 'side-lying-hip-abduction'])
  })

  it('block 1 B', () => {
    const out = substituteExercises(pick(6, 'B').exercises!, 'sore-knees-toe')
    expect(ids(out)).toEqual(['hip-abduction-clamshell', 'single-leg-glute-bridge', 'pull-ups', 'copenhagen-short', 'seated-calf-raise-half', 'side-plank-knees'])
  })

  it('block 4 B: long Copenhagen → short lever, Nordic → bridge, no toe-loading', () => {
    const out = substituteExercises(pick(24, 'B').exercises!, 'sore-knees-toe')
    expect(ids(out)).toEqual(['hip-abduction-clamshell', 'db-rdl', 'single-leg-glute-bridge', 'weighted-pull-up', 'copenhagen-short', 'side-plank-knees'])
  })
})

describe('applyInjuryVariant', () => {
  const session: Session = { ...pick(6, 'A') }

  it('marks today/past sessions handled and future ones still planned', () => {
    expect(applyInjuryVariant(session, 'sore-toe', session.date).status).toBe('handled')
    expect(applyInjuryVariant(session, 'sore-toe', '2026-09-01').status).toBe('planned')
  })

  it('never stacks variants — switching restarts from the block list', () => {
    const knees = applyInjuryVariant(session, 'sore-knees', '2026-09-01')
    const thenToe = applyInjuryVariant(knees, 'sore-toe', '2026-09-01')
    const directToe = applyInjuryVariant(session, 'sore-toe', '2026-09-01')
    expect(ids(thenToe.exercises!)).toEqual(ids(directToe.exercises!))
    expect(thenToe.description).toBe(directToe.description)
    expect(thenToe.description).toMatch(/Sore toe variant$/)
    expect(thenToe.injuryVariant).toBe('sore-toe')
  })

  it('keeps a moved future session moved', () => {
    const moved = { ...session, status: 'moved' as const, originalDate: session.date }
    expect(applyInjuryVariant(moved, 'sore-knees', '2026-09-01').status).toBe('moved')
  })
})

describe('restoreNormalStrength', () => {
  it('undoes a variant back to the block session', () => {
    const original = pick(6, 'B')
    const variant = applyInjuryVariant(original, 'sore-knees-toe', original.date)
    const restored = restoreNormalStrength(variant)
    expect(restored.injuryVariant).toBeUndefined()
    expect(restored.status).toBe('planned')
    expect(ids(restored.exercises!)).toEqual(ids(original.exercises!))
    expect(restored.description).toBe(original.description)
  })
})
