// Derived, never-stored achievements. Every value here is recomputed from
// runs/sessions/weeks/time-off on every load — the only persisted state
// related to achievements is which unlock celebrations have already been
// shown (Settings.shownAchievementIds) and which unlocked theme/card-accent
// is currently selected (Settings.theme / Settings.cardAccent).
//
// Streak rule: a week counts if every non-rest session in it is "handled"
// (completed, or adjusted away via downgrade/skip/move/not-feeling-100%).
// A week fully covered by time off is paused (doesn't count, doesn't break).
// Any explicitly-missed session breaks the streak. An unresolved ("unlogged")
// past session leaves the week pending — it halts the *current* streak count
// but doesn't reset the *longest* streak the way a miss does.

import { addDays } from './dates'
import { getDisplayStatus } from './sessionStatus'
import { findTimeOffForDate } from './timeOffDisplay'
import { formatPace } from './paceZones'
import { PHASE_LABELS } from '../db/weekPlan'
import type { Phase, Run, Session, TimeOff, WeekMeta } from '../types'

export type WeekStreakStatus = 'counted' | 'paused' | 'failed' | 'pending'

function isWeekFullyPaused(week: WeekMeta, timeOffEntries: TimeOff[]): boolean {
  const weekEnd = addDays(week.startDate, 6)
  for (let d = week.startDate; d <= weekEnd; d = addDays(d, 1)) {
    if (!findTimeOffForDate(d, timeOffEntries)) return false
  }
  return true
}

export function classifyWeek(
  week: WeekMeta,
  sessions: Session[],
  timeOffEntries: TimeOff[],
  today: string,
): WeekStreakStatus {
  if (isWeekFullyPaused(week, timeOffEntries)) return 'paused'

  const weekSessions = sessions.filter((s) => s.week === week.week && s.type !== 'rest')
  if (weekSessions.length === 0) return 'counted'

  let anyUnlogged = false
  for (const session of weekSessions) {
    const status = getDisplayStatus(session, today)
    if (status === 'missed') return 'failed'
    if (status === 'unlogged') anyUnlogged = true
  }
  return anyUnlogged ? 'pending' : 'counted'
}

export function computeStreaks(
  sessions: Session[],
  weeks: WeekMeta[],
  timeOffEntries: TimeOff[],
  today: string,
): { current: number; longest: number } {
  const elapsedWeeks = weeks
    .filter((w) => addDays(w.startDate, 6) < today)
    .slice()
    .sort((a, b) => a.week - b.week)

  const statuses = elapsedWeeks.map((w) => classifyWeek(w, sessions, timeOffEntries, today))

  let longest = 0
  let running = 0
  for (const status of statuses) {
    if (status === 'counted') {
      running++
      longest = Math.max(longest, running)
    } else if (status === 'failed') {
      running = 0
    }
    // 'paused' and 'pending' are no-ops for the longest-streak run.
  }

  let current = 0
  for (let i = statuses.length - 1; i >= 0; i--) {
    const status = statuses[i]
    if (status === 'counted') current++
    else if (status === 'paused') continue
    else break // 'failed' or 'pending' stops the current streak count
  }

  return { current, longest }
}

export function computeTotalDistanceKm(runs: Run[]): number {
  return runs.reduce((sum, r) => sum + r.distanceKm, 0)
}

const DISTANCE_FIRST_THRESHOLDS = [10, 15, 21.1, 25, 30] as const

export interface DistanceFirst {
  thresholdKm: number
  date?: string
}

export function computeDistanceFirsts(runs: Run[]): DistanceFirst[] {
  const sorted = runs.slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  return DISTANCE_FIRST_THRESHOLDS.map((thresholdKm) => {
    const first = sorted.find((r) => r.distanceKm >= thresholdKm)
    return { thresholdKm, date: first?.date }
  })
}

export function computeBestPace(runs: Run[]): number | undefined {
  const eligible = runs.filter((r) => r.distanceKm >= 5 && r.paceSecPerKm > 0)
  if (eligible.length === 0) return undefined
  return Math.min(...eligible.map((r) => r.paceSecPerKm))
}

