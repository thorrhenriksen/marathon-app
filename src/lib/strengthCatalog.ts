// Static strength/mobility exercise catalog and phase-based progression tiers.
// No Dexie table needed — same pattern as SESSION_TIPS in sessionTips.ts.
// Equipment is a hard constraint: only a yoga mat, two 12.5kg dumbbells, and a
// pull-up bar are ever referenced.

import type { SessionExercise, StrengthExerciseCatalogEntry, StrengthVariant } from '../types'

export type StrengthTier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5'

export const STRENGTH_EXERCISES: StrengthExerciseCatalogEntry[] = [
  // Session A — lower body
  {
    id: 'goblet-squat',
    name: 'Goblet squat',
    targetArea: 'Quads/glutes',
    equipment: 'dumbbell',
    formCue: 'Sit hips back and down, chest tall, knees tracking over toes.',
  },
  {
    id: 'single-leg-rdl',
    name: 'Single-leg RDL',
    targetArea: 'Hamstrings/balance',
    equipment: 'dumbbell',
    formCue: 'Hinge from the hip with a soft knee, keep the back flat, reach the free leg back.',
  },
  {
    id: 'single-leg-calf-raise',
    name: 'Single-leg calf raise',
    targetArea: 'Calves/ankle stability',
    equipment: 'bodyweight',
    formCue: 'Rise slowly onto the ball of the foot, pause, lower under control.',
  },
  {
    id: 'side-plank',
    name: 'Side plank (each side)',
    targetArea: 'Obliques/hip stability',
    equipment: 'mat',
    formCue: 'Stack hips and shoulders, keep the body in a straight line, don\u2019t let the hips sag.',
  },
  {
    id: 'hip-flexor-stretch',
    name: 'Half-kneeling hip flexor stretch',
    targetArea: 'Hip flexors',
    equipment: 'mat',
    formCue: 'Tuck the pelvis under and squeeze the glute of the back leg to deepen the stretch.',
  },
  {
    id: 'couch-stretch',
    name: 'Couch stretch',
    targetArea: 'Quads/hip flexors',
    equipment: 'mat',
    formCue: 'Keep the hips square and driven forward, not just the knee bent.',
  },
  {
    id: 'ankle-rocks',
    name: 'Ankle rocks',
    targetArea: 'Ankle mobility',
    equipment: 'bodyweight',
    formCue: 'Rock the knee forward over the toes without letting the heel lift.',
  },
  // Session B — posterior chain/core
  {
    id: 'reverse-lunge',
    name: 'Dumbbell reverse lunge',
    targetArea: 'Glutes/quads',
    equipment: 'dumbbell',
    formCue: 'Step back to a soft touch of the back knee, drive through the front heel to stand.',
  },
  {
    id: 'single-leg-glute-bridge',
    name: 'Single-leg glute bridge',
    targetArea: 'Glutes/hamstrings',
    equipment: 'mat',
    formCue: 'Drive through the heel of the planted foot, keep hips level throughout.',
  },
  {
    id: 'pull-ups',
    name: 'Pull-ups',
    targetArea: 'Back/biceps',
    equipment: 'pullup-bar',
    formCue: 'Use a slow negative or a dead-hang as an easier fallback if a full rep isn\u2019t there yet.',
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    targetArea: 'Core/anti-extension',
    equipment: 'mat',
    formCue: 'Press the low back into the mat, move opposite arm and leg slowly, keep breathing.',
  },
  {
    id: 'front-plank',
    name: 'Front plank',
    targetArea: 'Core',
    equipment: 'mat',
    formCue: 'Squeeze glutes and brace the core, keep a straight line from shoulders to heels.',
  },
  {
    id: 'hamstring-stretch',
    name: 'Hamstring stretch',
    targetArea: 'Hamstrings',
    equipment: 'mat',
    formCue: 'Hinge from the hips with a long spine rather than rounding the back.',
  },
  {
    id: 'thoracic-rotations',
    name: 'Thoracic rotations',
    targetArea: 'Upper back mobility',
    equipment: 'bodyweight',
    formCue: 'Keep the hips still and rotate from the rib cage, following the hand with your eyes.',
  },
  {
    id: 'calf-stretch',
    name: 'Calf stretch',
    targetArea: 'Calves',
    equipment: 'bodyweight',
    formCue: 'Keep the back heel grounded and the back leg straight, lean the hips forward.',
  },
]

