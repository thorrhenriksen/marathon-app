// Static seed data for the fixed 36-week marathon training plan.
// Race: London Marathon, Sunday 2027-04-25. Week 1 starts Monday 2026-08-17.
//
// dayOffset: 0=Monday .. 6=Sunday (plan week starts on Monday).
// This is a DIFFERENT convention from src/lib/dates.ts#getWeekdayIndex,
// which follows JS Date#getDay() (0=Sunday..6=Saturday) and is used for
// Settings.preferredDays. Keep these separate; see src/db/seed.ts for the
// conversion from dayOffset to an absolute ISO date.

import type { Phase, SessionType } from '../types'

export interface SessionSeed {
  dayOffset: number
  type: SessionType
  distanceKm: number
  description: string
}

export interface WeekSeed {
  week: number
  phase: Phase
  targetVolumeKm: number
  isCutback?: boolean
  isHolidayMaintenance?: boolean
  isHalfMarathonWeek?: boolean
  isRaceWeek?: boolean
  sessions: SessionSeed[]
}

export const PHASE_LABELS: Record<Phase, string> = {
  1: 'Base building',
  2: 'Aerobic development',
  3: 'Marathon block',
  4: 'Taper',
}

const TUE = 1
const THU = 3
const SAT = 5
const SUN = 6

function easy(dayOffset: number, distanceKm: number, description = 'Easy run'): SessionSeed {
  return { dayOffset, type: 'easy', distanceKm, description }
}

function long(dayOffset: number, distanceKm: number, description = 'Long run'): SessionSeed {
  return { dayOffset, type: 'long', distanceKm, description }
}

