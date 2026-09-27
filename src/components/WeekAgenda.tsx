import { useRef, useState, type TouchEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addDays, formatDateRangeShort, todayISO } from '../lib/dates'
import { formatDuration } from '../lib/paceZones'
import { useGoalEngine } from '../lib/useGoalEngine'
import { getDisplayStatus, DISPLAY_STATUS_STYLE } from '../lib/sessionStatus'
import { sessionBorderColor } from '../lib/sessionColors'
import { PHASE_LABELS } from '../db/weekPlan'
import { findCurrentWeekNumber, clampWeek, swipeDirection, computeWeekTotals, sessionEstimatedMinutes } from '../lib/weekAgenda'
import StreakChip from './StreakChip'
import { useSessionDetail } from '../context/SessionDetailContext'
import type { PaceZones, Run, Session, SessionType, WeekMeta } from '../types'

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

function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded} min`
  return `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, '0')}`
}

function useSessionRun(session: Session): Run | undefined {
  return useLiveQuery<Run | undefined>(
    async () => (session.linkedRunId ? db.runs.get(session.linkedRunId) : undefined),
    [session.linkedRunId],
  )
}

function DayCard({
  session,
  today,
  zones,
  onTap,
}: {
  session: Session
  today: string
  zones: PaceZones
  onTap: (s: Session) => void
}) {
  const run = useSessionRun(session)
  const displayStatus = getDisplayStatus(session, today)
  const style = DISPLAY_STATUS_STYLE[displayStatus]
  const estimatedMinutes = sessionEstimatedMinutes(session, zones)
  const isRun = session.type !== 'strength' && session.type !== 'rest'

  return (
    <button
      onClick={() => onTap(session)}
      className={`flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl border border-border border-l-4 bg-surface px-3 py-2.5 text-left active:bg-surface-inset ${sessionBorderColor(session.type)}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">
            {session.type === 'strength' ? `Strength ${session.variant ?? ''}` : SESSION_TYPE_LABELS[session.type]}
          </span>
          {style.icon && (
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${style.badge}`}
              aria-label={style.label}
            >
              {style.icon}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-faint">
          {run ? `${run.distanceKm} km · ${formatDuration(run.durationSeconds)}` : session.description}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {isRun && !run && <p className="text-sm font-medium text-ink">{session.plannedDistanceKm} km</p>}
        {!run && estimatedMinutes > 0 && <p className="text-[11px] text-ink-faint">~{formatMinutes(estimatedMinutes)}</p>}
      </div>
    </button>
  )
}

function RestRow() {
  return (
    <div className="flex min-h-11 w-full items-center rounded-xl border border-dashed border-border px-3">
      <span className="text-sm text-ink-faint">Rest</span>
    </div>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface WeekHeaderProps {
  week: WeekMeta
  totalKm: number
  totalMinutes: number
  canPrev: boolean
  canNext: boolean
  isCurrent: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

function WeekHeader({ week, totalKm, totalMinutes, canPrev, canNext, isCurrent, onPrev, onNext, onToday }: WeekHeaderProps) {
  const navButton =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted active:bg-surface-inset disabled:opacity-30'

  return (
    <div className="rounded-2xl border border-border bg-surface p-2">
      <div className="flex items-center gap-1">
        <button onClick={onPrev} disabled={!canPrev} className={navButton} aria-label="Previous week">
          <Chevron direction="left" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-base font-semibold text-ink">
            Week {week.week} · {PHASE_LABELS[week.phase]}
          </p>
          <p className="truncate text-xs text-ink-faint">{formatDateRangeShort(week.startDate)}</p>
        </div>
        <button onClick={onNext} disabled={!canNext} className={navButton} aria-label="Next week">
          <Chevron direction="right" />
        </button>
      </div>
      <div className="mt-1 flex min-h-8 items-center justify-center gap-2 px-2 pb-1">
        <span className="text-sm font-medium text-ink">{totalKm.toFixed(1)} km</span>
        <span className="text-ink-faint">·</span>
        <span className="text-sm text-ink-muted">~{formatMinutes(totalMinutes)}</span>
        {!isCurrent && (
          <button
            onClick={onToday}
            className="ml-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent"
          >
            Today
          </button>
        )}
      </div>
      <div className="flex justify-center pb-1">
        <StreakChip />
      </div>
    </div>
  )
}

export default function WeekAgenda() {
  const weeks = useLiveQuery(() => db.weeks.orderBy('week').toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const engine = useGoalEngine()
  const { openSessionDetail } = useSessionDetail()
  const today = todayISO()
  const [viewedWeek, setViewedWeek] = useState<number | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  if (!weeks || !sessions || !engine) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <p className="text-sm text-ink-faint">Loading week…</p>
      </div>
    )
  }

  const currentWeekNumber = findCurrentWeekNumber(weeks, today)
  const minWeek = weeks[0]?.week ?? 1
  const maxWeek = weeks[weeks.length - 1]?.week ?? 1
  const weekNumber = clampWeek(viewedWeek ?? currentWeekNumber ?? minWeek, minWeek, maxWeek)
  const week = weeks.find((w) => w.week === weekNumber)
  if (!week) return null

  const zones = engine.zones
  const weekSessions = sessions.filter((s) => s.week === weekNumber)
  const totals = computeWeekTotals(weekSessions, zones)
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i))

  function goTo(next: number) {
    setViewedWeek(clampWeek(next, minWeek, maxWeek))
  }

  function handleTouchStart(e: TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y)
    if (dir !== 0) goTo(weekNumber + dir)
  }

  return (
    <div className="flex w-full min-w-0 touch-pan-y flex-col gap-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <WeekHeader
        week={week}
        totalKm={totals.totalKm}
        totalMinutes={totals.totalMinutes}
        canPrev={weekNumber > minWeek}
        canNext={weekNumber < maxWeek}
        isCurrent={weekNumber === currentWeekNumber}
        onPrev={() => goTo(weekNumber - 1)}
        onNext={() => goTo(weekNumber + 1)}
        onToday={() => setViewedWeek(null)}
      />

      <div className="flex flex-col gap-2.5">
        {days.map((date) => {
          const daySessions = weekSessions.filter((s) => s.date === date && s.type !== 'rest')
          const isToday = date === today
          return (
            <div key={date} className="min-w-0">
              <p className={`mb-1 text-[11px] font-medium uppercase ${isToday ? 'text-accent' : 'text-ink-faint'}`}>
                {isToday ? 'Today · ' : ''}
                {WEEKDAY_FMT.format(new Date(`${date}T00:00:00`))}
              </p>
              {daySessions.length === 0 ? (
                <RestRow />
              ) : (
                <div className={`flex flex-col gap-2 ${isToday ? 'rounded-xl ring-2 ring-accent/50' : ''}`}>
                  {daySessions.map((s) => (
                    <DayCard key={s.id} session={s} today={today} zones={zones} onTap={openSessionDetail} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
