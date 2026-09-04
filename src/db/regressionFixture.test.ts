// Guards the "additive-only" migration discipline: a realistic snapshot of
// existing user data (runs, completed/missed/downgraded sessions, a holiday
// adjustment, and achievement-related settings) must round-trip losslessly
// through storage and re-derive identical achievements after a simulated
// reload. Re-run this at the end of every later stage.
import { describe, it, expect } from 'vitest'
import { computeAchievements } from '../lib/achievements'
import type { Run, Session, Settings, TimeOff, TimeOffAdjustment, WeekMeta } from '../types'

const weeks: WeekMeta[] = [
  {
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
  },
  {
    week: 2,
    startDate: '2026-08-31',
    phase: 1,
    phaseLabel: 'Base building',
    targetVolumeKm: 22,
    isCutback: false,
    isHolidayMaintenance: true,
    isHalfMarathonWeek: false,
    isRaceWeek: false,
    isTaper: false,
  },
]

const sessions: Session[] = [
  {
    id: 's1',
    week: 1,
    date: '2026-08-25',
    type: 'easy',
    plannedDistanceKm: 5,
    description: 'Easy run',
    status: 'completed',
    linkedRunId: 'r1',
  },
  {
    id: 's2',
    week: 1,
    date: '2026-08-27',
    type: 'strength',
    plannedDistanceKm: 0,
    description: 'Strength A',
    status: 'downgraded-to-mobility',
    variant: 'A',
    exercises: [
      { exerciseId: 'goblet-squat', name: 'Goblet squat', sets: 3, reps: 10, formCue: 'Chest up', completed: true },
    ],
    completedAt: '2026-08-27T18:00:00.000Z',
  },
  {
    id: 's3',
    week: 2,
    date: '2026-09-01',
    type: 'tempo',
    plannedDistanceKm: 8,
    description: 'Tempo run',
    status: 'missed',
  },
]

const runs: Run[] = [
  {
    id: 'r1',
    date: '2026-08-25',
    distanceKm: 5,
    durationSeconds: 1500,
    paceSecPerKm: 300,
    type: 'easy',
    effort: 4,
    linkedSessionId: 's1',
    loggedAt: '2026-08-25T07:30:00.000Z',
  },
]

const timeOff: TimeOff[] = [{ id: 't1', startDate: '2026-08-31', endDate: '2026-09-06', label: 'holiday' }]

const timeOffAdjustments: TimeOffAdjustment[] = [
  {
    id: 'adj1',
    timeOffId: 't1',
    createdAt: '2026-08-30T10:00:00.000Z',
    summary: ['Week 2 marked as holiday maintenance'],
    affectedWeeks: [2],
    previousSessions: [],
    insertedSessionIds: [],
    undone: false,
  },
]

const settings: Settings = {
  id: 'settings',
  preferredDays: [1, 3, 6],
  units: 'km',
  hasRequestedPersistence: true,
  theme: 'dark',
  shownAchievementIds: ['distance-100'],
  cardAccent: 'bronze',
  achievementsExpanded: true,
  achievementsHasUnseenUnlock: false,
}

const today = '2026-09-04'

/** Simulates persistence + reload via a JSON round-trip — a superset of what
 *  IndexedDB's structured clone preserves for our plain-data shapes. */
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('regression fixture: additive-only data survives a reload', () => {
  it('round-trips every record losslessly', () => {
    expect(roundTrip(weeks)).toEqual(weeks)
    expect(roundTrip(sessions)).toEqual(sessions)
    expect(roundTrip(runs)).toEqual(runs)
    expect(roundTrip(timeOff)).toEqual(timeOff)
    expect(roundTrip(timeOffAdjustments)).toEqual(timeOffAdjustments)
    expect(roundTrip(settings)).toEqual(settings)
  })

  it('derives identical achievements before and after a simulated reload', () => {
    const input = { sessions, runs, weeks, timeOffEntries: timeOff, today }
    const before = computeAchievements(input)

    const reloadedInput = {
      sessions: roundTrip(sessions),
      runs: roundTrip(runs),
      weeks: roundTrip(weeks),
      timeOffEntries: roundTrip(timeOff),
      today,
    }
    const after = computeAchievements(reloadedInput)

    expect(after).toEqual(before)
  })
})