export interface PhaseCompletion {
  phase: Phase
  label: string
  completed: boolean
}

export function computePhaseCompletions(weeks: WeekMeta[], today: string): PhaseCompletion[] {
  const phases: Phase[] = [1, 2, 3, 4]
  return phases.map((phase) => {
    const phaseWeeks = weeks.filter((w) => w.phase === phase)
    const lastWeek = phaseWeeks.reduce<WeekMeta | undefined>(
      (latest, w) => (!latest || w.week > latest.week ? w : latest),
      undefined,
    )
    const completed = !!lastWeek && today > addDays(lastWeek.startDate, 6)
    return { phase, label: PHASE_LABELS[phase], completed }
  })
}

export function computeAdherence(sessions: Session[], today: string): number {
  const elapsed = sessions.filter((s) => s.type !== 'rest' && s.date <= today)
  if (elapsed.length === 0) return 0
  const completed = elapsed.filter((s) => s.status === 'completed').length
  return Math.round((completed / elapsed.length) * 100)
}

/** ISO date of the earliest logged run, if any. */
export function computeFirstRunDate(runs: Run[]): string | undefined {
  if (runs.length === 0) return undefined
  return runs.reduce((earliest, r) => (r.date < earliest ? r.date : earliest), runs[0].date)
}

/** Week number of the earliest elapsed week that actually had sessions and was
 *  fully "handled" per the existing streak rule (see classifyWeek above). */
export function computeFirstCompletedWeek(
  sessions: Session[],
  weeks: WeekMeta[],
  timeOffEntries: TimeOff[],
  today: string,
): number | undefined {
  const elapsedWeeks = weeks
    .filter((w) => addDays(w.startDate, 6) < today)
    .slice()
    .sort((a, b) => a.week - b.week)

  for (const week of elapsedWeeks) {
    const hasSessions = sessions.some((s) => s.week === week.week && s.type !== 'rest')
    if (!hasSessions) continue
    if (classifyWeek(week, sessions, timeOffEntries, today) === 'counted') return week.week
  }
  return undefined
}

/** True once today has reached the start of the designated race week. */
export function computeRaceWeekReached(weeks: WeekMeta[], today: string): boolean {
  const raceWeek = weeks.find((w) => w.isRaceWeek)
  return !!raceWeek && today >= raceWeek.startDate
}

/** Longest run of consecutive elapsed weeks with >=90% plan adherence
 *  (reuses computeAdherence per week — a week with no eligible sessions
 *  breaks the run, same as a missed session would). */
