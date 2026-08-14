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
import type { Session, SessionType } from '../types'
import Modal from '../components/Modal'
import LogRunForm from '../components/LogRunForm'

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
  planned: 'bg-neutral-800 text-neutral-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  skipped: 'bg-red-500/20 text-red-400',
  moved: 'bg-amber-500/20 text-amber-400',
  handled: 'bg-sky-500/20 text-sky-400',
}

const STATUS_BADGE_LABELS: Record<Session['status'], string> = {
  planned: 'Planned',
  completed: 'Completed',
  skipped: 'Skipped',
  moved: 'Moved',
  handled: 'Adjusted',
}

const DOT_COLORS: Record<Session['status'], string> = {
  planned: 'bg-neutral-600',
  completed: 'bg-emerald-500',
  skipped: 'bg-red-500',
  moved: 'bg-amber-500',
  handled: 'bg-sky-500',
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

  const [loggingSession, setLoggingSession] = useState<Session | null>(null)

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
      <div className="rounded-2xl border border-emerald-800/40 bg-gradient-to-br from-emerald-600/20 to-neutral-900 p-4">
        <p className="text-xs uppercase tracking-widest text-emerald-400">London Marathon</p>
        <p className="mt-1 text-3xl font-bold text-neutral-50">
          {daysToRace > 0 ? `${daysToRace} days to go` : daysToRace === 0 ? 'Race day!' : 'Completed'}
        </p>
        <p className="mt-1 text-sm text-neutral-400">{formatDisplayDateLong(RACE_DATE)}</p>
      </div>

      {/* Today's session */}
      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">Today</h2>
        {todaySession ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  {SESSION_TYPE_LABELS[todaySession.type]}
                </p>
                <p className="mt-1 text-2xl font-semibold text-neutral-50">
                  {todaySession.type === 'rest' ? 'Rest day' : `${todaySession.plannedDistanceKm} km`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_BADGE_STYLES[todaySession.status]}`}
              >
                {STATUS_BADGE_LABELS[todaySession.status]}
              </span>
            </div>

            <p className="mt-2 text-sm text-neutral-300">{todaySession.description}</p>

            {todaySession.type !== 'rest' && (
              <p className="mt-2 text-sm text-neutral-400">
                Target pace: <span className="text-neutral-200">{paceGuidanceFor(todaySession)}</span>
              </p>
            )}

            {showFuelingReminder && (
              <div className="mt-3 rounded-xl border border-amber-800/40 bg-amber-500/10 p-3">
                <p className="text-sm font-medium text-amber-300">Fueling reminder</p>
                <ul className="mt-1 list-disc pl-4 text-sm text-amber-200/90">
                  <li>Take a gel every 30-40 min starting around minute 40</li>
                  <li>Sip fluids regularly throughout</li>
                </ul>
              </div>
            )}

            {canLogToday && (
              <button
                onClick={() => setLoggingSession(todaySession)}
                className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-base font-semibold text-neutral-950"
              >
                Log this run
              </button>
            )}
            {todaySession.status === 'completed' && (
              <p className="mt-4 text-center text-sm font-medium text-emerald-400">Logged</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-800 p-4 text-center text-sm text-neutral-500">
            No session scheduled today.
          </div>
        )}
      </section>

      {/* This week at a glance */}
      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">This week</h2>
        {currentWeekMeta && (
          <p className="mb-2 text-xs text-neutral-500">
            Week {currentWeekMeta.week} · {currentWeekMeta.phaseLabel} · target {currentWeekMeta.targetVolumeKm} km
          </p>
        )}
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((date) => {
            const session = weekSessions?.find((s) => s.date === date)
            const isToday = date === today
            return (
              <div
                key={date}
                className={`flex flex-col items-center rounded-xl border p-2 text-center ${
                  isToday ? 'border-emerald-600 bg-emerald-500/10' : 'border-neutral-800 bg-neutral-900'
                }`}
              >
                <span className="text-[10px] uppercase text-neutral-500">
                  {WEEKDAY_FMT.format(parseISODate(date))}
                </span>
                <span
                  className={`mt-1 h-2 w-2 rounded-full ${session ? DOT_COLORS[session.status] : 'bg-neutral-800'}`}
                />
                <span className="mt-1 text-[11px] text-neutral-400">
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
    </div>
  )
}
