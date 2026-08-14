import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addDays, formatDisplayDate, todayISO } from '../lib/dates'
import type { Session, SessionType, WeekMeta } from '../types'

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  easy: 'Easy',
  long: 'Long',
  tempo: 'Tempo',
  'marathon-pace': 'MP',
  strides: 'Strides',
  race: 'Race',
  rest: 'Rest',
}

const DOT_COLORS: Record<Session['status'], string> = {
  planned: 'bg-ink-faint',
  completed: 'bg-accent',
  skipped: 'bg-danger',
  moved: 'bg-warning',
  handled: 'bg-info',
}

function weekBadges(week: WeekMeta): { label: string; className: string }[] {
  const badges: { label: string; className: string }[] = []
  if (week.isRaceWeek) {
    badges.push({ label: 'Race day', className: 'bg-accent text-accent-fg' })
  }
  if (week.isHalfMarathonWeek) {
    badges.push({ label: 'Half marathon', className: 'bg-info/20 text-info' })
  }
  if (week.isTaper && !week.isRaceWeek) {
    badges.push({ label: 'Taper', className: 'bg-highlight/20 text-highlight' })
  }
  if (week.isCutback) {
    badges.push({ label: 'Cutback', className: 'bg-warning/20 text-warning' })
  }
  if (week.isHolidayMaintenance) {
    badges.push({ label: 'Holiday maintenance', className: 'bg-surface-inset text-ink-muted' })
  }
  return badges
}

function weekCardStyle(week: WeekMeta, isCurrent: boolean): string {
  if (week.isRaceWeek) return 'border-accent bg-accent/10'
  if (week.isHalfMarathonWeek) return 'border-info/60 bg-info/5'
  if (isCurrent) return 'border-accent/60 bg-surface'
  if (week.isTaper) return 'border-highlight/40 bg-surface'
  if (week.isCutback || week.isHolidayMaintenance) return 'border-warning/30 bg-surface'
  return 'border-border bg-surface'
}

interface WeekCardProps {
  week: WeekMeta
  sessions: Session[]
  isCurrent: boolean
  isExpanded: boolean
  onToggle: () => void
}

function WeekCard({ week, sessions, isCurrent, isExpanded, onToggle }: WeekCardProps) {
  const weekEnd = addDays(week.startDate, 6)
  const completedCount = sessions.filter((s) => s.status === 'completed').length
  const trackedCount = sessions.filter((s) => s.type !== 'rest').length
  const badges = weekBadges(week)

  return (
    <div className={`rounded-2xl border p-4 ${weekCardStyle(week, isCurrent)}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink">Week {week.week}</p>
            {isCurrent && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-fg">
                CURRENT
              </span>
            )}
          </div>
          <p className="text-xs text-ink-faint">
            {formatDisplayDate(week.startDate)} – {formatDisplayDate(weekEnd)} · {week.targetVolumeKm} km
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-ink-faint">
            {completedCount}/{trackedCount}
          </span>
          <span className={`text-ink-faint transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {badges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span key={b.label} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${b.className}`}>
              {b.label}
            </span>
          ))}
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          {sessions
            .slice()
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .map((session) => (
              <div key={session.id} className="flex items-center gap-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[session.status]}`} />
                <span className="w-9 shrink-0 text-[11px] uppercase text-ink-faint">
                  {formatDisplayDate(session.date).slice(0, 3)}
                </span>
                <span className="w-14 shrink-0 text-xs font-medium text-ink-muted">
                  {SESSION_TYPE_LABELS[session.type]}
                </span>
                <span className="flex-1 truncate text-xs text-ink-muted">{session.description}</span>
                {session.type !== 'rest' && (
                  <span className="shrink-0 text-xs text-ink-faint">{session.plannedDistanceKm} km</span>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default function Plan() {
  const today = todayISO()

  const weeks = useLiveQuery(() => db.weeks.orderBy('week').toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])

  const currentWeekNumber = useMemo(() => {
    if (!weeks) return null
    const past = weeks.filter((w) => w.startDate <= today).sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
    return past[0]?.week ?? weeks[0]?.week ?? null
  }, [weeks, today])

  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())
  const [initialized, setInitialized] = useState(false)

  if (!initialized && currentWeekNumber !== null) {
    setExpandedWeeks(new Set([currentWeekNumber]))
    setInitialized(true)
  }

  function toggleWeek(week: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(week)) {
        next.delete(week)
      } else {
        next.add(week)
      }
      return next
    })
  }

  const sessionsByWeek = useMemo(() => {
    const map = new Map<number, Session[]>()
    for (const session of sessions ?? []) {
      const list = map.get(session.week)
      if (list) {
        list.push(session)
      } else {
        map.set(session.week, [session])
      }
    }
    return map
  }, [sessions])

  const weeksByPhase = useMemo(() => {
    const map = new Map<number, WeekMeta[]>()
    for (const week of weeks ?? []) {
      const list = map.get(week.phase)
      if (list) {
        list.push(week)
      } else {
        map.set(week.phase, [week])
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [weeks])

  if (!weeks || !sessions) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-ink-faint">Loading plan…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6">
      <h1 className="text-lg font-semibold text-ink">36-week plan</h1>

      {weeksByPhase.map(([phase, phaseWeeks]) => (
        <section key={phase}>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-faint">
            Phase {phase} · {phaseWeeks[0].phaseLabel}
          </h2>
          <div className="flex flex-col gap-2">
            {phaseWeeks.map((week) => (
              <WeekCard
                key={week.week}
                week={week}
                sessions={sessionsByWeek.get(week.week) ?? []}
                isCurrent={week.week === currentWeekNumber}
                isExpanded={expandedWeeks.has(week.week)}
                onToggle={() => toggleWeek(week.week)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
