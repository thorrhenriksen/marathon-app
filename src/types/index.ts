// Core domain types for the marathon training app.
// All data is persisted locally via Dexie (IndexedDB) — see src/db/db.ts.

export type SessionType =
  | 'easy'
  | 'long'
  | 'tempo'
  | 'marathon-pace'
  | 'strides'
  | 'race'
  | 'rest'
  | 'strength'

export type SessionStatus =
  | 'planned'
  | 'completed'
  | 'skipped'
  | 'moved'
  | 'handled' // set by the "Not feeling 100%" quick-adjust action
  | 'downgraded-to-mobility' // strength session reduced to the 5-min mobility block only
  | 'missed' // explicitly marked as not done (distinct from an unresolved past session)

export type StrengthVariant = 'A' | 'B'

export type StrengthEquipment = 'bodyweight' | 'dumbbell' | 'pullup-bar' | 'mat'

export interface StrengthExerciseCatalogEntry {
  id: string
  name: string
  targetArea: string
  equipment: StrengthEquipment
  formCue: string
}

/** Per-session snapshot — denormalized from the catalog so historical
 *  sessions keep the exact prescription shown even if the catalog changes. */
export interface SessionExercise {
  exerciseId: string
  name: string
  sets: number
  /** Exactly one of reps / holdSeconds is set. */
  reps?: number
  holdSeconds?: number
  formCue: string
  completed: boolean
}

export interface Session {
  id: string
  week: number
  /** ISO date, YYYY-MM-DD */
  date: string
  type: SessionType
  plannedDistanceKm: number
  description: string
  status: SessionStatus
  /** Set when a session is moved to a different day within its week. */
  originalDate?: string
  /** Set once a Run has been logged against this session. */
  linkedRunId?: string
  /** Strength sessions only, below. */
  variant?: StrengthVariant
  exercises?: SessionExercise[]
  estimatedMinutes?: number
  completionNote?: string
}

export type TimeOffLabel = 'holiday' | 'illness' | 'other'

export interface TimeOff {
  id: string
  /** ISO date, YYYY-MM-DD, inclusive */
  startDate: string
  /** ISO date, YYYY-MM-DD, inclusive */
  endDate: string
  label: TimeOffLabel
  note?: string
}

export interface Run {
  id: string
  /** ISO date, YYYY-MM-DD */
  date: string
  distanceKm: number
  durationSeconds: number
  /** Derived: durationSeconds / distanceKm */
  paceSecPerKm: number
  type: SessionType | 'other'
  /** Perceived effort, 1-10 */
  effort: number
  note?: string
  linkedSessionId?: string
}

export interface Goal {
  id: 'goal'
  targetTimeSeconds: number
  updatedAt: string
}

export interface Settings {
  id: 'settings'
  /** 0 = Sunday .. 6 = Saturday, matches JS Date#getDay() */
  preferredDays: number[]
  units: 'km'
  hasRequestedPersistence: boolean
  theme: 'light' | 'dark' | 'system'
}

export type Phase = 1 | 2 | 3 | 4

export interface WeekMeta {
  week: number
  /** ISO date, YYYY-MM-DD — Monday of this training week */
  startDate: string
  phase: Phase
  phaseLabel: string
  targetVolumeKm: number
  isCutback: boolean
  isHolidayMaintenance: boolean
  isHalfMarathonWeek: boolean
  isRaceWeek: boolean
  isTaper: boolean
}

export interface TimeOffAdjustment {
  id: string
  timeOffId: string
  createdAt: string
  summary: string[]
  affectedWeeks: number[]
  previousSessions: Session[]
  insertedSessionIds: string[]
  returnWeekNumber?: number
  reEntryTemplateWeek?: number
  undone: boolean
}

export interface PaceZones {
  marathonPaceSecPerKm: number
  easyPaceMinSecPerKm: number
  easyPaceMaxSecPerKm: number
  tempoPaceMinSecPerKm: number
  tempoPaceMaxSecPerKm: number
  raceGoalTimeSeconds: number
}
