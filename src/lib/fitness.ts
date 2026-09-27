// Current fitness: a single VDOT value derived from logged evidence — never
// from the goal. This is the one source of truth for every training pace,
// the race predictor, and on-track status.
//
// Derivation walks day by day from the first piece of evidence to today:
//   • Races and time trials (entered directly, or logged runs typed 'race')
//     set fitness to their VDOT on the day they happen — uncapped.
//   • Otherwise the target is the best evidence in the trailing 6 weeks
//     (training runs ≥3 km, plus any race/test still in the window).
//     Fitness rises toward it by at most +1 VDOT per 4 weeks, so a single
//     fast training day can't rewrite every pace; it falls to it directly
//     (conservative: if recent evidence is weaker, paces ease off).
//   • The first 6 weeks of evidence seed the value uncapped, so the starting
//     point reflects the best early run rather than the very first one.
// Nothing is stored — the same inputs always give the same value.

import { addDays, daysBetween } from './dates'
import { vdotFromPerformance } from './vdot'
import type { FitnessTest, Run } from '../types'

const MIN_QUALITY_KM = 3
const WINDOW_DAYS = 42
const MAX_DAILY_GAIN = 1 / 28
// Plausibility bounds: outside these a result is almost certainly a
// mistyped distance or time (VDOT 85 is beyond the world record).
const MIN_PLAUSIBLE_VDOT = 15
const MAX_PLAUSIBLE_VDOT = 85

export interface FitnessEvidence {
  kind: 'run' | 'race' | 'time-trial'
  date: string
  distanceKm: number
  durationSeconds: number
  vdot: number
  runId?: string
}

export interface CurrentFitness {
  vdot: number
  /** The evidence the value currently rests on. */
  source: FitnessEvidence
  /** VDOT the trailing-window evidence would give without the growth cap. */
  uncappedVdot: number
  /** True while the cap is holding fitness below the evidence. */
  capped: boolean
}

function toEvidence(runs: Run[], tests: FitnessTest[]): FitnessEvidence[] {
  const fromRuns: FitnessEvidence[] = runs
    .filter((r) => r.distanceKm >= MIN_QUALITY_KM && r.durationSeconds > 0)
    .map((r) => ({
      kind: r.type === 'race' ? 'race' : 'run',
      date: r.date,
      distanceKm: r.distanceKm,
      durationSeconds: r.durationSeconds,
      vdot: vdotFromPerformance(r.distanceKm * 1000, r.durationSeconds),
      runId: r.id,
    }))
  const fromTests: FitnessEvidence[] = tests
    .filter((t) => t.distanceKm > 0 && t.durationSeconds > 0)
    .map((t) => ({
      kind: t.kind,
      date: t.date,
      distanceKm: t.distanceKm,
      durationSeconds: t.durationSeconds,
      vdot: vdotFromPerformance(t.distanceKm * 1000, t.durationSeconds),
    }))
  return [...fromRuns, ...fromTests].filter(
    (e) => Number.isFinite(e.vdot) && e.vdot >= MIN_PLAUSIBLE_VDOT && e.vdot <= MAX_PLAUSIBLE_VDOT,
  )
}

function best(evidence: FitnessEvidence[]): FitnessEvidence | undefined {
  return evidence.reduce<FitnessEvidence | undefined>((b, e) => (!b || e.vdot > b.vdot ? e : b), undefined)
}

export function computeCurrentFitness(runs: Run[], tests: FitnessTest[], today: string): CurrentFitness | undefined {
  const evidence = toEvidence(runs, tests).filter((e) => e.date <= today)
  if (evidence.length === 0) return undefined

  const firstDate = evidence.reduce((d, e) => (e.date < d ? e.date : d), evidence[0].date)
  const seedEnd = addDays(firstDate, WINDOW_DAYS - 1)

  let value: number | undefined
  let source: FitnessEvidence | undefined
  let uncapped = 0

  for (let day = firstDate; day <= today; day = addDays(day, 1)) {
    const windowStart = addDays(day, -(WINDOW_DAYS - 1))
    const inWindow = evidence.filter((e) => e.date >= windowStart && e.date <= day)
    const target = best(inWindow)
    const racesToday = evidence.filter((e) => e.date === day && e.kind !== 'run')
    const raceToday = best(racesToday)

    if (raceToday) {
      value = raceToday.vdot
      source = raceToday
      uncapped = target?.vdot ?? raceToday.vdot
      continue
    }
    if (!target) continue // nothing in the window: hold the last value
    uncapped = target.vdot

    if (value === undefined || day <= seedEnd) {
      if (value === undefined || target.vdot > value || day <= seedEnd) {
        value = target.vdot
        source = target
      }
    } else if (target.vdot > value) {
      value = Math.min(target.vdot, value + MAX_DAILY_GAIN)
      source = target
    } else if (target.vdot < value) {
      value = target.vdot
      source = target
    }
  }

  if (value === undefined || !source) return undefined
  return { vdot: value, source, uncappedVdot: uncapped, capped: uncapped - value > 0.05 }
}

/** Days since the fitness source evidence — for "based on your 5.2 km on …". */
export function sourceAgeDays(fitness: CurrentFitness, today: string): number {
  return daysBetween(fitness.source.date, today)
}