export const WEEK_PLAN: WeekSeed[] = [
  // ---------- Phase 1 — Base building, weeks 1-8 (Tue/Thu/Sun) ----------
  { week: 1, phase: 1, targetVolumeKm: 15, sessions: [easy(TUE, 5), easy(THU, 5), long(SUN, 5)] },
  { week: 2, phase: 1, targetVolumeKm: 17, sessions: [easy(TUE, 5), easy(THU, 6), long(SUN, 6)] },
  { week: 3, phase: 1, targetVolumeKm: 19, sessions: [easy(TUE, 6), easy(THU, 6), long(SUN, 7)] },
  { week: 4, phase: 1, targetVolumeKm: 15, sessions: [easy(TUE, 5), easy(THU, 5), long(SUN, 5)] },
  { week: 5, phase: 1, targetVolumeKm: 20, sessions: [easy(TUE, 6), easy(THU, 6), long(SUN, 8)] },
  { week: 6, phase: 1, targetVolumeKm: 22, sessions: [easy(TUE, 6), easy(THU, 7), long(SUN, 9)] },
  { week: 7, phase: 1, targetVolumeKm: 24, sessions: [easy(TUE, 7), easy(THU, 7), long(SUN, 10)] },
  { week: 8, phase: 1, targetVolumeKm: 18, sessions: [easy(TUE, 5), easy(THU, 6), long(SUN, 7)] },

  // ---------- Phase 2 — Aerobic development, weeks 9-20 (Tue/Thu/Sat/Sun) ----------
  {
    week: 9,
    phase: 2,
    targetVolumeKm: 26,
    sessions: [easy(TUE, 5), easy(THU, 6), easy(SAT, 5), long(SUN, 10)],
  },
  {
    week: 10,
    phase: 2,
    targetVolumeKm: 28,
    sessions: [easy(TUE, 5), easy(THU, 6), easy(SAT, 6), long(SUN, 11)],
  },
  {
    week: 11,
    phase: 2,
    targetVolumeKm: 30,
    sessions: [
      easy(TUE, 6, 'Easy run + strides (4-6 x 20s)'),
      easy(THU, 6),
      easy(SAT, 6),
      long(SUN, 12),
    ],
  },
  {
    week: 12,
    phase: 2,
    targetVolumeKm: 24,
    isCutback: true,
    sessions: [
      easy(TUE, 5, 'Easy run + strides (4-6 x 20s) (cutback week)'),
      easy(THU, 5, 'Easy run (cutback week)'),
      easy(SAT, 5, 'Easy run (cutback week)'),
      long(SUN, 9, 'Long run (cutback week)'),
    ],
  },
  {
    week: 13,
    phase: 2,
    targetVolumeKm: 31,
    sessions: [
      easy(TUE, 6, 'Easy run + strides (4-6 x 20s)'),
      { dayOffset: THU, type: 'tempo', distanceKm: 6, description: 'Tempo: 3 x 5 min @ tempo pace, 2 min easy jog recovery' },
      easy(SAT, 6),
      long(SUN, 13),
    ],
  },
  {
    week: 14,
    phase: 2,
    targetVolumeKm: 33,
    sessions: [
      easy(TUE, 6, 'Easy run + strides (4-6 x 20s)'),
      { dayOffset: THU, type: 'tempo', distanceKm: 7, description: 'Tempo: 3 x 6 min @ tempo pace, 2 min easy jog recovery' },
      easy(SAT, 6),
      long(SUN, 14),
    ],
  },
  {
    week: 15,
    phase: 2,
    targetVolumeKm: 35,
    sessions: [
      easy(TUE, 7, 'Easy run + strides (4-6 x 20s)'),
      { dayOffset: THU, type: 'tempo', distanceKm: 7, description: 'Tempo: 3 x 7 min @ tempo pace, 90s easy jog recovery' },
      easy(SAT, 6),
      long(SUN, 15),
    ],
  },
  {
    week: 16,
    phase: 2,
    targetVolumeKm: 27,
    isCutback: true,
    sessions: [
      easy(TUE, 5, 'Easy run + strides (4-6 x 20s) (cutback week)'),
      easy(THU, 6, 'Easy run (cutback week)'),
      easy(SAT, 5, 'Easy run (cutback week)'),
      long(SUN, 11, 'Long run (cutback week)'),
    ],
  },
  {
    week: 17,
    phase: 2,
    targetVolumeKm: 37,
    sessions: [
      easy(TUE, 7, 'Easy run + strides (4-6 x 20s)'),
      { dayOffset: THU, type: 'tempo', distanceKm: 7, description: 'Tempo: 4 x 5 min @ tempo pace, 90s easy jog recovery' },
      easy(SAT, 7),
      long(SUN, 16),
    ],
  },
  {
    week: 18,
    phase: 2,
    targetVolumeKm: 33,
    sessions: [
      easy(TUE, 7, 'Easy run + strides (4-6 x 20s)'),
      { dayOffset: THU, type: 'tempo', distanceKm: 7, description: 'Tempo: 15 min continuous @ tempo pace' },
      easy(SAT, 7),
      long(SUN, 12),
    ],
  },
  {
    week: 19,
    phase: 2,
    targetVolumeKm: 28,
    isHolidayMaintenance: true,
    sessions: [
      easy(TUE, 5, 'Easy run + strides (4-6 x 20s) (holiday maintenance week)'),
      easy(THU, 6, 'Easy run (holiday maintenance week)'),
      easy(SAT, 5, 'Easy run (holiday maintenance week)'),
      long(SUN, 12, 'Long run (holiday maintenance week)'),
    ],
  },
  {
    week: 20,
    phase: 2,
    targetVolumeKm: 32,
    isHolidayMaintenance: true,
    sessions: [
      easy(TUE, 6, 'Easy run + strides (4-6 x 20s) (holiday maintenance week)'),
      { dayOffset: THU, type: 'tempo', distanceKm: 6, description: 'Tempo: 20 min continuous @ tempo pace' },
      easy(SAT, 6),
      long(SUN, 14, 'Long run (holiday maintenance week)'),
    ],
  },

  // ---------- Phase 3 — Marathon block, weeks 21-33 (Tue/Thu/Sat/Sun) ----------
  {
    week: 21,
    phase: 3,
    targetVolumeKm: 36,
    sessions: [
      easy(TUE, 7, 'Easy run + strides (4-6 x 20s)'),
      { dayOffset: THU, type: 'tempo', distanceKm: 7, description: '20 min continuous @ tempo pace' },
      easy(SAT, 6),
      long(SUN, 16),
    ],
  },
  {
    week: 22,
    phase: 3,
    targetVolumeKm: 39,
    sessions: [
      easy(TUE, 7, 'Easy run + strides (4-6 x 20s)'),
      {
        dayOffset: THU,
        type: 'marathon-pace',
        distanceKm: 7,
        description: '3 x 10 min @ marathon pace, easy jog recovery',
      },
      easy(SAT, 7),
      long(SUN, 18),
    ],
  },
  {
    week: 23,
    phase: 3,
    targetVolumeKm: 32,
    isCutback: true,
    sessions: [
      easy(TUE, 6, 'Easy run + strides (4-6 x 20s) (cutback week)'),
      easy(THU, 6, 'Easy run (cutback week)'),
      easy(SAT, 6, 'Easy run (cutback week)'),
      long(SUN, 14, 'Long run (cutback week)'),
    ],
  },
  {
    week: 24,
    phase: 3,
    targetVolumeKm: 42,
    sessions: [
      easy(TUE, 7, 'Easy run + strides (4-6 x 20s)'),
      { dayOffset: THU, type: 'tempo', distanceKm: 8, description: '25 min continuous @ tempo pace' },
      easy(SAT, 7),
      long(SUN, 20),
    ],
  },
  {
    week: 25,
    phase: 3,
    targetVolumeKm: 44,
    sessions: [
      easy(TUE, 7, 'Easy run + strides (4-6 x 20s)'),
      {
        dayOffset: THU,
        type: 'marathon-pace',
        distanceKm: 8,
        description: '2 x 15 min @ marathon pace, easy jog recovery',
      },
      easy(SAT, 7),
      long(SUN, 22),
    ],
  },
  {
    week: 26,
    phase: 3,
    targetVolumeKm: 47,
    sessions: [
      easy(TUE, 8, 'Easy run + strides (4-6 x 20s)'),
      {
        dayOffset: THU,
        type: 'marathon-pace',
        distanceKm: 8,
        description: '30 min continuous @ marathon pace',
      },
      easy(SAT, 7),
      long(SUN, 24),
    ],
  },
  {
    week: 27,
    phase: 3,
    targetVolumeKm: 35,
    isCutback: true,
    sessions: [
      easy(TUE, 6, 'Easy run + strides (4-6 x 20s) (cutback week)'),
      easy(THU, 7, 'Easy run (cutback week)'),
      easy(SAT, 6, 'Easy run (cutback week)'),
      long(SUN, 16, 'Long run (cutback week)'),
    ],
  },
  {
    week: 28,
    phase: 3,
    targetVolumeKm: 49,
    sessions: [
      easy(TUE, 8, 'Easy run + strides (4-6 x 20s)'),
      {
        dayOffset: THU,
        type: 'marathon-pace',
        distanceKm: 8,
        description: '3 x 12 min @ marathon pace, easy jog recovery',
      },
      easy(SAT, 7),
      long(SUN, 26),
    ],
  },
  {
    week: 29,
    phase: 3,
    targetVolumeKm: 40.1,
    isHalfMarathonWeek: true,
    sessions: [
      easy(TUE, 6, 'Easy run + strides (4-6 x 20s)'),
      easy(THU, 6, 'Short easy run, pre-race sharpening'),
      easy(SAT, 7),
      { dayOffset: SUN, type: 'race', distanceKm: 21.1, description: 'Half Marathon (tune-up race)' },
    ],
  },
  {
    week: 30,
    phase: 3,
    targetVolumeKm: 51,
    sessions: [
      easy(TUE, 8, 'Easy run + strides (4-6 x 20s)'),
      {
        dayOffset: THU,
        type: 'marathon-pace',
        distanceKm: 8,
        description: '2 x 15 min @ marathon pace, easy jog recovery',
      },
      easy(SAT, 7),
      long(SUN, 28),
    ],
  },
  {
    week: 31,
    phase: 3,
    targetVolumeKm: 54,
    sessions: [
      easy(TUE, 8, 'Easy run + strides (4-6 x 20s)'),
      {
        dayOffset: THU,
        type: 'marathon-pace',
        distanceKm: 8,
        description: '30-35 min continuous @ marathon pace',
      },
      easy(SAT, 8),
      long(SUN, 30, 'Long run, last 5 km @ marathon pace'),
    ],
  },
  {
    week: 32,
    phase: 3,
    targetVolumeKm: 40,
    isCutback: true,
    sessions: [
      easy(TUE, 7, 'Easy run + strides (4-6 x 20s) (cutback week)'),
      easy(THU, 7, 'Easy run (cutback week)'),
      easy(SAT, 6, 'Easy run (cutback week)'),
      long(SUN, 20, 'Long run (cutback week)'),
    ],
  },
  {
    week: 33,
    phase: 3,
    targetVolumeKm: 55,
    sessions: [
      easy(TUE, 8, 'Easy run + strides (4-6 x 20s)'),
      {
        dayOffset: THU,
        type: 'marathon-pace',
        distanceKm: 8,
        description: '25 min continuous @ marathon pace',
      },
      easy(SAT, 7),
      long(SUN, 32, 'Long run, last 6 km @ marathon pace'),
    ],
  },

  // ---------- Phase 4 — Taper, weeks 34-36 ----------
  {
    week: 34,
    phase: 4,
    targetVolumeKm: 40,
    sessions: [
      easy(TUE, 6, 'Easy run + strides (4-6 x 20s)'),
      {
        dayOffset: THU,
        type: 'marathon-pace',
        distanceKm: 7,
        description: '15 min continuous @ marathon pace',
      },
      easy(SAT, 5),
      long(SUN, 22),
    ],
  },
  {
    week: 35,
    phase: 4,
    targetVolumeKm: 28,
    sessions: [
      easy(TUE, 5, 'Easy run + strides (4-6 x 20s)'),
      {
        dayOffset: THU,
        type: 'marathon-pace',
        distanceKm: 5,
        description: '10 min continuous @ marathon pace',
      },
      easy(SAT, 4),
      long(SUN, 14),
    ],
  },
  {
    week: 36,
    phase: 4,
    targetVolumeKm: 53.2,
    isRaceWeek: true,
    sessions: [
      easy(TUE, 5, 'Easy run + strides (4-6 x 20s), shake off nerves'),
      easy(THU, 4, 'Easy shakeout run'),
      { dayOffset: SAT, type: 'rest', distanceKm: 2, description: 'Rest day, or optional easy 2 km shakeout jog' },
      { dayOffset: SUN, type: 'race', distanceKm: 42.2, description: 'LONDON MARATHON — RACE DAY' },
    ],
  },
]