export function computeConsistencyStreak(sessions: Session[], weeks: WeekMeta[], today: string): number {
  const elapsedWeeks = weeks
    .filter((w) => addDays(w.startDate, 6) < today)
    .slice()
    .sort((a, b) => a.week - b.week)

  let longest = 0
  let running = 0
  for (const week of elapsedWeeks) {
    const weekSessions = sessions.filter((s) => s.week === week.week)
    const eligible = weekSessions.filter((s) => s.type !== 'rest')
    const pct = computeAdherence(weekSessions, today)
    if (eligible.length > 0 && pct >= 90) {
      running++
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }
  return longest
}

/** Number of elapsed weeks where every planned rest day was left untouched
 *  (status still 'planned' — never swapped away via a quick-adjust action). */
export function computeRestDaysHonoredCount(sessions: Session[], weeks: WeekMeta[], today: string): number {
  const elapsedWeeks = weeks.filter((w) => addDays(w.startDate, 6) < today)
  let count = 0
  for (const week of elapsedWeeks) {
    const restSessions = sessions.filter((s) => s.week === week.week && s.type === 'rest')
    if (restSessions.length === 0) continue
    if (restSessions.every((s) => s.status === 'planned')) count++
  }
  return count
}

/** Number of times a "Not feeling 100%" or "Swap to mobility only" quick-adjust
 *  has been used — these produce 'handled' (non-rest) or 'downgraded-to-mobility'
 *  statuses, and are a positive recovery signal, never a penalty. */
export function computeSmartCallCount(sessions: Session[]): number {
  return sessions.filter((s) => s.status === 'downgraded-to-mobility' || (s.status === 'handled' && s.type !== 'rest'))
    .length
}

/** Week numbers of taper weeks (week >= 33) completed without exceeding their
 *  planned volume. */
export function computeTaperDisciplineWeeks(runs: Run[], weeks: WeekMeta[], today: string): number[] {
  return weeks
    .filter((w) => w.isTaper && addDays(w.startDate, 6) < today)
    .filter((w) => {
      const weekEnd = addDays(w.startDate, 6)
      const actualKm = runs
        .filter((r) => r.date >= w.startDate && r.date <= weekEnd)
        .reduce((sum, r) => sum + r.distanceKm, 0)
      return actualKm <= w.targetVolumeKm
    })
    .map((w) => w.week)
}

export type ThemeUnlock = 'dawn' | 'midnight'
export type CardAccentUnlock = 'bronze' | 'silver' | 'gold' | 'platinum'

export const THEME_UNLOCK_STREAK_WEEKS: Record<ThemeUnlock, number> = {
  dawn: 5,
  midnight: 10,
}

export const CARD_ACCENT_UNLOCK_KM: Record<CardAccentUnlock, number> = {
  bronze: 100,
  silver: 200,
  gold: 400,
  platinum: 600,
}

export function isThemeUnlocked(theme: ThemeUnlock, longestStreak: number): boolean {
  return longestStreak >= THEME_UNLOCK_STREAK_WEEKS[theme]
}

export function isCardAccentUnlocked(accent: CardAccentUnlock, totalDistanceKm: number): boolean {
  return totalDistanceKm >= CARD_ACCENT_UNLOCK_KM[accent]
}

export interface Achievement {
  id: string
  category: 'streak' | 'distance' | 'badge' | 'consistency' | 'recovery'
  title: string
  condition: string
  unlocked: boolean
  progress?: string
}

export interface ComputeAchievementsInput {
  sessions: Session[]
  runs: Run[]
  weeks: WeekMeta[]
  timeOffEntries: TimeOff[]
  today: string
}

export function computeAchievements(input: ComputeAchievementsInput): Achievement[] {
  const { sessions, runs, weeks, timeOffEntries, today } = input
  const { longest } = computeStreaks(sessions, weeks, timeOffEntries, today)
  const totalKm = computeTotalDistanceKm(runs)
  const phaseCompletions = computePhaseCompletions(weeks, today)
  const distanceFirsts = computeDistanceFirsts(runs)
  const bestPace = computeBestPace(runs)
  const adherence = computeAdherence(sessions, today)
  const firstRunDate = computeFirstRunDate(runs)
  const firstCompletedWeek = computeFirstCompletedWeek(sessions, weeks, timeOffEntries, today)
  const raceWeekReached = computeRaceWeekReached(weeks, today)
  const consistencyStreak = computeConsistencyStreak(sessions, weeks, today)
  const restDaysHonoredCount = computeRestDaysHonoredCount(sessions, weeks, today)
  const smartCallCount = computeSmartCallCount(sessions)
  const taperDisciplineWeeks = computeTaperDisciplineWeeks(runs, weeks, today)
  const firstDoubleDigit = distanceFirsts.find((f) => f.thresholdKm === 10)

  const achievements: Achievement[] = []

  for (const theme of ['dawn', 'midnight'] as ThemeUnlock[]) {
    const weeksNeeded = THEME_UNLOCK_STREAK_WEEKS[theme]
    achievements.push({
      id: `streak-${weeksNeeded}`,
      category: 'streak',
      title: `${weeksNeeded}-week streak`,
      condition: `Reach a ${weeksNeeded}-week streak to unlock the ${theme === 'dawn' ? 'Dawn' : 'Midnight'} theme`,
      unlocked: isThemeUnlocked(theme, longest),
      progress: `${Math.min(longest, weeksNeeded)}/${weeksNeeded} weeks`,
    })
  }

  for (const accent of ['bronze', 'silver', 'gold', 'platinum'] as CardAccentUnlock[]) {
    const kmNeeded = CARD_ACCENT_UNLOCK_KM[accent]
    achievements.push({
      id: `distance-${kmNeeded}`,
      category: 'distance',
      title: `${kmNeeded} km logged`,
      condition: `Log ${kmNeeded} km to unlock the ${accent} card accent`,
      unlocked: isCardAccentUnlocked(accent, totalKm),
      progress: `${Math.round(Math.min(totalKm, kmNeeded))}/${kmNeeded} km`,
    })
  }

  for (const phaseCompletion of phaseCompletions) {
    achievements.push({
      id: `phase-${phaseCompletion.phase}`,
      category: 'badge',
      title: phaseCompletion.label,
      condition: `Complete the ${phaseCompletion.label} phase`,
      unlocked: phaseCompletion.completed,
    })
  }

  for (const first of distanceFirsts) {
    achievements.push({
      id: `distance-first-${first.thresholdKm}`,
      category: 'badge',
      title: `First ${first.thresholdKm}km run`,
      condition: `Log a run of at least ${first.thresholdKm} km`,
      unlocked: !!first.date,
      progress: first.date,
    })
  }

  achievements.push({
    id: 'best-pace-5k',
    category: 'badge',
    title: 'Best 5K+ pace',
    condition: 'Log a run of at least 5 km',
    unlocked: bestPace !== undefined,
    progress: bestPace !== undefined ? formatPace(bestPace) : undefined,
  })

  achievements.push({
    id: 'adherence',
    category: 'badge',
    title: 'Plan adherence',
    condition: 'Complete sessions on schedule',
    unlocked: adherence > 0,
    progress: `${adherence}%`,
  })

  achievements.push({
    id: 'first-run',
    category: 'badge',
    title: 'First run logged',
    condition: 'Log your first run',
    unlocked: firstRunDate !== undefined,
    progress: firstRunDate,
  })

  achievements.push({
    id: 'first-completed-week',
    category: 'badge',
    title: 'First complete week',
    condition: 'Fully handle every session in a training week',
    unlocked: firstCompletedWeek !== undefined,
    progress: firstCompletedWeek !== undefined ? `Week ${firstCompletedWeek}` : undefined,
  })

  achievements.push({
    id: 'first-double-digit-run',
    category: 'badge',
    title: 'First double-digit run',
    condition: 'Log a run of at least 10 km',
    unlocked: !!firstDoubleDigit?.date,
    progress: firstDoubleDigit?.date,
  })

  achievements.push({
    id: 'race-week-reached',
    category: 'badge',
    title: 'Race week',
    condition: 'Reach the final race week of the plan',
    unlocked: raceWeekReached,
  })

  for (const weeksNeeded of [4, 8] as const) {
    achievements.push({
      id: `consistency-${weeksNeeded}`,
      category: 'consistency',
      title: `${weeksNeeded}-week consistency`,
      condition: `Hit 90%+ plan adherence for ${weeksNeeded} consecutive weeks`,
      unlocked: consistencyStreak >= weeksNeeded,
      progress: `${Math.min(consistencyStreak, weeksNeeded)}/${weeksNeeded} weeks`,
    })
  }

  achievements.push({
    id: 'rest-days-honored',
    category: 'recovery',
    title: 'Rested well',
    condition: 'Take every planned rest day in a week without swapping it out',
    unlocked: restDaysHonoredCount > 0,
    progress: restDaysHonoredCount > 0 ? `${restDaysHonoredCount} week(s)` : undefined,
  })

  achievements.push({
    id: 'smart-call',
    category: 'recovery',
    title: 'Smart call',
    condition: 'Use "Not feeling 100%" or "Swap to mobility only" when you need to',
    unlocked: smartCallCount > 0,
    progress: smartCallCount > 0 ? `${smartCallCount} time(s)` : undefined,
  })

  achievements.push({
    id: 'taper-discipline',
    category: 'recovery',
    title: 'Taper discipline',
    condition: 'Stay at or under planned volume during a taper week',
    unlocked: taperDisciplineWeeks.length > 0,
    progress: taperDisciplineWeeks.length > 0 ? `${taperDisciplineWeeks.length} week(s)` : undefined,
  })

  return achievements
}