const EXERCISE_BY_ID = new Map(STRENGTH_EXERCISES.map((e) => [e.id, e]))

const SESSION_A_MAIN_IDS = ['goblet-squat', 'single-leg-rdl', 'single-leg-calf-raise', 'side-plank']
const SESSION_A_MOBILITY_IDS = ['hip-flexor-stretch', 'couch-stretch', 'ankle-rocks']
const SESSION_B_MAIN_IDS = ['reverse-lunge', 'single-leg-glute-bridge', 'pull-ups', 'dead-bug', 'front-plank']
const SESSION_B_MOBILITY_IDS = ['hamstring-stretch', 'thoracic-rotations', 'calf-stretch']

const HOLD_BASED_IDS = new Set(['side-plank', 'front-plank'])
const DUMBBELL_ELIGIBLE_IDS = new Set(['goblet-squat', 'single-leg-rdl', 'reverse-lunge'])

interface TierConfig {
  mainSets: number
  mainReps: number
  mainHoldSeconds: number
  useDumbbell: boolean
  estimatedMinutes: number
}

const TIER_CONFIG: Record<StrengthTier, TierConfig> = {
  T1: { mainSets: 2, mainReps: 8, mainHoldSeconds: 20, useDumbbell: false, estimatedMinutes: 20 },
  T2: { mainSets: 3, mainReps: 10, mainHoldSeconds: 30, useDumbbell: false, estimatedMinutes: 25 },
  T3: { mainSets: 3, mainReps: 10, mainHoldSeconds: 30, useDumbbell: true, estimatedMinutes: 25 },
  T4: { mainSets: 3, mainReps: 12, mainHoldSeconds: 40, useDumbbell: true, estimatedMinutes: 25 },
  T5: { mainSets: 2, mainReps: 8, mainHoldSeconds: 20, useDumbbell: false, estimatedMinutes: 20 },
}

const MOBILITY_HOLD_SECONDS = 30

export function tierForWeek(week: number): StrengthTier {
  if (week <= 8) return 'T1'
  if (week <= 14) return 'T2'
  if (week <= 20) return 'T3'
  if (week <= 33) return 'T4'
  return 'T5'
}

export function estimatedMinutesForTier(tier: StrengthTier): number {
  return TIER_CONFIG[tier].estimatedMinutes
}

function buildMainExercise(id: string, tier: StrengthTier): SessionExercise {
  const entry = EXERCISE_BY_ID.get(id)
  if (!entry) throw new Error(`Unknown strength exercise id: ${id}`)
  const config = TIER_CONFIG[tier]
  const formCue =
    DUMBBELL_ELIGIBLE_IDS.has(id) && config.useDumbbell
      ? `${entry.formCue} Hold a dumbbell in each hand.`
      : entry.formCue
  const holdBased = HOLD_BASED_IDS.has(id)
  return {
    exerciseId: entry.id,
    name: entry.name,
    sets: config.mainSets,
    reps: holdBased ? undefined : config.mainReps,
    holdSeconds: holdBased ? config.mainHoldSeconds : undefined,
    formCue,
    completed: false,
  }
}

function buildMobilityExercise(id: string): SessionExercise {
  const entry = EXERCISE_BY_ID.get(id)
  if (!entry) throw new Error(`Unknown strength exercise id: ${id}`)
  return {
    exerciseId: entry.id,
    name: entry.name,
    sets: 1,
    holdSeconds: MOBILITY_HOLD_SECONDS,
    formCue: entry.formCue,
    completed: false,
  }
}

export function buildSessionExercises(variant: StrengthVariant, tier: StrengthTier): SessionExercise[] {
  const mainIds = variant === 'A' ? SESSION_A_MAIN_IDS : SESSION_B_MAIN_IDS
  const mobilityIds = variant === 'A' ? SESSION_A_MOBILITY_IDS : SESSION_B_MOBILITY_IDS
  return [...mainIds.map((id) => buildMainExercise(id, tier)), ...mobilityIds.map(buildMobilityExercise)]
}

export function buildMobilityOnlyExercises(variant: StrengthVariant): SessionExercise[] {
  const mobilityIds = variant === 'A' ? SESSION_A_MOBILITY_IDS : SESSION_B_MOBILITY_IDS
  return mobilityIds.map(buildMobilityExercise)
}

export const MOBILITY_ONLY_ESTIMATED_MINUTES = 5
