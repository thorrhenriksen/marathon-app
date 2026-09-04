import type { Session, SessionType, Settings, TimeOff, WeekMeta } from '../types'
import { addDays, daysBetween, getWeekdayIndex, startOfWeek } from './dates'
import {
  buildMobilityOnlyExercises,
  buildSessionExercises,
  estimatedMinutesForTier,
  tierForWeek,
} from './strengthCatalog'

export interface AdjustmentPreview {
  timeOffId: string
  /** Existing sessions with modified fields (status, date, distance, description). */
  updatedSessions: Session[]
  /** Brand new sessions to insert (re-entry week only). */
  insertedSessions: Session[]
  /** Human-readable lines describing what will change, for the confirm-before-apply UI. */
  summary: string[]
  /** Plan week that the re-entry week (if any) was inserted into. */
  returnWeekNumber?: number
  /** Plan week whose structure was used as the re-entry template (if any). */
  reEntryTemplateWeek?: number
}

const PROTECTED_WEEKS = new Set([28, 29, 30, 31, 32, 33, 34, 35])

const SESSION_PRIORITY: Record<SessionType, number> = {
  long: 4,
  race: 4,
  tempo: 3,
  'marathon-pace': 3,
  strides: 2,
  easy: 1,
  rest: 0,
  strength: -1,
}

function rangeLengthDays(timeOff: TimeOff): number {
  return daysBetween(timeOff.startDate, timeOff.endDate) + 1
}

function sortedPreferredWeekdays(settings: Settings): number[] {
  return [...settings.preferredDays].sort((a, b) => a - b)
}

/** Mon-based day offset (0=Mon..6=Sun) for a date, matching weekPlan.ts's convention. */
function mondayOffset(dateStr: string): number {
  const sunBased = getWeekdayIndex(dateStr) // 0=Sun..6=Sat
  return sunBased === 0 ? 6 : sunBased - 1
}

function longestConsecutiveRun(usedOffsets: number[]): number {
  const sorted = [...new Set(usedOffsets)].sort((a, b) => a - b)
  let longest = sorted.length > 0 ? 1 : 0
  let current = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }
  return longest
}

export function computeAdjustment(
  timeOff: TimeOff,
  allSessions: Session[],
  allWeeks: WeekMeta[],
  settings: Settings,
): AdjustmentPreview {
  const summary: string[] = []
  const spanDays = rangeLengthDays(timeOff)
  const inRange = allSessions.filter((s) => s.date >= timeOff.startDate && s.date <= timeOff.endDate)

  if (spanDays <= 3) {
    const updatedSessions: Session[] = []
    applyShortGapRedistribution(timeOff, allSessions, inRange, settings, updatedSessions, summary)
    return { timeOffId: timeOff.id, updatedSessions, insertedSessions: [], summary }
  }

  // Medium (4-10 days) and long (>10 days) gaps: skip everything in range, replace the
  // return week entirely with a scaled-down re-entry week, and leave every other week untouched.
  const returnDate = addDays(timeOff.endDate, 1)
  const returnWeekNumber = findWeekNumberForDate(allWeeks, returnDate)
  const toSkip = new Map<string, Session>()
  for (const session of inRange) toSkip.set(session.id, session)
  for (const session of allSessions.filter((s) => s.week === returnWeekNumber)) {
    if (session.status !== 'completed') toSkip.set(session.id, session)
  }

  const updatedSessions = [...toSkip.values()].map((s) => ({ ...s, status: 'skipped' as const }))
  if (updatedSessions.length > 0) {
    summary.push(
      `Marked ${updatedSessions.length} session(s) as skipped across ${timeOff.startDate} to ${timeOff.endDate} and the return week.`,
    )
  }

  const insertedSessions: Session[] = []
  const reEntryTemplateWeek = applyReEntryWeek(
    timeOff,
    allSessions,
    allWeeks,
    returnWeekNumber,
    spanDays > 10,
    insertedSessions,
    summary,
  )

  return {
    timeOffId: timeOff.id,
    updatedSessions,
    insertedSessions,
    summary,
    returnWeekNumber,
    reEntryTemplateWeek,
  }
}

