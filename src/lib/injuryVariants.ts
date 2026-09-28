// Injury-variant substitutions for strength sessions ("Change" menu). Each
// variant rewrites the session's current block exercises slot by slot:
//
// Sore knees — squat → shallow wall sit; hinge → bilateral DB RDL, soft knee;
//   step/lunge → hip abduction + clamshells; hamstring → single-leg glute
//   bridge; no plyos; Copenhagen → short lever; calf, push, pull, core kept.
// Sore toe — no toes-tucked or toe-extension loading: knee push-ups, planks
//   from the knees with feet relaxed, half-height seated calf raises, flat
//   foot / laces-down for split-squat and step work, Nordics only with
//   laces-down anchoring, no plyos; pull-ups, hinge, core kept.
// Sore knees + toe — the union of both.
//
// A variant session is "handled" (never red) when applied on or after its
// day; applied ahead of time it stays planned with the substituted list.

import { estimateMinutes, toSessionExercise, type SlotPrescription } from './strengthBlocks'
import { rebuildPlannedStrength } from './strengthSchedule'
import type { InjuryVariant, Session, SessionExercise } from '../types'

export const INJURY_VARIANT_LABELS: Record<InjuryVariant, string> = {
  'sore-knees': 'Sore knees',
  'sore-toe': 'Sore toe',
  'sore-knees-toe': 'Sore knees + toe',
}

function affects(variant: InjuryVariant): { knees: boolean; toe: boolean } {
  return { knees: variant !== 'sore-toe', toe: variant !== 'sore-knees' }
}

/** Swap to a different catalog exercise, keeping the slot's set count. */
function swap(e: SessionExercise, p: Omit<SlotPrescription, 'slot' | 'sets'> & { sets?: number }): SessionExercise {
  return toSessionExercise({ slot: e.slot ?? 'core', sets: p.sets ?? e.sets, ...p })
}

function withNote(e: SessionExercise, note: string): SessionExercise {
  const base = e.prescription ?? `${e.sets} × ${e.reps ?? `${e.holdSeconds} s`}`
  return { ...e, prescription: `${base} · ${note}` }
}

function substitute(e: SessionExercise, variant: InjuryVariant): SessionExercise[] {
  const { knees, toe } = affects(variant)
  const id = e.exerciseId

  if (e.isPlyo || e.slot === 'plyo') return []

  switch (e.slot) {
    case 'squat':
      if (knees) return [swap(e, { id: 'wall-sit', sets: 5, holdSeconds: [30, 45], note: '~45° knee bend' })]
      return [withNote(e, 'flat front foot, rear foot laces-down')]
    case 'hinge':
      if (knees) return [swap(e, { id: 'db-rdl', reps: 10, note: 'bilateral, soft knee' })]
      return [e]
    case 'step':
      if (knees) return [swap(e, { id: 'hip-abduction-clamshell', sets: 3, reps: 15, perSide: true })]
      return [withNote(e, 'flat foot throughout')]
    case 'hamstring':
      if (knees) return [swap(e, { id: 'single-leg-glute-bridge', reps: 10, perSide: true })]
      if (id === 'nordic-curl') return [withNote(e, 'laces-down anchoring only')]
      return [e]
    case 'adductor':
      if (knees && id === 'copenhagen-long') return [swap(e, { id: 'copenhagen-short', holdSeconds: [15, 20], perSide: true })]
      return [e]
    case 'calf':
      if (toe) return [swap(e, { id: 'seated-calf-raise-half', reps: 15 })]
      return [e]
    case 'push':
      if (toe) return [swap(e, { id: 'knee-push-up', reps: [8, 12] })]
      return [e]
    case 'core':
    case 'activation':
      if (toe && (id === 'side-plank')) return [swap(e, { id: 'side-plank-knees', holdSeconds: 30, perSide: true })]
      if (toe && (id === 'body-saw' || id === 'front-plank')) return [swap(e, { id: 'plank-knees', holdSeconds: 30 })]
      if (toe && id === 'double-leg-calf-raise') return [swap(e, { id: 'seated-calf-raise-half', reps: 12 })]
      return [e]
    default:
      return [e]
  }
}

/** Substituted exercise list for a variant, deduplicated by exercise id. */
export function substituteExercises(exercises: SessionExercise[], variant: InjuryVariant): SessionExercise[] {
  const out: SessionExercise[] = []
  for (const e of exercises) {
    for (const s of substitute(e, variant)) {
      if (!out.some((o) => o.exerciseId === s.exerciseId)) out.push({ ...s, completed: false })
    }
  }
  return out
}

function stripVariantSuffix(description: string): string {
  return description.replace(/ · (Sore knees \+ toe|Sore knees|Sore toe) variant$/, '')
}

/** Applies an injury variant to a strength session, always starting from the
 *  block's original exercises so variants never stack. */
export function applyInjuryVariant(session: Session, variant: InjuryVariant, today: string): Session {
  const canonical = rebuildPlannedStrength(session.week, session.variant)
  const baseExercises = session.injuryVariant && canonical?.exercises ? canonical.exercises : (session.exercises ?? [])
  const baseDescription = stripVariantSuffix(session.injuryVariant && canonical ? canonical.description : session.description)
  const exercises = substituteExercises(baseExercises, variant)
  return {
    ...session,
    exercises,
    estimatedMinutes: estimateMinutes(exercises),
    description: `${baseDescription} · ${INJURY_VARIANT_LABELS[variant]} variant`,
    injuryVariant: variant,
    // Ahead of time it stays a plan (a moved session stays moved).
    status: session.date <= today ? 'handled' : session.status,
  }
}

/** Back to the block's normal session (undoing a variant or mobility-only
 *  swap). A 'handled'/'downgraded' outcome returns to 'planned'; other
 *  statuses (e.g. moved) are kept. */
export function restoreNormalStrength(session: Session): Session {
  const canonical = rebuildPlannedStrength(session.week, session.variant)
  if (!canonical) return session
  const { injuryVariant: _injuryVariant, ...rest } = session
  const status = session.status === 'handled' || session.status === 'downgraded-to-mobility' ? 'planned' : session.status
  return { ...rest, ...canonical, status }
}
