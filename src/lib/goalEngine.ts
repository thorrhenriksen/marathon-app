// Goal engine: current fitness vs A/B goals, and the gates that "earn" the
// faster target. Non-negotiable principle: training paces derive from
// current fitness, never from the goal. The A goal only moves race-day
// pacing, goal references, and gate targets — and MP sessions only once the
// gates are passed.

import { addDays } from './dates'
import { computeCurrentFitness, type CurrentFitness } from './fitness'
import {
  equivalentTimeSeconds,
  trainingPacesForVdot,
  vdotFromPerformance,
  HALF_MARATHON_M,
  MARATHON_M,
} from './vdot'
import type { FitnessTest, Goal, PaceZones, Run, Session, WeekMeta } from '../types'

export const DEFAULT_A_GOAL_SECONDS = 3 * 3600 + 25 * 60
/** Used only when there is no fitness evidence at all yet: a deliberately
 *  modest 4:30 marathon-equivalent, so first paces err easy. */
export const PROVISIONAL_MARATHON_SECONDS = 4 * 3600 + 30 * 60

export function marathonVdot(marathonSeconds: number): number {
  return vdotFromPerformance(MARATHON_M, marathonSeconds)
}

/** B-goal suggestion: current fitness's marathon equivalent, rounded up to the minute. */
export function suggestBGoalSeconds(currentVdot: number): number {
  return Math.ceil(equivalentTimeSeconds(currentVdot, MARATHON_M) / 60) * 60
}

export interface ResolvedGoals {
  aSeconds: number
  bSeconds: number
  bAuto: boolean
  aVdot: number
  bVdot: number
}

export function resolveGoals(goal: Goal | undefined, currentVdot: number): ResolvedGoals {
  const aSeconds = goal?.aGoalSeconds ?? goal?.targetTimeSeconds ?? DEFAULT_A_GOAL_SECONDS
  const bAuto = goal?.bGoalSeconds === undefined
  const bSeconds = goal?.bGoalSeconds ?? suggestBGoalSeconds(currentVdot)
  return { aSeconds, bSeconds, bAuto, aVdot: marathonVdot(aSeconds), bVdot: marathonVdot(bSeconds) }
}

// --- Gap -------------------------------------------------------------------

export type GapLevel = 'none' | 'stretch' | 'acknowledge' | 'aspirational'

export function classifyGap(aVdot: number, currentVdot: number): GapLevel {
  const gap = aVdot - currentVdot
  if (gap <= 1) return 'none'
  if (gap <= 3) return 'stretch'
  if (gap <= 5) return 'acknowledge'
  return 'aspirational'
}

// --- Gates -----------------------------------------------------------------

export type CriterionStatus = 'pending' | 'passed' | 'failed'

export interface RaceGate {
  id: 'gate-10k' | 'gate-half'
  label: string
  weeks: [number, number]
  targetSeconds: number
  status: CriterionStatus
  result?: { date: string; distanceKm: number; durationSeconds: number }
  /** Marathon goal the actual result supports — offered on failure. */
  recommendedGoalSeconds?: number
}

export interface GateCriterion {
  id: 'volume-8wk' | 'no-injury-3wk'
  label: string
  status: CriterionStatus
  detail: string
}

export interface GateStatus {
  gates: RaceGate[]
  criteria: GateCriterion[]
  /** All gates and criteria passed → A-goal pace unlocked for MP + race day. */
  unlocked: boolean
}

export const GATE_10K_WEEKS: [number, number] = [22, 24]
export const GATE_HALF_WEEKS: [number, number] = [27, 29]
const VOLUME_ADHERENCE_WEEKS = 8
const VOLUME_ADHERENCE_MIN = 0.9
const INJURY_LOOKBACK_DAYS = 21

/** Gate 1: the A goal's VDOT-equivalent 10K (44:25-ish for 3:25). */
export function tenKGateTarget(aSeconds: number): number {
  return Math.round(equivalentTimeSeconds(marathonVdot(aSeconds), 10000))
}

/** Gate 2: deliberately ~1 min faster than the table half equivalent (first
 *  marathoners underperform the conversion), floored to the minute —
 *  1:37:00 for a 3:25 goal. */
export function halfGateTarget(aSeconds: number): number {
  const equivalent = equivalentTimeSeconds(marathonVdot(aSeconds), HALF_MARATHON_M)
  return Math.floor((equivalent - 60) / 60) * 60
}

interface RaceResult {
  date: string
  distanceKm: number
  durationSeconds: number
}

