import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { RACE_DATE } from '../db/seed'
import {
  daysBetween,
  formatDateRangeShort,
  formatDisplayDate,
  formatDisplayDateLong,
  startOfWeek,
  todayISO,
} from '../lib/dates'
import { computePaceZones, DEFAULT_GOAL_SECONDS } from '../lib/paceZones'
import { getWeekAdjustments } from '../lib/timeOffDisplay'
import type { Session, TimeOff } from '../types'
import Modal from '../components/Modal'
import LogRunForm from '../components/LogRunForm'
import AdjustmentSummaryModal from '../components/AdjustmentSummaryModal'
import SessionCard from '../components/SessionCard'
import WeekStrip from '../components/WeekStrip'
import MonthCalendar from '../components/MonthCalendar'

type CalendarView = 'week' | 'month'

export default function Today() {
  const today = todayISO()

  const goal = useLiveQuery(() => db.goals.get('goal'), [])
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const todaySession = useLiveQuery(
    () => db.sessions.where('date').equals(today).first(),
    [today],
  )
  const allSessions = useLiveQuery(() => db.sessions.toArray(), [])
  const weeks = useLiveQuery(() => db.weeks.orderBy('week').toArray(), [])
  const timeOffEntries = useLiveQuery(() => db.timeOff.toArray(), [])
  const adjustments = useLiveQuery(
    () => db.timeOffAdjustments.filter((a) => !a.undone).toArray(),
    [],
  )

  const currentWeekStart = startOfWeek(today)

  const [loggingSession, setLoggingSession] = useState<Session | null>(null)
  const [selectedTimeOff, setSelectedTimeOff] = useState<TimeOff | null>(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [calendarView, setCalendarView] = useState<CalendarView>('week')
  const [viewedWeekStart, setViewedWeekStart] = useState(currentWeekStart)
  const [jumpToTodaySignal, setJumpToTodaySignal] = useState(0)

  const zones = computePaceZones(goal?.targetTimeSeconds ?? DEFAULT_GOAL_SECONDS)
  const daysToRace = daysBetween(today, RACE_DATE)

  const viewedWeekMeta = (weeks ?? []).find((w) => w.startDate === viewedWeekStart)

  function handleBackToToday() {
    setViewedWeekStart(currentWeekStart)
    setSelectedDate(today)
    setJumpToTodaySignal((n) => n + 1)
  }

  const weekIsAdjusted = viewedWeekMeta
    ? getWeekAdjustments(viewedWeekMeta.week, adjustments ?? []).length > 0
    : false

  function handleTapAdjusted() {
    if (!viewedWeekMeta) return
    const weekAdjustments = getWeekAdjustments(viewedWeekMeta.week, adjustments ?? [])
    const firstAdjustment = weekAdjustments[0]
    if (!firstAdjustment) return
    const timeOff = (timeOffEntries ?? []).find((t) => t.id === firstAdjustment.timeOffId)
    if (timeOff) setSelectedTimeOff(timeOff)
  }

  const selectedSession = (allSessions ?? []).find((s) => s.date === selectedDate)
  const showSelectedDayCard = selectedDate !== today

  if (!allSessions || !weeks) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-ink-faint">Loading…</p>
      </div>
    )
  }

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
          <SessionCard
            session={todaySession}
            zones={zones}
            onLog={setLoggingSession}
            cardAccent={settings?.cardAccent}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-ink-faint">
            No session scheduled today.
          </div>
        )}
      </section>

      {/* Calendar navigation */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-ink-faint">Calendar</h2>
            {weekIsAdjusted && (
              <button onClick={handleTapAdjusted} className="text-[11px] font-medium text-info underline">
                Adjusted
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {viewedWeekStart !== currentWeekStart && (
              <button onClick={handleBackToToday} className="text-[11px] font-medium text-accent underline">
                Back to today
              </button>
            )}
            <div className="flex rounded-full border border-border p-0.5 text-xs">
              <button
                onClick={() => setCalendarView('week')}
                className={`rounded-full px-3 py-1 font-medium ${
                  calendarView === 'week' ? 'bg-accent text-accent-fg' : 'text-ink-muted'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setCalendarView('month')}
                className={`rounded-full px-3 py-1 font-medium ${
                  calendarView === 'month' ? 'bg-accent text-accent-fg' : 'text-ink-muted'
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        {viewedWeekMeta && (
          <p className="mb-2 text-xs text-ink-faint">
            Week {viewedWeekMeta.week} · {formatDateRangeShort(viewedWeekMeta.startDate)} · target{' '}
            {viewedWeekMeta.targetVolumeKm} km
          </p>
        )}

        {calendarView === 'week' ? (
          <WeekStrip
            weeks={weeks}
            sessions={allSessions}
            timeOffEntries={timeOffEntries ?? []}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onVisibleWeekChange={setViewedWeekStart}
            jumpToTodaySignal={jumpToTodaySignal}
          />
        ) : (
          <MonthCalendar
            sessions={allSessions}
            timeOffEntries={timeOffEntries ?? []}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
      </section>

      {showSelectedDayCard && (
        <section>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">
            Sessions on {formatDisplayDate(selectedDate)}
          </h2>
          {selectedSession ? (
            <SessionCard session={selectedSession} zones={zones} onLog={setLoggingSession} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-ink-faint">
              No session scheduled.
            </div>
          )}
        </section>
      )}

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
