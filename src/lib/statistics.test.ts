import { describe, it, expect } from 'vitest'
import {
  findQualityRun,
  predictRaceTimes,
  classifyAdherence,
  computeLongRunProgressionRatio,
  classifyLongRunProgression,
  classifyMarathonGoal,
  computeOnTrackStatus,
  computeACWR,
  classifyACWR,
  shouldSuppressACWR,
  computePersonalRecords,
  computeCumulativeDistanceKm,
} from './statistics'
import type { Run, Session, WeekMeta } from '../types'

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: `r-${Math.random()}`,
    date: '2026-08-01',
    distanceKm: 5,
    durationSeconds: 1500,
    paceSecPerKm: 300,
    type: 'easy',
    effort: 5,
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `s-${Math.random()}`,
    week: 1,
    date: '2026-08-01',
    type: 'long',
    plannedDistanceKm: 10,
    description: 'Long run',
    status: 'completed',
    ...overrides,
  }
}

function makeWeek(overrides: Partial<WeekMeta> = {}): WeekMeta {
  return {
    week: 1,
    startDate: '2026-08-24',
    phase: 1,
    phaseLabel: 'Base building',
    targetVolumeKm: 20,
    isCutback: false,
    isHolidayMaintenance: false,
    isHalfMarathonWeek: false,
    isRaceWeek: false,
    isTaper: false,
    ...overrides,
  }
}

describe('findQualityRun', () => {
  it('returns undefined when no run qualifies', () => {
    expect(findQualityRun([], '2026-09-04')).toBeUndefined()
    expect(findQualityRun([makeRun({ distanceKm: 2 })], '2026-09-04')).toBeUndefined()
    // Too old (> 42 days back).
    expect(findQualityRun([makeRun({ distanceKm: 5, date: '2026-06-01' })], '2026-09-04')).toBeUndefined()
  })

  it('picks the fastest-pace run among eligible runs', () => {
    const runs = [
      makeRun({ distanceKm: 5, paceSecPerKm: 300, date: '2026-08-20' }),
      makeRun({ distanceKm: 8, paceSecPerKm: 280, date: '2026-08-25' }),
      makeRun({ distanceKm: 3, paceSecPerKm: 320, date: '2026-08-30' }),
    ]
    const result = findQualityRun(runs, '2026-09-04')
    expect(result?.paceSecPerKm).toBe(280)
  })
})

describe('predictRaceTimes', () => {
  it('returns a marathon range, never a single number', () => {
    const predictions = predictRaceTimes({ distanceKm: 10, durationSeconds: 2400, paceSecPerKm: 240, date: '2026-08-30' })
    expect(predictions.marathonHighSeconds).toBeGreaterThan(predictions.marathonLowSeconds)
    expect(predictions.marathonHighSeconds / predictions.marathonLowSeconds).toBeCloseTo(1.05, 5)
  })

  it('predicts longer times for longer target distances (Riegel monotonicity)', () => {
    const predictions = predictRaceTimes({ distanceKm: 10, durationSeconds: 2400, paceSecPerKm: 240, date: '2026-08-30' })
    expect(predictions.fiveKSeconds).toBeLessThan(predictions.tenKSeconds)
    expect(predictions.tenKSeconds).toBeLessThan(predictions.halfMarathonSeconds)
    expect(predictions.halfMarathonSeconds).toBeLessThan(predictions.marathonLowSeconds)
  })
})

describe('classifyAdherence', () => {
  it('is on-track at/above 80%, behind below it', () => {
    expect(classifyAdherence(80)).toBe('on-track')
    expect(classifyAdherence(100)).toBe('on-track')
    expect(classifyAdherence(79)).toBe('behind')
    expect(classifyAdherence(0)).toBe('behind')
  })
})

describe('computeLongRunProgressionRatio', () => {
  const today = '2026-09-04'

  it('returns undefined when no long-run sessions have occurred', () => {
    expect(computeLongRunProgressionRatio([], [], today)).toBeUndefined()
  })

  it('counts a run within +/-10% of planned as within band', () => {
    const session = makeSession({ id: 's1', date: '2026-08-30', plannedDistanceKm: 10, linkedRunId: 'r1' })
    const run = makeRun({ id: 'r1', distanceKm: 10.5, date: '2026-08-30' })
    expect(computeLongRunProgressionRatio([session], [run], today)).toBe(1)
  })

  it('excludes a run outside the +/-10% band', () => {
    const session = makeSession({ id: 's1', date: '2026-08-30', plannedDistanceKm: 10, linkedRunId: 'r1' })
    const run = makeRun({ id: 'r1', distanceKm: 7, date: '2026-08-30' })
    expect(computeLongRunProgressionRatio([session], [run], today)).toBe(0)
  })

  it('treats a session with no logged run as outside band', () => {
    const session = makeSession({ id: 's1', date: '2026-08-30', plannedDistanceKm: 10 })
    expect(computeLongRunProgressionRatio([session], [], today)).toBe(0)
  })
})

describe('classifyLongRunProgression', () => {
  it('treats undefined (no data) as on-track, not behind', () => {
    expect(classifyLongRunProgression(undefined)).toBe('on-track')
  })

  it('is on-track at/above 50% within-band, behind otherwise', () => {
    expect(classifyLongRunProgression(0.5)).toBe('on-track')
    expect(classifyLongRunProgression(1)).toBe('on-track')
    expect(classifyLongRunProgression(0.25)).toBe('behind')
  })
})