function raceResults(runs: Run[], tests: FitnessTest[]): RaceResult[] {
  return [
    ...runs.filter((r) => r.type === 'race').map((r) => ({ date: r.date, distanceKm: r.distanceKm, durationSeconds: r.durationSeconds })),
    ...tests.map((t) => ({ date: t.date, distanceKm: t.distanceKm, durationSeconds: t.durationSeconds })),
  ]
}

function weekRange(weeks: WeekMeta[], [from, to]: [number, number]): { start: string; end: string } | undefined {
  const first = weeks.find((w) => w.week === from)
  const last = weeks.find((w) => w.week === to)
  if (!first || !last) return undefined
  return { start: first.startDate, end: addDays(last.startDate, 6) }
}

function evaluateRaceGate(
  id: RaceGate['id'],
  label: string,
  gateWeeks: [number, number],
  distanceRangeKm: [number, number],
  targetSeconds: number,
  results: RaceResult[],
  weeks: WeekMeta[],
  today: string,
): RaceGate {
  const range = weekRange(weeks, gateWeeks)
  const candidates = range
    ? results.filter(
        (r) =>
          r.date >= range.start &&
          r.date <= range.end &&
          r.distanceKm >= distanceRangeKm[0] &&
          r.distanceKm <= distanceRangeKm[1],
      )
    : []
  // Normalise each result to the nominal distance so a 10.2 km course is fair.
  const nominalMeters = id === 'gate-10k' ? 10000 : HALF_MARATHON_M
  const scored = candidates.map((r) => {
    const vdot = vdotFromPerformance(r.distanceKm * 1000, r.durationSeconds)
    return { r, vdot, normalised: equivalentTimeSeconds(vdot, nominalMeters) }
  })
  const bestResult = scored.reduce<(typeof scored)[number] | undefined>((b, s) => (!b || s.vdot > b.vdot ? s : b), undefined)

  if (!bestResult) {
    return { id, label, weeks: gateWeeks, targetSeconds, status: range && today > range.end ? 'failed' : 'pending' }
  }
  const passed = bestResult.normalised <= targetSeconds
  return {
    id,
    label,
    weeks: gateWeeks,
    targetSeconds,
    status: passed ? 'passed' : 'failed',
    result: bestResult.r,
    recommendedGoalSeconds: passed ? undefined : suggestBGoalSeconds(bestResult.vdot),
  }
}

export function computeVolumeAdherence(weeks: WeekMeta[], runs: Run[], today: string): { ratio: number; weeksCounted: number } {
  const elapsed = weeks
    .filter((w) => addDays(w.startDate, 6) < today)
    .sort((a, b) => b.week - a.week)
    .slice(0, VOLUME_ADHERENCE_WEEKS)
  const planned = elapsed.reduce((sum, w) => sum + w.targetVolumeKm, 0)
  const actual = elapsed.reduce((sum, w) => {
    const end = addDays(w.startDate, 6)
    return sum + runs.filter((r) => r.date >= w.startDate && r.date <= end).reduce((s, r) => s + r.distanceKm, 0)
  }, 0)
  return { ratio: planned > 0 ? actual / planned : 0, weeksCounted: elapsed.length }
}

export function injuryVariantsInLookback(sessions: Session[], today: string): Session[] {
  const from = addDays(today, -(INJURY_LOOKBACK_DAYS - 1))
  return sessions.filter((s) => s.injuryVariant && s.date >= from && s.date <= today)
}

export interface GateInputs {
  aSeconds: number
  weeks: WeekMeta[]
  sessions: Session[]
  runs: Run[]
  tests: FitnessTest[]
  today: string
}

export function evaluateGates({ aSeconds, weeks, sessions, runs, tests, today }: GateInputs): GateStatus {
  const results = raceResults(runs, tests)
  const gates: RaceGate[] = [
    evaluateRaceGate('gate-10k', '10K race or time trial', GATE_10K_WEEKS, [9.8, 10.4], tenKGateTarget(aSeconds), results, weeks, today),
    evaluateRaceGate('gate-half', 'Half marathon', GATE_HALF_WEEKS, [20.9, 21.5], halfGateTarget(aSeconds), results, weeks, today),
  ]

  const volume = computeVolumeAdherence(weeks, runs, today)
  const volumePct = Math.round(volume.ratio * 100)
  const volumeStatus: CriterionStatus =
    volume.weeksCounted < VOLUME_ADHERENCE_WEEKS ? 'pending' : volume.ratio >= VOLUME_ADHERENCE_MIN ? 'passed' : 'failed'

  const injuries = injuryVariantsInLookback(sessions, today)

  const criteria: GateCriterion[] = [
    {
      id: 'volume-8wk',
      label: '≥90% volume over the last 8 weeks',
      status: volumeStatus,
      detail:
        volume.weeksCounted < VOLUME_ADHERENCE_WEEKS
          ? `${volumePct}% so far (${volume.weeksCounted}/8 weeks elapsed)`
          : `${volumePct}% of planned km`,
    },
    {
      id: 'no-injury-3wk',
      label: 'No injury-variant sessions in the last 3 weeks',
      status: injuries.length === 0 ? 'passed' : 'failed',
      detail: injuries.length === 0 ? 'None used' : `${injuries.length} used recently`,
    },
  ]

  const unlocked = gates.every((g) => g.status === 'passed') && criteria.every((c) => c.status === 'passed')
  return { gates, criteria, unlocked }
}

