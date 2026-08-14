import { useLayoutEffect, useRef } from 'react'
import { addDays, parseISODate, todayISO } from '../lib/dates'
import { findTimeOffForDate } from '../lib/timeOffDisplay'
import { sessionDotColor } from '../lib/sessionColors'
import type { Session, TimeOff, WeekMeta } from '../types'

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })

interface WeekStripProps {
  weeks: WeekMeta[]
  sessions: Session[]
  timeOffEntries: TimeOff[]
  selectedDate: string
  onSelectDate: (date: string) => void
}

export default function WeekStrip({ weeks, sessions, timeOffEntries, selectedDate, onSelectDate }: WeekStripProps) {
  const currentWeekPageRef = useRef<HTMLDivElement>(null)
  const today = todayISO()

  useLayoutEffect(() => {
    currentWeekPageRef.current?.scrollIntoView({ inline: 'start', block: 'nearest' })
  }, [])

  return (
    <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
      {weeks.map((week) => {
        const weekEnd = addDays(week.startDate, 6)
        const isCurrentWeekPage = week.startDate <= today && today <= weekEnd
        return (
          <div
            key={week.week}
            ref={isCurrentWeekPage ? currentWeekPageRef : undefined}
            className="grid w-full shrink-0 snap-start grid-cols-7 gap-1.5"
          >
            {Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i)).map((date) => {
              const session = sessions.find((s) => s.date === date)
              const isToday = date === today
              const isSelected = date === selectedDate
              const onTimeOff = !!findTimeOffForDate(date, timeOffEntries)
              return (
                <button
                  key={date}
                  onClick={() => onSelectDate(date)}
                  className={`flex flex-col items-center rounded-xl border p-2 text-center ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : onTimeOff
                        ? 'border-warning/40 bg-warning/10'
                        : 'border-border bg-surface'
                  } ${isToday && !isSelected ? 'ring-1 ring-accent/60' : ''}`}
                >
                  <span className="text-[10px] uppercase text-ink-faint">{WEEKDAY_FMT.format(parseISODate(date))}</span>
                  <span
                    className={`mt-1 h-2 w-2 rounded-full ${session ? sessionDotColor(session.type) : 'bg-surface-inset'}`}
                  />
                  <span className="mt-1 text-[11px] text-ink-muted">
                    {session && session.type !== 'rest' ? `${session.plannedDistanceKm}k` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