function applyShortGapRedistribution(
  timeOff: TimeOff,
  allSessions: Session[],
  inRangeSessions: Session[],
  settings: Settings,
  updatedSessions: Session[],
  summary: string[],
): void {
  if (inRangeSessions.length === 0) return

  const weeksAffected = [...new Set(inRangeSessions.map((s) => s.week))]

  for (const week of weeksAffected) {
    const weekSessions = allSessions.filter((s) => s.week === week)
    const weekMonday = startOfWeek(weekSessions[0].date)
    const inRangeIds = new Set(inRangeSessions.filter((s) => s.week === week).map((s) => s.id))
    const stayingSessions = weekSessions.filter((s) => !inRangeIds.has(s.id))
    const toReschedule = weekSessions.filter((s) => inRangeIds.has(s.id))

    const placedOffsets = stayingSessions.map((s) => mondayOffset(s.date))

    const preferredOffsets = sortedPreferredWeekdays(settings).map((sunBased) =>
      sunBased === 0 ? 6 : sunBased - 1,
    )

    const availableOffsets = preferredOffsets.filter((offset) => {
      if (placedOffsets.includes(offset)) return false
      const date = addDays(weekMonday, offset)
      return date < timeOff.startDate || date > timeOff.endDate
    })

    const sortedToReschedule = [...toReschedule].sort(
      (a, b) => SESSION_PRIORITY[b.type] - SESSION_PRIORITY[a.type],
    )

    for (const session of sortedToReschedule) {
      if (session.type === 'strength') {
        updatedSessions.push({ ...session, status: 'skipped' })
        summary.push(`Skipped "${session.description}" (${session.date}) — strength sessions aren't rescheduled.`)
        continue
      }

      const slotIndex = availableOffsets.findIndex(
        (offset) => longestConsecutiveRun([...placedOffsets, offset]) <= 2,
      )

      if (slotIndex === -1) {
        updatedSessions.push({ ...session, status: 'skipped' })
        summary.push(`No spare day for "${session.description}" (${session.date}); marked skipped.`)
        continue
      }

      const offset = availableOffsets[slotIndex]
      availableOffsets.splice(slotIndex, 1)
      placedOffsets.push(offset)
      const newDate = addDays(weekMonday, offset)
      updatedSessions.push({ ...session, status: 'moved', date: newDate, originalDate: session.date })
      summary.push(`Moved "${session.description}" from ${session.date} to ${newDate}.`)
    }
  }
}

function findLastFullyCompletedWeek(allSessions: Session[], beforeDate: string): number {
  const weekNumbers = [...new Set(allSessions.map((s) => s.week))].sort((a, b) => b - a)
  for (const week of weekNumbers) {
    const sessions = allSessions.filter((s) => s.week === week)
    const allBeforeCutoff = sessions.every((s) => s.date < beforeDate)
    if (!allBeforeCutoff) continue
    const allCompleted = sessions.every((s) => s.status === 'completed')
    if (allCompleted) return week
  }
  return 1
}

function findWeekNumberForDate(allWeeks: WeekMeta[], date: string): number {
  const sorted = [...allWeeks].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  let result = sorted[0]?.week ?? 1
  for (const week of sorted) {
    if (week.startDate <= date) result = week.week
    else break
  }
  return result
}

function applyReEntryWeek(
  timeOff: TimeOff,
  allSessions: Session[],
  allWeeks: WeekMeta[],
  returnWeekNumber: number,
  isLongGap: boolean,
  insertedSessions: Session[],
  summary: string[],
): number | undefined {
  const returnWeekMeta = allWeeks.find((w) => w.week === returnWeekNumber)
  if (!returnWeekMeta) return undefined

  let templateWeek = findLastFullyCompletedWeek(allSessions, timeOff.startDate)
  if (isLongGap) {
    templateWeek = Math.max(1, templateWeek - 2)
  }
  while (PROTECTED_WEEKS.has(templateWeek) && templateWeek > 1) {
    templateWeek -= 1
  }

  const templateSessions = allSessions.filter((s) => s.week === templateWeek)
  const templateWeekMeta = allWeeks.find((w) => w.week === templateWeek)
  if (templateSessions.length === 0 || !templateWeekMeta) return undefined

  for (const templateSession of templateSessions) {
    const offset = daysBetween(templateWeekMeta.startDate, templateSession.date)
    const newDate = addDays(returnWeekMeta.startDate, offset)

    if (templateSession.type === 'strength') {
      insertedSessions.push({
        id: crypto.randomUUID(),
        week: returnWeekNumber,
        date: newDate,
        type: 'strength',
        plannedDistanceKm: 0,
        description: `${templateSession.description} (re-entry week)`,
        status: 'planned',
        variant: templateSession.variant,
        exercises: templateSession.exercises?.map((e) => ({ ...e, completed: false })),
        estimatedMinutes: templateSession.estimatedMinutes,
      })
      continue
    }

    insertedSessions.push({
      id: crypto.randomUUID(),
      week: returnWeekNumber,
      date: newDate,
      type: templateSession.type,
      plannedDistanceKm: Math.round(templateSession.plannedDistanceKm * 0.85 * 10) / 10,
      description: `${templateSession.description} (re-entry week, reduced volume)`,
      status: 'planned',
    })
  }

  summary.push(
    `Inserted a re-entry week at week ${returnWeekNumber} (starting ${returnWeekMeta.startDate}), based on week ${templateWeek}'s structure at ~85% volume. Race date and remaining plan weeks are unchanged.`,
  )

  return templateWeek
}