// --- Training zones ----------------------------------------------------------

/** Every pace in the app comes from here. Easy/long/tempo always follow
 *  current fitness. MP sessions follow current fitness until the gates
 *  unlock the A goal. Race-day pacing is the B goal until then. */
export function computeTrainingZones(currentVdot: number, goals: ResolvedGoals, unlocked: boolean): PaceZones {
  const paces = trainingPacesForVdot(currentVdot)
  const raceGoalTimeSeconds = unlocked ? goals.aSeconds : goals.bSeconds
  return {
    marathonPaceSecPerKm: unlocked ? goals.aSeconds / (MARATHON_M / 1000) : paces.marathonSecPerKm,
    easyPaceMinSecPerKm: paces.easyFastSecPerKm,
    easyPaceMaxSecPerKm: paces.easySlowSecPerKm,
    tempoPaceMinSecPerKm: paces.thresholdFastSecPerKm,
    tempoPaceMaxSecPerKm: paces.thresholdSlowSecPerKm,
    raceGoalTimeSeconds,
    raceDayPaceSecPerKm: raceGoalTimeSeconds / (MARATHON_M / 1000),
    halfMarathonPaceSecPerKm: equivalentTimeSeconds(currentVdot, HALF_MARATHON_M) / (HALF_MARATHON_M / 1000),
  }
}

// --- Easy runs running hot -----------------------------------------------

const HOT_LOOKBACK_DAYS = 28
const HOT_MIN_RUNS = 3
const HOT_FRACTION = 0.75

/** True when most recent easy runs are faster than the fast end of the easy
 *  band — a gentle Progress-tab note, never a per-run nag. */
export function easyRunsRunningHot(runs: Run[], zones: PaceZones, today: string): { hot: boolean; hotCount: number; total: number } {
  const from = addDays(today, -(HOT_LOOKBACK_DAYS - 1))
  const easy = runs.filter((r) => r.type === 'easy' && r.paceSecPerKm > 0 && r.date >= from && r.date <= today)
  const hotCount = easy.filter((r) => r.paceSecPerKm < zones.easyPaceMinSecPerKm).length
  return { hot: easy.length >= HOT_MIN_RUNS && hotCount / easy.length >= HOT_FRACTION, hotCount, total: easy.length }
}

// --- One-stop state ------------------------------------------------------

export interface GoalEngineState {
  fitness: CurrentFitness | undefined
  /** fitness.vdot, or the provisional value when there's no evidence yet. */
  currentVdot: number
  provisional: boolean
  goals: ResolvedGoals
  gap: GapLevel
  gapVdot: number
  gateStatus: GateStatus
  zones: PaceZones
}

export function computeGoalEngineState(input: {
  goal: Goal | undefined
  runs: Run[]
  sessions: Session[]
  weeks: WeekMeta[]
  today: string
}): GoalEngineState {
  const tests = input.goal?.fitnessTests ?? []
  const fitness = computeCurrentFitness(input.runs, tests, input.today)
  const currentVdot = fitness?.vdot ?? marathonVdot(PROVISIONAL_MARATHON_SECONDS)
  const goals = resolveGoals(input.goal, currentVdot)
  const gateStatus = evaluateGates({
    aSeconds: goals.aSeconds,
    weeks: input.weeks,
    sessions: input.sessions,
    runs: input.runs,
    tests,
    today: input.today,
  })
  return {
    fitness,
    currentVdot,
    provisional: !fitness,
    goals,
    gap: classifyGap(goals.aVdot, currentVdot),
    gapVdot: goals.aVdot - currentVdot,
    gateStatus,
    zones: computeTrainingZones(currentVdot, goals, gateStatus.unlocked),
  }
}