describe('classifyMarathonGoal', () => {
  it('classifies at/below low as on-track, between as slightly-behind, above high as behind', () => {
    expect(classifyMarathonGoal(15000, 15000, 15750)).toBe('on-track')
    expect(classifyMarathonGoal(14000, 15000, 15750)).toBe('on-track')
    expect(classifyMarathonGoal(15500, 15000, 15750)).toBe('slightly-behind')
    expect(classifyMarathonGoal(16000, 15000, 15750)).toBe('behind')
  })
})

describe('computeOnTrackStatus', () => {
  it('is on-track when all three inputs are on-track', () => {
    expect(
      computeOnTrackStatus({ adherence4wk: 'on-track', longRunProgression: 'on-track', marathonRangeVsGoal: 'on-track' }),
    ).toBe('on-track')
  })

  it('is slightly-behind with exactly one non-on-track input', () => {
    expect(
      computeOnTrackStatus({ adherence4wk: 'behind', longRunProgression: 'on-track', marathonRangeVsGoal: 'on-track' }),
    ).toBe('slightly-behind')
    expect(
      computeOnTrackStatus({
        adherence4wk: 'on-track',
        longRunProgression: 'on-track',
        marathonRangeVsGoal: 'slightly-behind',
      }),
    ).toBe('slightly-behind')
  })

  it('is behind with two or more non-on-track inputs', () => {
    expect(
      computeOnTrackStatus({ adherence4wk: 'behind', longRunProgression: 'behind', marathonRangeVsGoal: 'on-track' }),
    ).toBe('behind')
  })
})

describe('computeACWR', () => {
  it('returns undefined with fewer than 5 weeks of data', () => {
    expect(computeACWR([10, 12, 14, 16])).toBeUndefined()
  })

  it('divides current week by the trailing 4-week average', () => {
    // trailing 4 weeks: 10,10,10,10 (avg 10), current week 15 -> ACWR 1.5
    expect(computeACWR([10, 10, 10, 10, 15])).toBeCloseTo(1.5, 5)
  })

  it('returns undefined when the trailing average is zero', () => {
    expect(computeACWR([0, 0, 0, 0, 5])).toBeUndefined()
  })
})

describe('classifyACWR', () => {
  it('bands correctly', () => {
    expect(classifyACWR(1.0)).toBe('steady')
    expect(classifyACWR(1.3)).toBe('steady')
    expect(classifyACWR(1.4)).toBe('ramping')
    expect(classifyACWR(1.5)).toBe('ramping')
    expect(classifyACWR(1.6)).toBe('spike')
  })
})

describe('shouldSuppressACWR', () => {
  it('suppresses with fewer than 5 weeks of history', () => {
    expect(shouldSuppressACWR(4, makeWeek())).toBe(true)
  })

  it('suppresses during a cutback or holiday-maintenance week', () => {
    expect(shouldSuppressACWR(6, makeWeek({ isCutback: true }))).toBe(true)
    expect(shouldSuppressACWR(6, makeWeek({ isHolidayMaintenance: true }))).toBe(true)
  })

  it('does not suppress with enough history and a normal week', () => {
    expect(shouldSuppressACWR(6, makeWeek())).toBe(false)
  })
})

describe('computePersonalRecords', () => {
  it('finds best pace at 5k+ and 10k+, and the longest run, independently', () => {
    const runs = [
      makeRun({ distanceKm: 5, paceSecPerKm: 300, durationSeconds: 1500, date: '2026-08-01' }),
      makeRun({ distanceKm: 10, paceSecPerKm: 280, durationSeconds: 2800, date: '2026-08-15' }),
      makeRun({ distanceKm: 21, paceSecPerKm: 320, durationSeconds: 6720, date: '2026-08-30' }),
    ]
    const records = computePersonalRecords(runs)
    expect(records.fiveKPlus?.bestPaceSecPerKm).toBe(280) // best among all runs >=5km
    expect(records.tenKPlus?.bestPaceSecPerKm).toBe(280) // best among runs >=10km
    expect(records.longestRun).toEqual({ distanceKm: 21, date: '2026-08-30' })
  })

  it('only updates when a faster run is actually logged (pure re-derivation)', () => {
    const slower = [makeRun({ distanceKm: 5, paceSecPerKm: 300, date: '2026-08-01' })]
    const withFaster = [...slower, makeRun({ distanceKm: 5, paceSecPerKm: 250, date: '2026-08-10' })]
    expect(computePersonalRecords(slower).fiveKPlus?.bestPaceSecPerKm).toBe(300)
    expect(computePersonalRecords(withFaster).fiveKPlus?.bestPaceSecPerKm).toBe(250)
  })

  it('returns undefined fields when no runs qualify', () => {
    expect(computePersonalRecords([])).toEqual({ fiveKPlus: undefined, tenKPlus: undefined, longestRun: undefined })
  })
})

describe('computeCumulativeDistanceKm', () => {
  it('sums all logged distance', () => {
    const runs = [makeRun({ distanceKm: 5 }), makeRun({ distanceKm: 7.5 })]
    expect(computeCumulativeDistanceKm(runs)).toBe(12.5)
  })
})
