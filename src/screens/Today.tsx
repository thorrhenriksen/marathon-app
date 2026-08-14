import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { RACE_DATE } from '../db/seed'
import {
  addDays,
  daysBetween,
  formatDisplayDateLong,
  parseISODate,
  startOfWeek,
  todayISO,
} from '../lib/dates'
import { computePaceZones, DEFAULT_GOAL_SECONDS, formatPace, formatPaceRange } from '../lib/paceZones'
import { findTimeOffForDate, getWeekAdjustments } from '../lib/timeOffDisplay'
import type { Session, SessionType, TimeOff } from '../types'
import Modal from '../components/Modal'
import LogRunForm from '../components/LogRunForm'
import AdjustmentSummaryModal from '../components/AdjustmentSummaryModal'

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  easy: 'Easy run',
  long: 'Long run',
  tempo: 'Tempo',
  'marathon-pace': 'Marathon pace',
  strides: 'Strides',
  race: 'Race day',
  rest: 'Rest',
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })

const STATUS_BADGE_STYLES: Record<Session['status'], string> = {
  planned: 'bg-surface-inset text-ink-muted',
  completed: 'bg-accent/20 text-accent',
  skipped: 'bg-danger/20 text-danger',
  moved: 'bg-warning/20 text-warning',
  handled: 'bg-info/20 text-info',
}

const STATUS_BADGE_LABELS: Record<Session['status'], string> = {
  planned: 'Planned',
  completed: 'Completed',
  skipped: 'Skipped',
  moved: 'Moved',
  handled: 'Adjusted',
}

const DOT_COLORS: Record<Session['status'], string> = {
  planned: 'bg-ink-faint',
  completed: 'bg-accent',
  skipped: 'bg-danger',
  moved: 'bg-warning',
  handled: 'bg-info',
}

