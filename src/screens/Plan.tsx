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
  planned: 'bg-neutral-700',
  completed: 'bg-emerald-500',
  skipped: 'bg-red-500',
  moved: 'bg-amber-500',
  handled: 'bg-sky-500',
}

function weekBadges(week: WeekMeta): { label: string; className: string }[] {
  const badges: { label: string; className: string }[] = []
  if (week.isRaceWeek) {
    badges.push({ label: 'Race day', className: 'bg-emerald-500 text-neutral-950' })
  }
  if (week.isHalfMarathonWeek) {
    badges.push({ label: 'Half marathon', className: 'bg-sky-500/20 text-sky-300' })
  }
  if (week.isTaper && !week.isRaceWeek) {
    badges.push({ label: 'Taper', className: 'bg-violet-500/20 text-violet-300' })
  }
  if (week.isCutback) {
    badges.push({ label: 'Cutback', className: 'bg-amber-500/20 text-amber-300' })
  }
  if (week.isHolidayMaintenance) {
    badges.push({ label: 'Holiday maintenance', className: 'bg-neutral-700 text-neutral-300' })
  }
  return badges
}

function weekCardStyle(week: WeekMeta, isCurrent: boolean): string {
  if (week.isRaceWeek) return 'border-emerald-500 bg-emerald-500/10'
  if (week.isHalfMarathonWeek) return 'border-sky-600/60 bg-sky-500/5'
  if (isCurrent) return 'border-emerald-700/60 bg-neutral-900'
  if (week.isTaper) return 'border-violet-800/40 bg-neutral-900'
  if (week.isCutback || week.isHolidayMaintenance) return 'border-amber-800/30 bg-neutral-900'
  return 'border-neutral-800 bg-neutral-900'
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
            <p className="text-sm font-semibold text-neutral-100">Week {week.week}</p>
            {isCurrent && (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-neutral-950">
                CURRENT
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            {formatDisplayDate(week.startDate)} – {formatDisplayDate(weekEnd)} · {week.targetVolumeKm} km
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-neutral-500">
            {completedCount}/{trackedCount}
          </span>
          <span className={`text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
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
        <div className="mt-3 flex flex-col gap-2 border-t border-neutral-800 pt-3">
          {sessions
            .slice()
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .map((session) => (
              <div key={session.id} className="flex items-center gap-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[session.status]}`} />
                <span className="w-9 shrink-0 text-[11px] uppercase text-neutral-500">
                  {formatDisplayDate(session.date).slice(0, 3)}
                </span>
                <span className="w-14 shrink-0 text-xs font-medium text-neutral-300">
                  {SESSION_TYPE_LABELS[session.type]}
                </span>
                <span className="flex-1 truncate text-xs text-neutral-400">{session.description}</span>
                {session.type !== 'rest' && (
                  <span className="shrink-0 text-xs text-neutral-500">{session.plannedDistanceKm} km</span>
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
        <p className="text-sm text-neutral-500">Loading plan…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6">
      <h1 className="text-lg font-semibold text-neutral-100">36-week plan</h1>

      {weeksByPhase.map(([phase, phaseWeeks]) => (
        <section key={phase}>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
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
