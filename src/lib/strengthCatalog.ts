// Static strength/mobility exercise catalog and phase-based progression tiers.
// No Dexie table needed — same pattern as SESSION_TIPS in sessionTips.ts.
// Equipment is a hard constraint: only a yoga mat, two 12.5kg dumbbells, a
// pull-up bar, and a chair/step/sofa (Copenhagens, step-downs, Nordic
// anchoring) are ever referenced.

import { BLOCK_EXERCISES } from './strengthCatalogBlocks'
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
    cues: [
      'Hold the dumbbell close to your chest, elbows pointing down.',
      'Keep your weight through mid-foot and heels, not up on your toes.',
      'Drive knees out in line with your toes as you descend.',
    ],
    commonMistake: 'Letting the knees cave inward and the chest fall forward on the way down.',
    easierVariation: 'Bodyweight squat, no dumbbell, hands out front for balance.',
    harderVariation: 'Pause 2 seconds at the bottom before standing.',
  },
  {
    id: 'single-leg-rdl',
    name: 'Single-leg RDL',
    targetArea: 'Hamstrings/balance',
    equipment: 'dumbbell',
    formCue: 'Hinge from the hip with a soft knee, keep the back flat, reach the free leg back.',
    cues: [
      'Keep hips square to the floor throughout the movement.',
      'Let the dumbbell travel straight down close to the standing leg.',
      'Brace the core to keep the standing knee soft but stable.',
    ],
    commonMistake: 'Rounding the lower back instead of hinging from the hip.',
    easierVariation: 'Lightly tap the back foot down for balance between reps, no dumbbell.',
    harderVariation: 'Hold a dumbbell in each hand.',
  },
  {
    id: 'single-leg-calf-raise',
    name: 'Single-leg calf raise',
    targetArea: 'Calves/ankle stability',
    equipment: 'bodyweight',
    formCue: 'Rise slowly onto the ball of the foot, pause, lower under control.',
    cues: [
      'Keep the standing leg straight, don\u2019t let the knee bend to cheat the range.',
      'Rise straight up rather than rolling onto the outside of the foot.',
      'Lower for a slow 2-3 count rather than dropping down.',
    ],
    commonMistake: 'Using momentum or a bent knee instead of a controlled full-range raise.',
    easierVariation: 'Two-leg calf raise, holding a wall or chair for balance.',
    harderVariation: 'Add a 1-second pause at the very top of each rep.',
  },
  {
    id: 'side-plank',
    name: 'Side plank (each side)',
    targetArea: 'Obliques/hip stability',
    equipment: 'mat',
    formCue: 'Stack hips and shoulders, keep the body in a straight line, don\u2019t let the hips sag.',
    cues: [
      'Stack feet, hips, and shoulders in one line.',
      'Push the floor away through the supporting forearm.',
      'Keep breathing steadily — don\u2019t hold your breath to brace.',
    ],
    commonMistake: 'Letting the hips drop toward the floor as fatigue sets in.',
    easierVariation: 'Bend the bottom knee to 90° so the shin is on the mat for extra support.',
    harderVariation: 'Lift the top leg a few inches while holding the plank.',
  },
  {
    id: 'hip-flexor-stretch',
    name: 'Half-kneeling hip flexor stretch',
    targetArea: 'Hip flexors',
    equipment: 'mat',
    formCue: 'Tuck the pelvis under and squeeze the glute of the back leg to deepen the stretch.',
    cues: [
      'Keep the front shin vertical, knee over ankle.',
      'Squeeze the glute of the back leg to tilt the pelvis under.',
      'Keep the torso tall rather than leaning forward.',
    ],
    commonMistake: 'Arching the lower back instead of tucking the pelvis, which stretches the wrong area.',
  },
  {
    id: 'couch-stretch',
    name: 'Couch stretch',
    targetArea: 'Quads/hip flexors',
    equipment: 'mat',
    formCue: 'Keep the hips square and driven forward, not just the knee bent.',
    cues: [
      'Rest the back shin against a wall or couch, foot pointing up.',
      'Squeeze the glute on the back leg and drive the hips forward.',
      'Keep the front knee at a comfortable right angle.',
    ],
    commonMistake: 'Letting the hips shift sideways instead of driving straight forward.',
    easierVariation: 'Move the back knee further from the wall to reduce the stretch depth.',
  },
  {
    id: 'ankle-rocks',
    name: 'Ankle rocks',
    targetArea: 'Ankle mobility',
    equipment: 'bodyweight',
    formCue: 'Rock the knee forward over the toes without letting the heel lift.',
    cues: [
      'Keep the heel planted flat on the floor throughout.',
      'Track the knee straight over the second/third toe, not caving inward.',
      'Move slowly and stop just before the heel wants to lift.',
    ],
    commonMistake: 'Letting the heel rise to fake extra range instead of stopping at true ankle mobility.',
  },
  // Session B — posterior chain/core
  {
    id: 'reverse-lunge',
    name: 'Dumbbell reverse lunge',
    targetArea: 'Glutes/quads',
    equipment: 'dumbbell',
    formCue: 'Step back to a soft touch of the back knee, drive through the front heel to stand.',
    cues: [
      'Keep the torso upright rather than leaning forward over the front knee.',
      'Step back far enough that the front shin stays close to vertical.',
      'Push through the front heel to return to standing.',
    ],
    commonMistake: 'Letting the front knee travel far past the toes, shifting load off the glutes.',
    easierVariation: 'Bodyweight only, hands on hips for balance.',
    harderVariation: 'Hold a dumbbell in each hand.',
  },
  {
    id: 'single-leg-glute-bridge',
    name: 'Single-leg glute bridge',
    targetArea: 'Glutes/hamstrings',
    equipment: 'mat',
    formCue: 'Drive through the heel of the planted foot, keep hips level throughout.',
    cues: [
      'Keep both hips level — don\u2019t let the free side dip or rotate.',
      'Drive through the heel, not the toes, of the planted foot.',
      'Squeeze the glute hard at the top rather than over-arching the back.',
    ],
    commonMistake: 'Overarching the lower back to gain height instead of squeezing the glute.',
    easierVariation: 'Two-leg glute bridge, both feet on the mat.',
    harderVariation: 'Add a 1-2 second pause at the top of each rep.',
  },
  {
    id: 'pull-ups',
    name: 'Pull-ups',
    targetArea: 'Back/biceps',
    equipment: 'pullup-bar',
    formCue: 'Use a slow negative or a dead-hang as an easier fallback if a full rep isn\u2019t there yet.',
    cues: [
      'Start from a full dead-hang with arms straight.',
      'Pull the elbows down and back, driving the chest toward the bar.',
      'Lower under control rather than dropping quickly.',
    ],
    commonMistake: 'Kipping or swinging the legs to generate momentum instead of pulling with the back.',
    easierVariation: 'Slow negatives (jump/step to the top, lower for a 3-5 count) or a dead-hang for time.',
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    targetArea: 'Core/anti-extension',
    equipment: 'mat',
    formCue: 'Press the low back into the mat, move opposite arm and leg slowly, keep breathing.',
    cues: [
      'Press the lower back flat into the mat and keep it there throughout.',
      'Move the opposite arm and leg slowly and in control.',
      'Exhale as you extend the arm and leg away from the body.',
    ],
    commonMistake: 'Letting the lower back arch off the mat as the leg lowers.',
    easierVariation: 'Only move the legs (arms stay overhead) or reduce how far the leg lowers.',
    harderVariation: 'Slow the tempo further, or hold a light weight overhead.',
  },
  {
    id: 'front-plank',
    name: 'Front plank',
    targetArea: 'Core',
    equipment: 'mat',
    formCue: 'Squeeze glutes and brace the core, keep a straight line from shoulders to heels.',
    cues: [
      'Keep a straight line from shoulders to heels — no sagging or piking.',
      'Squeeze glutes and brace the core rather than holding your breath.',
      'Keep shoulders stacked directly over elbows.',
    ],
    commonMistake: 'Letting the hips sag toward the floor as fatigue sets in.',
    easierVariation: 'Drop to the knees, keeping the same straight line from shoulders to knees.',
    harderVariation: 'Lift one foot a few inches off the mat, alternating sides.',
  },
  {
    id: 'hamstring-stretch',
    name: 'Hamstring stretch',
    targetArea: 'Hamstrings',
    equipment: 'mat',
    formCue: 'Hinge from the hips with a long spine rather than rounding the back.',
    cues: [
      'Keep the spine long — hinge from the hips, not the lower back.',
      'Keep a soft bend in the knee if the hamstring feels tight at the top.',
      'Breathe out slowly to ease deeper into the stretch.',
    ],
    commonMistake: 'Rounding the back to reach further instead of hinging from the hips.',
  },
  {
    id: 'thoracic-rotations',
    name: 'Thoracic rotations',
    targetArea: 'Upper back mobility',
    equipment: 'bodyweight',
    formCue: 'Keep the hips still and rotate from the rib cage, following the hand with your eyes.',
    cues: [
      'Keep the hips and lower back still — the rotation comes from the upper back.',
      'Follow the moving hand with your eyes to encourage full rotation.',
      'Move slowly rather than swinging into the end range.',
    ],
    commonMistake: 'Rotating from the hips instead of isolating the movement to the upper back.',
  },
  {
    id: 'calf-stretch',
    name: 'Calf stretch',
    targetArea: 'Calves',
    equipment: 'bodyweight',
    formCue: 'Keep the back heel grounded and the back leg straight, lean the hips forward.',
    cues: [
      'Keep the back leg straight and heel pressed into the floor.',
      'Point the back foot straight ahead, not turned outward.',
      'Lean the hips forward, keeping the back leg straight, until you feel the stretch.',
    ],
    commonMistake: 'Letting the back heel lift off the floor, which removes the stretch.',
    easierVariation: 'Bend the back knee slightly to reduce stretch intensity.',
  },
]

/** Every exercise the app can prescribe: the original A/B catalog plus the
 *  periodization blocks' additions. */
export const ALL_EXERCISES: StrengthExerciseCatalogEntry[] = [...STRENGTH_EXERCISES, ...BLOCK_EXERCISES]

const EXERCISE_BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]))

export function getCatalogEntry(exerciseId: string): StrengthExerciseCatalogEntry | undefined {
  return EXERCISE_BY_ID.get(exerciseId)
}

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
