import { describe, it, expect } from 'vitest'
import { computeCurrentFitness } from './fitness'
import {
  classifyGap,
  computeGoalEngineState,
  computeTrainingZones,
  easyRunsRunningHot,
  evaluateGates,
  halfGateTarget,
  marathonVdot,
  resolveGoals,
  suggestBGoalSeconds,
  tenKGateTarget,
} from './goalEngine'
import { addDays } from './dates'
import { vdotFromPerformance } from './vdot'
import type { FitnessTest, Goal, Run, Session, WeekMeta } from '../types'

const hms = (h: number, m: number, s: number) => h * 3600 + m * 60 + s
const A = hms(3, 25, 0)
const PLAN_START = '2026-08-24'

function run(id: string, date: string, distanceKm: number, durationSeconds: number, type: Run['type'] = 'easy'): Run {
  return { id, date, distanceKm, durationSeconds, paceSecPerKm: durationSeconds / distanceKm, type, effort: 5 }
}

function makeWeeks(count: number, targetVolumeKm = 30): WeekMeta[] {
  return Array.from({ length: count }, (_, i) => ({
    week: i + 1,
    startDate: addDays(PLAN_START, i * 7),
    phase: 1 as const,
    phaseLabel: 'Base building',
    targetVolumeKm,
    isCutback: false,
    isHolidayMaintenance: false,
    isHalfMarathonWeek: false,
    isRaceWeek: false,
    isTaper: false,
  }))
}

const weekStart = (w: number) => addDays(PLAN_START, (w - 1) * 7)

describe('computeCurrentFitness', () => {
  it('is undefined without evidence', () => {
    expect(computeCurrentFitness([], [], '2026-09-01')).toBeUndefined()
  })

  it('uses the best quality run during the seeding window', () => {
    const runs = [run('a', '2026-09-01', 5, 1500), run('b', '2026-09-05', 5, hms(0, 24, 8))]
    const f = computeCurrentFitness(runs, [], '2026-09-06')!
    expect(f.vdot).toBeCloseTo(40, 0)
    expect(f.source.date).toBe('2026-09-05')
    expect(f.capped).toBe(false)
  })

  it('ignores implausible results (mistyped distance or time)', () => {
    expect(computeCurrentFitness([run('a', '2026-09-01', 910.2, 3720)], [], '2026-09-02')).toBeUndefined()
  })

  it('ignores runs under 3 km', () => {
    expect(computeCurrentFitness([run('a', '2026-09-01', 2, 480)], [], '2026-09-02')).toBeUndefined()
  })

  it('caps auto-updates at +1 VDOT per 4 weeks after seeding', () => {
    const runs = [run('a', '2026-06-01', 5, hms(0, 24, 8))]
    for (let d = 0; d < 120; d += 7) runs.push(run(`e${d}`, addDays('2026-06-01', d), 5, hms(0, 24, 8)))
    // Big jump well after the seed window: a VDOT-45 5K.
    runs.push(run('fast', '2026-09-20', 5, hms(0, 21, 50)))
    const f28 = computeCurrentFitness(runs, [], addDays('2026-09-20', 27))!
    expect(f28.vdot).toBeLessThanOrEqual(40.1 + 1.01)
    expect(f28.capped).toBe(true)
    expect(f28.uncappedVdot).toBeCloseTo(45, 0)
  })

  it('lets a race or time trial jump fitness uncapped', () => {
    const runs = [run('a', '2026-06-01', 5, hms(0, 24, 8))]
    for (let d = 0; d < 120; d += 7) runs.push(run(`e${d}`, addDays('2026-06-01', d), 5, hms(0, 24, 8)))
    const tests: FitnessTest[] = [{ id: 't', date: '2026-09-20', distanceKm: 5, durationSeconds: hms(0, 21, 50), kind: 'time-trial' }]
    const f = computeCurrentFitness(runs, tests, '2026-09-21')!
    expect(f.vdot).toBeCloseTo(45, 0)
    expect(f.source.kind).toBe('time-trial')
  })

  it('treats a logged run of type race as uncapped evidence', () => {
    const runs = [run('a', '2026-06-01', 5, hms(0, 24, 8))]
    for (let d = 0; d < 120; d += 7) runs.push(run(`e${d}`, addDays('2026-06-01', d), 5, hms(0, 24, 8)))
    runs.push(run('race', '2026-09-20', 10, hms(0, 45, 16), 'race'))
    expect(computeCurrentFitness(runs, [], '2026-09-20')!.vdot).toBeCloseTo(45, 0)
  })
})

