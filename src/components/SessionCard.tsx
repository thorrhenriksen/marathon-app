import { estimateSessionDurationMinutes, formatPace, formatPaceRange } from '../lib/paceZones'
import { todayISO } from '../lib/dates'
import { getDisplayStatus, DISPLAY_STATUS_STYLE } from '../lib/sessionStatus'
import { useSessionDetail } from '../context/SessionDetailContext'
import type { PaceZones, Session, SessionType } from '../types'

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  easy: 'Easy run',
  long: 'Long run',
  tempo: 'Tempo',
  'marathon-pace': 'Marathon pace',
  strides: 'Strides',
  race: 'Race day',
  rest: 'Rest',
  strength: 'Strength',
}

export function paceGuidanceFor(session: Session, zones: PaceZones): string {
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
    case 'strength':
      return '—'
  }
}

interface SessionCardProps {
  session: Session
  zones: PaceZones
  onLog?: (session: Session) => void
}

export default function SessionCard({ session, zones, onLog }: SessionCardProps) {
  const { openSessionDetail } = useSessionDetail()
  const estimatedMinutes = estimateSessionDurationMinutes(session.plannedDistanceKm, zones)
  const showFuelingReminder = session.type === 'long' && estimatedMinutes > 90
  const canLog =
    session.type !== 'rest' &&
    session.type !== 'strength' &&
    session.status !== 'completed' &&
    session.status !== 'skipped'
  const displayStatus = getDisplayStatus(session, todayISO())
  const statusStyle = DISPLAY_STATUS_STYLE[displayStatus]

  return (
    <div
      onClick={() => openSessionDetail(session)}
      className="rounded-2xl border border-border bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">{SESSION_TYPE_LABELS[session.type]}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {session.type === 'rest'
              ? 'Rest day'
              : session.type === 'strength'
                ? `Session ${session.variant}`
                : `${session.plannedDistanceKm} km`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusStyle.badge}`}>
          {statusStyle.icon ? `${statusStyle.icon} ` : ''}
          {statusStyle.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-muted">{session.description}</p>

      {session.type !== 'rest' && session.type !== 'strength' && (
        <p className="mt-2 text-sm text-ink-muted">
          Target pace: <span className="text-ink">{paceGuidanceFor(session, zones)}</span>
        </p>
      )}

      {session.type === 'strength' && session.exercises && (
        <ul className="mt-2 list-disc pl-4 text-sm text-ink-muted">
          {session.exercises.slice(0, 3).map((exercise) => (
            <li key={exercise.exerciseId}>{exercise.name}</li>
          ))}
        </ul>
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

      {canLog && onLog && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onLog(session)
          }}
          className="mt-4 w-full rounded-xl bg-accent py-3 text-base font-semibold text-accent-fg"
        >
          Log this run
        </button>
      )}
      {session.status === 'completed' && (
        <p className="mt-4 text-center text-sm font-medium text-accent">Logged</p>
      )}
    </div>
  )
}