export default function Today() {
  const today = todayISO()
  const weekStart = startOfWeek(today)
  const weekEnd = addDays(weekStart, 6)

  const goal = useLiveQuery(() => db.goals.get('goal'), [])
  const todaySession = useLiveQuery(
    () => db.sessions.where('date').equals(today).first(),
    [today],
  )
  const weekSessions = useLiveQuery(
    () => db.sessions.where('date').between(weekStart, weekEnd, true, true).sortBy('date'),
    [weekStart, weekEnd],
  )
  const currentWeekMeta = useLiveQuery(async () => {
    const weeks = await db.weeks.toArray()
    return weeks
      .filter((w) => w.startDate <= today)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0]
  }, [today])
  const timeOffEntries = useLiveQuery(() => db.timeOff.toArray(), [])
  const adjustments = useLiveQuery(
    () => db.timeOffAdjustments.filter((a) => !a.undone).toArray(),
    [],
  )

  const [loggingSession, setLoggingSession] = useState<Session | null>(null)
  const [selectedTimeOff, setSelectedTimeOff] = useState<TimeOff | null>(null)

  const weekIsAdjusted = currentWeekMeta
    ? getWeekAdjustments(currentWeekMeta.week, adjustments ?? []).length > 0
    : false

  function handleTapAdjusted() {
    if (!currentWeekMeta) return
    const weekAdjustments = getWeekAdjustments(currentWeekMeta.week, adjustments ?? [])
    const firstAdjustment = weekAdjustments[0]
    if (!firstAdjustment) return
    const timeOff = (timeOffEntries ?? []).find((t) => t.id === firstAdjustment.timeOffId)
    if (timeOff) setSelectedTimeOff(timeOff)
  }

  const zones = computePaceZones(goal?.targetTimeSeconds ?? DEFAULT_GOAL_SECONDS)
  const daysToRace = daysBetween(today, RACE_DATE)

  function paceGuidanceFor(session: Session): string {
    switch (session.type) {
      case 'easy':
      case 'long':
      case 'strides':
        return formatPaceRange(zones.easyPaceMinSecPerKm, zones.easyPaceMaxSecPerKm)
      case 'tempo':
        return formatPaceRange(zones.tempoPaceMinSecPerKm, zones.tempoPaceMaxSecPerKm)
      case 'marathon-pace':
      case 'race':
        return formatPace(zones.marathonPaceSecPerKm)
      case 'rest':
        return '—'
    }
  }

  const estimatedMinutes = todaySession
    ? (todaySession.plannedDistanceKm * ((zones.easyPaceMinSecPerKm + zones.easyPaceMaxSecPerKm) / 2)) / 60
    : 0
  const showFuelingReminder = todaySession?.type === 'long' && estimatedMinutes > 90

  const canLogToday =
    !!todaySession &&
    todaySession.type !== 'rest' &&
    todaySession.status !== 'completed' &&
    todaySession.status !== 'skipped'

  return (
    <div className="flex flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6">
      {/* Race countdown */}
      <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/20 to-surface p-4">
        <p className="text-xs uppercase tracking-widest text-accent">London Marathon</p>
        <p className="mt-1 text-3xl font-bold text-ink">
          {daysToRace > 0 ? `${daysToRace} days to go` : daysToRace === 0 ? 'Race day!' : 'Completed'}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{formatDisplayDateLong(RACE_DATE)}</p>
      </div>

      {/* Today's session */}
      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">Today</h2>
        {todaySession ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">
                  {SESSION_TYPE_LABELS[todaySession.type]}
                </p>
                <p className="mt-1 text-2xl font-semibold text-ink">
                  {todaySession.type === 'rest' ? 'Rest day' : `${todaySession.plannedDistanceKm} km`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_BADGE_STYLES[todaySession.status]}`}
              >
                {STATUS_BADGE_LABELS[todaySession.status]}
              </span>
            </div>

            <p className="mt-2 text-sm text-ink-muted">{todaySession.description}</p>

            {todaySession.type !== 'rest' && (
              <p className="mt-2 text-sm text-ink-muted">
                Target pace: <span className="text-ink">{paceGuidanceFor(todaySession)}</span>
              </p>
            )}

            {showFuelingReminder && (
              <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
                <p className="text-sm font-medium text-warning">Fueling reminder</p>
                <ul className="mt-1 list-disc pl-4 text-sm text-warning">
                  <li>Take a gel every 30-40 min starting around minute 40</li>
                  <li>Sip fluids regularly throughout</li>
                </ul>
              </div>
            )}

            {canLogToday && (
              <button
                onClick={() => setLoggingSession(todaySession)}
                className="mt-4 w-full rounded-xl bg-accent py-3 text-base font-semibold text-accent-fg"
              >
                Log this run
              </button>
            )}
            {todaySession.status === 'completed' && (
              <p className="mt-4 text-center text-sm font-medium text-accent">Logged</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-ink-faint">
            No session scheduled today.
          </div>
        )}
      </section>

      {/* This week at a glance */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-faint">This week</h2>
          {weekIsAdjusted && (
            <button onClick={handleTapAdjusted} className="text-[11px] font-medium text-info underline">
              Adjusted
            </button>
          )}
        </div>
        {currentWeekMeta && (
          <p className="mb-2 text-xs text-ink-faint">
            Week {currentWeekMeta.week} · {currentWeekMeta.phaseLabel} · target {currentWeekMeta.targetVolumeKm} km
          </p>
        )}
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((date) => {
            const session = weekSessions?.find((s) => s.date === date)
            const isToday = date === today
            const onTimeOff = !!findTimeOffForDate(date, timeOffEntries ?? [])
            return (
              <div
                key={date}
                className={`flex flex-col items-center rounded-xl border p-2 text-center ${
                  isToday
                    ? 'border-accent bg-accent/10'
                    : onTimeOff
                      ? 'border-warning/40 bg-warning/10'
                      : 'border-border bg-surface'
                }`}
              >
                <span className="text-[10px] uppercase text-ink-faint">
                  {WEEKDAY_FMT.format(parseISODate(date))}
                </span>
                <span
                  className={`mt-1 h-2 w-2 rounded-full ${session ? DOT_COLORS[session.status] : 'bg-surface-inset'}`}
                />
                <span className="mt-1 text-[11px] text-ink-muted">
                  {session && session.type !== 'rest' ? `${session.plannedDistanceKm}k` : ''}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {loggingSession && (
        <Modal title="Log this run" onClose={() => setLoggingSession(null)}>
          <LogRunForm
            session={loggingSession}
            onSaved={() => setLoggingSession(null)}
            onCancel={() => setLoggingSession(null)}
          />
        </Modal>
      )}

      {selectedTimeOff && (
        <AdjustmentSummaryModal
          timeOff={selectedTimeOff}
          onClose={() => setSelectedTimeOff(null)}
          onRemoved={() => setSelectedTimeOff(null)}
        />
      )}
    </div>
  )
}
