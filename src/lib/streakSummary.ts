// Presentation layer over the weekly streak (achievements.ts owns the rule
// itself — nothing here changes what counts). Pairs the streak with overall
// adherence and builds a plain-language explanation of why the streak is at
// its current value, so a single missed session never reads as the verdict.

import { addDays } from './dates'
import { classifyWeek, computeStreaks, type WeekStreakStatus } from './achievements'
import type { Session, TimeOff, WeekMeta } from '../types'

export interface StreakSummary {
  current: number
  longest: number
  completedSessions: number
  elapsedSessions: number
  adherencePercent: number
  /** True when the streak is 0/1 — the chip then leads with adherence. */
  leadWithAdherence: boolean
  explanation: string
}

function joinWeeks(weeks: number[]): string {
  if (weeks.length === 1) return `Week ${weeks[0]}`
  const head = weeks.slice(0, -1).join(', ')
  return `Weeks ${head} and ${weeks[weeks.length - 1]}`
}

/** "Week 2 had a missed session" / "Weeks 1 and 2 each had a missed session". */
function missedPhrase(weeks: number[]): string {
  return weeks.length === 1
    ? `${joinWeeks(weeks)} had a missed session`
    : `${joinWeeks(weeks)} each had a missed session`
}

export function explainStreak(statuses: { week: number; status: WeekStreakStatus }[], current: number): string {
  if (statuses.length === 0) {
    return 'No full plan weeks have finished yet — the streak starts counting when this week ends.'
  }

  // Walk back from the latest elapsed week to find where the current run starts.
  let i = statuses.length - 1
  let counted = 0
  let streakStartWeek: number | undefined
  while (i >= 0 && counted < current) {
    if (statuses[i].status === 'counted') {
      counted++
      streakStartWeek = statuses[i].week
    }
    i--
  }
  while (i >= 0 && statuses[i].status === 'paused') i--
  const breaker = i >= 0 ? statuses[i] : undefined
  const failedBefore = statuses.slice(0, i + 1).filter((s) => s.status === 'failed').map((s) => s.week)

  if (current > 0) {
    if (!breaker) return `Every finished week so far has counted — your streak began week ${streakStartWeek}.`
    if (breaker.status === 'pending') {
      return `Week ${breaker.week} still has an unlogged session, so the streak counts from week ${streakStartWeek}. Resolve it and earlier weeks may join the run.`
    }
    return `${missedPhrase(failedBefore)}; your streak began week ${streakStartWeek}.`
  }

  if (!breaker) return 'Every finished week so far was covered by time off, so the streak hasn\u2019t started yet.'
  if (breaker.status === 'pending') {
    return `Week ${breaker.week} has an unlogged session — log it or mark how it went and the streak picks back up.`
  }
  return `${missedPhrase([breaker.week])}, so the streak restarts from the next full week.`
}

export function computeStreakSummary(
  sessions: Session[],
  weeks: WeekMeta[],
  timeOffEntries: TimeOff[],
  today: string,
): StreakSummary {
  const { current, longest } = computeStreaks(sessions, weeks, timeOffEntries, today)
  const statuses = weeks
    .filter((w) => addDays(w.startDate, 6) < today)
    .slice()
    .sort((a, b) => a.week - b.week)
    .map((w) => ({ week: w.week, status: classifyWeek(w, sessions, timeOffEntries, today) }))

  // Same basis as computeAdherence: non-rest sessions dated today or earlier.
  const elapsed = sessions.filter((s) => s.type !== 'rest' && s.date <= today)
  const completedSessions = elapsed.filter((s) => s.status === 'completed').length
  const adherencePercent = elapsed.length === 0 ? 0 : Math.round((completedSessions / elapsed.length) * 100)

  return {
    current,
    longest,
    completedSessions,
    elapsedSessions: elapsed.length,
    adherencePercent,
    leadWithAdherence: current <= 1,
    explanation: explainStreak(statuses, current),
  }
}

/** Chip text: "🔥2 · 20/25 sessions · 87%", or adherence-first when the streak is 0/1. */
export function formatStreakChip(summary: StreakSummary): string {
  const sessionsPart = `${summary.completedSessions}/${summary.elapsedSessions} sessions`
  const streakPart = `🔥${summary.current}`
  if (summary.leadWithAdherence) return `${summary.adherencePercent}% · ${sessionsPart} · ${streakPart}`
  return `${streakPart} · ${sessionsPart} · ${summary.adherencePercent}%`
}