describe('goals', () => {
  it('migrates the legacy single goal into the A goal and auto-suggests B from fitness', () => {
    const legacy: Goal = { id: 'goal', targetTimeSeconds: A, updatedAt: '' }
    const goals = resolveGoals(legacy, 40)
    expect(goals.aSeconds).toBe(A)
    expect(goals.bAuto).toBe(true)
    expect(goals.bSeconds).toBe(suggestBGoalSeconds(40))
    expect(goals.bSeconds).toBe(hms(3, 50, 0))
  })

  it('grades the gap', () => {
    const aV = marathonVdot(A)
    expect(classifyGap(aV, aV - 0.5)).toBe('none')
    expect(classifyGap(aV, aV - 2)).toBe('stretch')
    expect(classifyGap(aV, aV - 4)).toBe('acknowledge')
    expect(classifyGap(aV, 40)).toBe('aspirational')
  })

  it('derives gate targets from the A goal (44:25-ish 10K, 1:37:00 half for 3:25)', () => {
    const tenK = tenKGateTarget(A)
    expect(tenK).toBeGreaterThanOrEqual(hms(0, 44, 20))
    expect(tenK).toBeLessThanOrEqual(hms(0, 44, 35))
    expect(halfGateTarget(A)).toBe(hms(1, 37, 0))
  })
})

describe('training zones never follow the goal', () => {
  it('easy and tempo bands depend only on current fitness', () => {
    const slowGoal = resolveGoals({ id: 'goal', targetTimeSeconds: hms(4, 30, 0), updatedAt: '' }, 40)
    const fastGoal = resolveGoals({ id: 'goal', targetTimeSeconds: hms(3, 0, 0), updatedAt: '' }, 40)
    const a = computeTrainingZones(40, slowGoal, false)
    const b = computeTrainingZones(40, fastGoal, false)
    expect(a.easyPaceMinSecPerKm).toBe(b.easyPaceMinSecPerKm)
    expect(a.tempoPaceMinSecPerKm).toBe(b.tempoPaceMinSecPerKm)
    expect(a.marathonPaceSecPerKm).toBe(b.marathonPaceSecPerKm)
    expect(a.raceGoalTimeSeconds).toBe(b.raceGoalTimeSeconds) // both B-goal (auto from fitness)
  })

  it('MP and race-day pacing switch to the A goal only once unlocked', () => {
    const goals = resolveGoals({ id: 'goal', targetTimeSeconds: A, updatedAt: '' }, 40)
    const locked = computeTrainingZones(40, goals, false)
    const unlocked = computeTrainingZones(40, goals, true)
    expect(locked.marathonPaceSecPerKm).toBeGreaterThan(unlocked.marathonPaceSecPerKm)
    expect(unlocked.marathonPaceSecPerKm).toBeCloseTo(A / 42.195, 5)
    expect(locked.raceGoalTimeSeconds).toBe(goals.bSeconds)
    expect(unlocked.raceGoalTimeSeconds).toBe(A)
    expect(unlocked.easyPaceMinSecPerKm).toBe(locked.easyPaceMinSecPerKm)
  })
})