/** Moves a single session to a new date within the same week. Returns the updated session, or null if the target date falls outside that session's plan week. */
export function moveSessionToDate(session: Session, newDate: string, weekMeta: WeekMeta): Session | null {
  const weekEnd = addDays(weekMeta.startDate, 6)
  if (newDate < weekMeta.startDate || newDate > weekEnd) return null
  return { ...session, date: newDate, status: 'moved', originalDate: session.originalDate ?? session.date }
}

/** "Not feeling 100%" quick-adjust: converts today's session to a short easy run or full rest. */
export function applyNotFeeling100(session: Session): Session {
  if (session.type === 'rest') {
    return { ...session, status: 'handled' }
  }
  const shortEasyKm = Math.min(session.plannedDistanceKm, 4)
  return {
    ...session,
    type: 'easy',
    plannedDistanceKm: shortEasyKm,
    description: 'Short easy run (adjusted — not feeling 100%)',
    status: 'handled',
  }
}

/** "Swap to mobility only" quick-adjust for strength sessions: reduces the
 *  session to just its 5-min mobility block. */
export function applySwapToMobilityOnly(session: Session): Session {
  return {
    ...session,
    exercises: buildMobilityOnlyExercises(session.variant ?? 'A'),
    status: 'downgraded-to-mobility',
  }
}

/** True if a strength session's current exercises are exactly the mobility-only
 *  set for its variant — detected by exercise-id comparison rather than status
 *  or description, since both a "downgraded-to-mobility" status and a
 *  "(mobility only)" description can go stale (e.g. once the status is
 *  changed again, as when a downgraded session is later marked missed). */
function hasMobilityOnlyExercises(session: Session): boolean {
  if (!session.exercises) return false
  const mobilityIds = buildMobilityOnlyExercises(session.variant ?? 'A').map((e) => e.exerciseId)
  const currentIds = session.exercises.map((e) => e.exerciseId)
  return mobilityIds.length === currentIds.length && mobilityIds.every((id) => currentIds.includes(id))
}

/** Reverts any resolved outcome (completed, missed, handled, downgraded-to-
 *  mobility, or skipped) back to a fresh 'planned' session, so the normal
 *  actions (log, mark missed, swap to mobility) are available again. Clears
 *  any run link and strength mobility-only downgrade. Never touches the
 *  linked run itself — callers are responsible for unlinking it on the run's
 *  side (see db/runs.ts's revertSessionToPlanned). */
export function resetSessionOutcome(session: Session): Session {
  const { linkedRunId: _linkedRunId, completedAt: _completedAt, completionNote: _completionNote, ...rest } = session
  const base: Session = { ...rest, status: 'planned' }

  if (session.type !== 'strength') return base

  const variant = session.variant ?? 'A'
  if (hasMobilityOnlyExercises(session)) {
    const tier = tierForWeek(session.week)
    return {
      ...base,
      description: `Strength — Session ${variant}`,
      exercises: buildSessionExercises(variant, tier),
      estimatedMinutes: estimatedMinutesForTier(tier),
    }
  }

  return { ...base, exercises: session.exercises?.map((e) => ({ ...e, completed: false })) }
}
