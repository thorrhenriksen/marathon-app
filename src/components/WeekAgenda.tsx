import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addDays, formatDateRangeShort, todayISO } from '../lib/dates'
import { computePaceZones, DEFAULT_GOAL_SECONDS, formatDuration } from '../lib/paceZones'
import { getDisplayStatus, DISPLAY_STATUS_STYLE } from '../lib/sessionStatus'
import { sessionBorderColor } from '../lib/sessionColors'
import { PHASE_LABELS } from '../db/weekPlan'
import { initialWeekWindow, expandWindowStart, expandWindowEnd, weeksInWindow, computeWeekTotals } from '../lib/weekAgenda'
import { useSessionDetail } from '../context/SessionDetailContext'
import type { Run, Session, SessionType, WeekMeta } from '../types'

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  easy: 'Easy run',
  long: 'Long run',
  tempo: 'Tempo',
  'marathon-pace': 'Marathon pace',
  strides: 'Strides',
  race: 'Race',
  rest: 'Rest',
  strength: 'Strength',
}

function DayCard({ session, today, onTap }: { session: Session; today: string; onTap: (s: Session) => void }) {
  const runs = useSessionRun(session)
  const displayStatus = getDisplayStatus(session, today)
  const style = DISPLAY_STATUS_STYLE[displayStatus]

  return (
    <button
      onClick={() => onTap(session)}
      className={`flex w-full items-center gap-3 rounded-xl border border-border border-l-4 bg-surface p-3 text-left ${sessionBorderColor(session.type)}`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">
            {session.type === 'strength' ? `Strength ${session.variant ?? ''}` : SESSION_TYPE_LABELS[session.type]}
          </span>
          {style.icon && (
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${style.badge}`}>
              {style.icon}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-faint">{session.description}</p>
        {runs && (
          <p className="mt-1 text-xs text-ink-muted">
            {runs.distanceKm} km · {formatDuration(runs.durationSeconds)}
          </p>
        )}
      </div>
      {session.type !== 'strength' && session.type !== 'rest' && !runs && (
        <span className="shrink-0 text-xs text-ink-faint">{session.plannedDistanceKm} km</span>
      )}
    </button>
  )
}

function useSessionRun(session: Session): Run | undefined {
  return useLiveQuery<Run | undefined>(
    async () => (session.linkedRunId ? db.runs.get(session.linkedRunId) : undefined),
    [session.linkedRunId],
  )
}

function RestRow() {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-surface-inset/40 p-3">
      <span className="text-sm text-ink-faint">Rest</span>
    </div>
  )
}

interface WeekSectionProps {
  week: WeekMeta
  sessions: Session[]
  isCurrent: boolean
  today: string
  onTapSession: (s: Session) => void
  registerHeaderRef?: (el: HTMLDivElement | null) => void
}

function WeekSection({ week, sessions, isCurrent, today, onTapSession, registerHeaderRef }: WeekSectionProps) {
  const zones = computePaceZones(DEFAULT_GOAL_SECONDS)
  const totals = computeWeekTotals(sessions, zones)
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i))

  return (
    <section>
      <div
        ref={registerHeaderRef}
        className="sticky top-0 z-[1] -mx-4 flex items-baseline justify-between bg-bg/95 px-4 py-2 backdrop-blur"
      >
        <h2 className="text-sm font-semibold text-ink">
          Week {week.week} · {PHASE_LABELS[week.phase]}
        </h2>
        <p className="text-xs text-ink-faint">
          {formatDateRangeShort(week.startDate)} · {totals.totalKm.toFixed(1)} km · {formatDuration(totals.totalMinutes * 60)}
        </p>
      </div>
      {isCurrent && <div data-current-week-marker />}
      <div className="flex flex-col gap-2 px-4 pb-2">
        {days.map((date) => {
          const session = sessions.find((s) => s.date === date)
          const isToday = date === today
          return (
            <div key={date} className={isToday ? 'ring-1 ring-accent/60 rounded-xl' : ''}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] uppercase text-ink-faint">{WEEKDAY_FMT.format(new Date(`${date}T00:00:00`))}</span>
              </div>
              {session ? <DayCard session={session} today={today} onTap={onTapSession} /> : <RestRow />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function WeekAgenda() {
  const weeks = useLiveQuery(() => db.weeks.orderBy('week').toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const { openSessionDetail } = useSessionDetail()
  const today = todayISO()

  const currentWeekNumber = useMemo(() => {
    if (!weeks) return null
    const past = weeks.filter((w) => w.startDate <= today).sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
    return past[0]?.week ?? weeks[0]?.week ?? null
  }, [weeks, today])

  const minWeek = weeks?.[0]?.week ?? 1
  const maxWeek = weeks?.[weeks.length - 1]?.week ?? 1

  const [weekWindow, setWeekWindow] = useState<{ start: number; end: number } | null>(null)
  const [showTodayButton, setShowTodayButton] = useState(false)

  if (weekWindow === null && currentWeekNumber !== null) {
    setWeekWindow(initialWeekWindow(currentWeekNumber, minWeek, maxWeek))
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const currentWeekHeaderRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const top = topSentinelRef.current
    const bottom = bottomSentinelRef.current
    const root = containerRef.current
    if (!top || !bottom || !root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (entry.target === top) {
            setWeekWindow((w) => (w ? expandWindowStart(w, minWeek) : w))
          } else if (entry.target === bottom) {
            setWeekWindow((w) => (w ? expandWindowEnd(w, maxWeek) : w))
          }
        }
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(top)
    observer.observe(bottom)
    return () => observer.disconnect()
  }, [minWeek, maxWeek])

  const hasCurrentWeek = currentWeekNumber !== null
  useEffect(() => {
    if (!currentWeekHeaderRef.current || !containerRef.current) return
    currentWeekHeaderRef.current.scrollIntoView({ block: 'nearest' })
  }, [hasCurrentWeek])

  useEffect(() => {
    const root = containerRef.current
    const header = currentWeekHeaderRef.current
    if (!root || !header) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowTodayButton(!entry.isIntersecting),
      { root, threshold: 0 },
    )
    observer.observe(header)
    return () => observer.disconnect()
  }, [weekWindow?.start, weekWindow?.end])

  function scrollToToday() {
    currentWeekHeaderRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  if (!weeks || !sessions || weekWindow === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <p className="text-sm text-ink-faint">Loading week…</p>
      </div>
    )
  }

  const sessionsByWeek = new Map<number, Session[]>()
  for (const session of sessions) {
    const list = sessionsByWeek.get(session.week)
    if (list) list.push(session)
    else sessionsByWeek.set(session.week, [session])
  }

  const visibleWeeks = weeksInWindow(weeks, weekWindow)

  return (
    <div ref={containerRef} className="relative max-h-[calc(100dvh-11rem)] overflow-y-auto">
      <div ref={topSentinelRef} className="h-px" />
      <div className="flex flex-col gap-4">
        {visibleWeeks.map((week) => (
          <WeekSection
            key={week.week}
            week={week}
            sessions={sessionsByWeek.get(week.week) ?? []}
            isCurrent={week.week === currentWeekNumber}
            today={today}
            onTapSession={openSessionDetail}
            registerHeaderRef={week.week === currentWeekNumber ? (el) => (currentWeekHeaderRef.current = el) : undefined}
          />
        ))}
      </div>
      <div ref={bottomSentinelRef} className="h-px" />

      {showTodayButton && (
        <button
          onClick={scrollToToday}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-20 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-lg"
        >
          Today
        </button>
      )}
    </div>
  )
}
