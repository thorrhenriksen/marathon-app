// Type-based session dot colors, used by calendar navigation (WeekStrip,
// MonthCalendar) to indicate what kind of session falls on a given day.
// Distinct from the status-based dot colors used elsewhere (Plan.tsx).

import type { SessionType } from '../types'

const SESSION_TYPE_DOT_COLORS: Record<SessionType, string> = {
  easy: 'bg-accent',
  long: 'bg-info',
  tempo: 'bg-warning',
  'marathon-pace': 'bg-highlight',
  strides: 'bg-accent',
  race: 'bg-danger',
  rest: 'bg-ink-faint',
  strength: 'bg-strength',
}

export function sessionDotColor(type: SessionType): string {
  return SESSION_TYPE_DOT_COLORS[type]
}

const SESSION_TYPE_BORDER_COLORS: Record<SessionType, string> = {
  easy: 'border-accent',
  long: 'border-info',
  tempo: 'border-warning',
  'marathon-pace': 'border-highlight',
  strides: 'border-accent',
  race: 'border-danger',
  rest: 'border-ink-faint',
  strength: 'border-strength',
}

/** Left-edge card border color keyed by session type — same palette as `sessionDotColor`. */
export function sessionBorderColor(type: SessionType): string {
  return SESSION_TYPE_BORDER_COLORS[type]
}
