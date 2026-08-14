import { useState } from 'react'
import { addDays, parseISODate, startOfWeek, toISODate, todayISO } from '../lib/dates'
import { findTimeOffForDate } from '../lib/timeOffDisplay'
import { sessionDotColor } from '../lib/sessionColors'
import { useSessionDetail } from '../context/SessionDetailContext'
import { RACE_DATE } from '../db/seed'
import type { Session, TimeOff } from '../types'

const WEEKDAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

interface MonthCalendarProps {
  sessions: Session[]
  timeOffEntries: TimeOff[]
  selectedDate: string
  onSelectDate: (date: string) => void
}

export default function MonthCalendar({ sessions, timeOffEntries, selectedDate, onSelectDate }: MonthCalendarProps) {
  const { openSessionDetail } = useSessionDetail()
  const today = todayISO()
  const initial = parseISODate(selectedDate)
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  function goPrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function goNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const firstOfMonth = toISODate(new Date(viewYear, viewMonth, 1))
  const gridStart = startOfWeek(firstOfMonth)
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button onClick={goPrevMonth} className="rounded-full p-2 text-lg text-ink-muted" aria-label="Previous month">
          ‹
        </button>
        <p className="text-sm font-medium text-ink">{monthLabel(viewYear, viewMonth)}</p>
        <button onClick={goNextMonth} className="rounded-full p-2 text-lg text-ink-muted" aria-label="Next month">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-ink-faint">
        {WEEKDAY_HEADERS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const inMonth = parseISODate(date).getMonth() === viewMonth
          const session = sessions.find((s) => s.date === date)
          const isToday = date === today
          const isSelected = date === selectedDate
          const isRaceDay = date === RACE_DATE
          const onTimeOff = !!findTimeOffForDate(date, timeOffEntries)
          return (
            <button
              key={date}
              onClick={() => {
                if (isSelected && session) {
                  openSessionDetail(session)
                } else {
                  onSelectDate(date)
                }
              }}
              className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 ${
                isSelected
                  ? 'border-accent bg-accent/10'
                  : onTimeOff
                    ? 'border-warning/40 bg-warning/10'
                    : 'border-transparent'
              } ${isRaceDay ? 'ring-1 ring-accent' : ''} ${inMonth ? '' : 'opacity-30'}`}
            >
              <span className={`text-[11px] ${isToday ? 'font-bold text-accent' : 'text-ink-muted'}`}>
                {parseISODate(date).getDate()}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${session ? sessionDotColor(session.type) : 'bg-transparent'}`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
