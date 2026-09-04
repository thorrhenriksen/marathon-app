import { useEffect, useLayoutEffect, useRef } from 'react'
import { addDays, parseISODate, todayISO } from '../lib/dates'
import { findTimeOffForDate } from '../lib/timeOffDisplay'
import { sessionDotColor } from '../lib/sessionColors'
import { getDisplayStatus, DISPLAY_STATUS_STYLE } from '../lib/sessionStatus'
import { useSessionDetail } from '../context/SessionDetailContext'
import type { Session, TimeOff, WeekMeta } from '../types'

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })

interface WeekStripProps {
  weeks: WeekMeta[]
  sessions: Session[]
  timeOffEntries: TimeOff[]
  selectedDate: string
  onSelectDate: (date: string) => void
  /** Called with the startDate of whichever week page is currently most visible while swiping. */
  onVisibleWeekChange?: (startDate: string) => void
  /** Bump this to scroll back to the current week's page. */
  jumpToTodaySignal?: number
}

export default function WeekStrip({
  weeks,
  sessions,
  timeOffEntries,
  selectedDate,
  onSelectDate,
  onVisibleWeekChange,
  jumpToTodaySignal,
}: WeekStripProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentWeekPageRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const { openSessionDetail } = useSessionDetail()
  const today = todayISO()

  useLayoutEffect(() => {
    currentWeekPageRef.current?.scrollIntoView({ inline: 'start', block: 'nearest' })
  }, [])

  useEffect(() => {
    if (jumpToTodaySignal === undefined || jumpToTodaySignal === 0) return
    currentWeekPageRef.current?.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'smooth' })
  }, [jumpToTodaySignal])

  useEffect(() => {
    if (!onVisibleWeekChange) return
    const root = containerRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce<IntersectionObserverEntry | null>((best, entry) => {
          if (!best || entry.intersectionRatio > best.intersectionRatio) return entry
          return best
        }, null)
        if (mostVisible && mostVisible.intersectionRatio > 0.5) {
          const startDate = (mostVisible.target as HTMLElement).dataset.weekStart
          if (startDate) onVisibleWeekChange(startDate)
        }
      },
      { root, threshold: [0.5, 0.75, 1] },
    )
    for (const page of pageRefs.current.values()) observer.observe(page)
    return () => observer.disconnect()
  }, [onVisibleWeekChange, weeks])

  return (
    <div ref={containerRef} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
      {weeks.map((week) => {
        const weekEnd = addDays(week.startDate, 6)
        const isCurrentWeekPage = week.startDate <= today && today <= weekEnd
        return (
          <div
            key={week.week}
            ref={(el) => {
              if (isCurrentWeekPage) currentWeekPageRef.current = el
              if (el) pageRefs.current.set(week.startDate, el)
              else pageRefs.current.delete(week.startDate)
            }}
            data-week-start={week.startDate}
            className="grid w-full shrink-0 snap-start grid-cols-7 gap-1.5"
          >
            {Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i)).map((date) => {
              const session = sessions.find((s) => s.date === date)
              const isToday = date === today
              const isSelected = date === selectedDate
              const onTimeOff = !!findTimeOffForDate(date, timeOffEntries)
              const displayStatus = session ? getDisplayStatus(session, today) : null
              const dotColor = session
                ? displayStatus === 'planned'
                  ? sessionDotColor(session.type)
                  : DISPLAY_STATUS_STYLE[displayStatus!].dot
                : 'bg-surface-inset'
              const dotIcon =
                displayStatus === 'completed' || displayStatus === 'missed'
                  ? DISPLAY_STATUS_STYLE[displayStatus].icon
                  : ''
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
                  className={`flex flex-col items-center rounded-xl border p-2 text-center ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : onTimeOff
                        ? 'border-warning/40 bg-warning/10'
                        : 'border-border bg-surface'
                  } ${isToday && !isSelected ? 'ring-1 ring-accent/60' : ''}`}
                >
                  <span className="text-[10px] uppercase text-ink-faint">{WEEKDAY_FMT.format(parseISODate(date))}</span>
                  <span className={`relative mt-1 flex h-2 w-2 items-center justify-center rounded-full ${dotColor}`}>
                    {dotIcon && (
                      <span className="absolute text-[6px] leading-none text-accent-fg">{dotIcon}</span>
                    )}
                  </span>
                  <span className="mt-1 text-[11px] text-ink-muted">
                    {session
                      ? session.type === 'strength'
                        ? session.variant
                        : session.type !== 'rest'
                          ? `${session.plannedDistanceKm}k`
                          : ''
                      : ''}
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