describe('evaluateGates', () => {
  const weeks = makeWeeks(35, 30)
  // Hit exactly the planned volume in every week up to week 29.
  const volumeRuns = Array.from({ length: 29 }, (_, i) => run(`v${i}`, addDays(weekStart(i + 1), 2), 30, 30 * 360))
  const afterHalf = addDays(weekStart(30), 1)

  it('unlocks when both races hit target and both criteria pass', () => {
    const runs = [
      ...volumeRuns,
      run('10k', addDays(weekStart(23), 6), 10, hms(0, 44, 10), 'race'),
      run('hm', addDays(weekStart(28), 6), 21.1, hms(1, 36, 30), 'race'),
    ]
    const status = evaluateGates({ aSeconds: A, weeks, sessions: [], runs, tests: [], today: afterHalf })
    expect(status.gates.map((g) => g.status)).toEqual(['passed', 'passed'])
    expect(status.criteria.map((c) => c.status)).toEqual(['passed', 'passed'])
    expect(status.unlocked).toBe(true)
  })

  it('accepts a directly-entered time trial for the 10K gate', () => {
    const tests: FitnessTest[] = [{ id: 't', date: addDays(weekStart(22), 3), distanceKm: 10, durationSeconds: hms(0, 44, 0), kind: 'time-trial' }]
    const status = evaluateGates({ aSeconds: A, weeks, sessions: [], runs: volumeRuns, tests, today: afterHalf })
    expect(status.gates[0].status).toBe('passed')
  })

  it('fails a slow gate race and recommends a revised goal from the actual result', () => {
    const runs = [...volumeRuns, run('hm', addDays(weekStart(28), 6), 21.1, hms(1, 45, 0), 'race')]
    const status = evaluateGates({ aSeconds: A, weeks, sessions: [], runs, tests: [], today: afterHalf })
    const half = status.gates[1]
    expect(half.status).toBe('failed')
    const resultVdot = vdotFromPerformance(21100, hms(1, 45, 0))
    expect(half.recommendedGoalSeconds).toBe(suggestBGoalSeconds(resultVdot))
    expect(status.unlocked).toBe(false)
  })

  it('ignores races outside the gate window and marks a lapsed window failed', () => {
    const runs = [...volumeRuns, run('10k', addDays(weekStart(18), 6), 10, hms(0, 43, 0), 'race')]
    const status = evaluateGates({ aSeconds: A, weeks, sessions: [], runs, tests: [], today: afterHalf })
    expect(status.gates[0].status).toBe('failed')
    expect(status.gates[0].result).toBeUndefined()
  })

  it('is pending before the gate window', () => {
    const status = evaluateGates({ aSeconds: A, weeks, sessions: [], runs: [], tests: [], today: weekStart(6) })
    expect(status.gates.map((g) => g.status)).toEqual(['pending', 'pending'])
    expect(status.criteria[0].status).toBe('pending')
  })

  it('blocks the unlock after an injury-variant session in the last 3 weeks', () => {
    const runs = [
      ...volumeRuns,
      run('10k', addDays(weekStart(23), 6), 10, hms(0, 44, 10), 'race'),
      run('hm', addDays(weekStart(28), 6), 21.1, hms(1, 36, 30), 'race'),
    ]
    const sessions: Session[] = [
      {
        id: 's',
        week: 29,
        date: addDays(weekStart(29), 0),
        type: 'strength',
        plannedDistanceKm: 0,
        description: 'Strength A',
        status: 'handled',
        injuryVariant: 'sore-knees',
      },
    ]
    const status = evaluateGates({ aSeconds: A, weeks, sessions, runs, tests: [], today: afterHalf })
    expect(status.criteria[1].status).toBe('failed')
    expect(status.unlocked).toBe(false)
  })

  it('fails the volume criterion under 90% over the trailing 8 weeks', () => {
    const lowRuns = volumeRuns.map((r) => ({ ...r, distanceKm: 25 }))
    const status = evaluateGates({ aSeconds: A, weeks, sessions: [], runs: lowRuns, tests: [], today: afterHalf })
    expect(status.criteria[0].status).toBe('failed')
  })
})

describe('easyRunsRunningHot', () => {
  it('flags when most recent easy runs beat the fast end of the easy band', () => {
    const goals = resolveGoals({ id: 'goal', targetTimeSeconds: A, updatedAt: '' }, 40)
    const zones = computeTrainingZones(40, goals, false) // easy ~5:49–6:38
    const hot = [1, 5, 9, 13].map((d) => run(`h${d}`, addDays('2026-09-01', d), 7, 7 * 300)) // 5:00/km
    expect(easyRunsRunningHot(hot, zones, '2026-09-20').hot).toBe(true)
    const calm = hot.map((r) => ({ ...r, paceSecPerKm: 370 }))
    expect(easyRunsRunningHot(calm, zones, '2026-09-20').hot).toBe(false)
  })
})

describe('computeGoalEngineState', () => {
  it('reads the same current fitness for zones and predictions (one source of truth)', () => {
    const runs = [run('a', '2026-09-05', 5, hms(0, 24, 8))]
    const state = computeGoalEngineState({
      goal: { id: 'goal', targetTimeSeconds: A, updatedAt: '' },
      runs,
      sessions: [],
      weeks: makeWeeks(35),
      today: '2026-09-06',
    })
    expect(state.provisional).toBe(false)
    expect(state.currentVdot).toBeCloseTo(40, 0)
    expect(state.gap).toBe('aspirational')
    expect(state.zones.easyPaceMinSecPerKm).toBeGreaterThan(340)
  })

  it('falls back to a provisional, modest fitness with no evidence', () => {
    const state = computeGoalEngineState({ goal: undefined, runs: [], sessions: [], weeks: makeWeeks(35), today: '2026-09-06' })
    expect(state.provisional).toBe(true)
    expect(state.goals.aSeconds).toBe(A)
  })
})

describe('formatPace rounding', () => {
  it('never renders 60 seconds', async () => {
    const { formatPace } = await import('./paceZones')
    expect(formatPace(119.6)).toBe('2:00/km')
    expect(formatPace(359.4)).toBe('5:59/km')
  })
})
