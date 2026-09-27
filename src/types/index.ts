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
  /** 2-3 short form cues shown in the exercise detail sheet. */
  cues: string[]
  commonMistake: string
  easierVariation?: string
  harderVariation?: string
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
  /** ISO datetime — set alongside status: 'completed' for strength sessions. */
  completedAt?: string
  /** Strength sessions only, below. */
  variant?: StrengthVariant
  exercises?: SessionExercise[]
  estimatedMinutes?: number
  completionNote?: string
  /** Resume point for guided mode — persisted so an app kill mid-workout can resume. */
  guidedProgress?: { currentExerciseIndex: number; completedExerciseIds: string[] }
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
  /** ISO datetime the run was logged at. Absent for older/legacy entries. */
  loggedAt?: string
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
  theme: 'light' | 'dark' | 'system' | 'dawn' | 'midnight'
  /** Ids of achievements whose unlock celebration has already been shown. */
  shownAchievementIds?: string[]
  /** Selected card accent for the Today session card, once unlocked. */
  cardAccent?: 'bronze' | 'silver' | 'gold' | 'platinum'
  /** Persisted expand/collapse state of the Progress tab's Achievements section. */
  achievementsExpanded?: boolean
  /** True when an achievement unlocked while the section was collapsed and hasn't been seen yet. */
  achievementsHasUnseenUnlock?: boolean
  /** Persisted last-selected segment of the Train tab. */
  trainViewTab?: 'week' | 'log'
  /** Persisted last-selected segment of the Progress tab. */
  progressTab?: 'statistics' | 'achievements'
  /** Guided strength session rest-timer duration, in seconds. Defaults to 45. */
  restTimerSeconds?: number
  /** Whether guided mode plays an audio cue at the end of the rest timer. Defaults to true. */
  audioCueEnabled?: boolean
  /** Whether guided mode attempts to keep the screen awake. Defaults to true. */
  wakeLockEnabled?: boolean
  /** Coin-economy event log: one entry per collected achievement. The coin
   *  balance is derived from these plus shopPurchases — never stored. */
  achievementCollections?: AchievementCollection[]
  /** Coin-economy event log: one entry per shop purchase (price 0 for
   *  grandfathered items that were already unlocked before the shop existed). */
  shopPurchases?: ShopPurchase[]
  /** Set once the coin economy has grandfathered prior unlocks and credited
   *  previously-earned achievements. Guards the one-time initialization. */
  coinEconomyInitializedAt?: string
  /** Selected celebration animation (a shop cosmetic). Defaults to 'classic'. */
  celebrationStyle?: CelebrationStyle
  /** Selected calendar session-marker style (a shop cosmetic). Defaults to 'dots'. */
  iconPack?: IconPack
}

export type CelebrationStyle = 'classic' | 'fireworks' | 'pulse'
export type IconPack = 'dots' | 'glyphs' | 'squares'

export interface AchievementCollection {
  achievementId: string
  collectedAt: string
  /** Coin value credited at collection time, so later price tweaks never
   *  rewrite a past balance. */
  coins: number
  /** True for achievements earned before the collection flow existed and
   *  credited automatically at initialization. */
  retroactive?: boolean
}

export interface ShopPurchase {
  itemId: string
  purchasedAt: string
  price: number
  grandfathered?: boolean
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
